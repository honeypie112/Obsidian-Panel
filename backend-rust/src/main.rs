mod config;
mod error;
mod middleware;
mod models;
mod routes;
mod services;
mod state;

use std::{net::SocketAddr, sync::Arc, path::Path};

use axum::{
    middleware as axum_middleware,
    Router,
};
use mongodb::Client;
use socketioxide::{
    extract::SocketRef,
    socket::DisconnectReason,
    SocketIo,
};
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
    services::ServeDir,
};
use tower_sessions::{Expiry, SessionManagerLayer};
use tower_sessions_mongodb_store::MongoDBStore;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    config::CONFIG,
    middleware::auth_middleware,
    state::AppState,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment variables
    dotenvy::dotenv().ok();
    
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,obsidian_panel_backend=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Obsidian Panel Backend (Rust)");

    // Connect to MongoDB
    tracing::info!("Connecting to MongoDB at {}", CONFIG.mongo_uri);
    let mongo_client = Client::with_uri_str(&CONFIG.mongo_uri).await?;
    
    // Test connection
    mongo_client
        .database("admin")
        .run_command(bson::doc! { "ping": 1 }, None)
        .await?;
    tracing::info!("MongoDB Connected");

    // Initialize Socket.IO
    let (sio_layer, io) = SocketIo::new_layer();

    // Initialize application state
    let state = Arc::new(AppState::new(mongo_client.clone(), &CONFIG.mongo_db_name, io.clone()).await);
    
    // Initialize session store
    let session_store = MongoDBStore::new(mongo_client.clone(), CONFIG.mongo_db_name.clone());
    let session_layer = SessionManagerLayer::new(session_store)
        .with_secure(false)
        .with_same_site(tower_sessions::cookie::SameSite::Lax)
        .with_expiry(Expiry::OnInactivity(time::Duration::days(5)));

    // Initialize database (create default config if not exists)
    state.init_database().await?;
    tracing::info!("Database initialized");

    // Initialize backup scheduler
    state.backup.clone().init_scheduler().await?;
    tracing::info!("Backup scheduler initialized");

    // Start system stats monitoring
    state.minecraft.clone().start_stats_monitoring();
    tracing::info!("System stats monitoring started");

    // Setup Socket.IO handlers
    setup_socket_handlers(io.clone(), state.clone());

    // Build router
    let app = build_router(state.clone(), sio_layer, session_layer);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], CONFIG.port));
    tracing::info!("Server running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app.into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

fn build_router(
    state: Arc<AppState>, 
    sio_layer: socketioxide::layer::SocketIoLayer,
    session_layer: SessionManagerLayer<MongoDBStore>
) -> Router {
    // API routes with authentication
    let api_routes = Router::new()
        .nest("/auth", routes::auth_router(state.clone()))
        .nest(
            "/control",
            routes::control_router()
                .layer(axum_middleware::from_fn_with_state(state.clone(), auth_middleware)),
        )
        .nest(
            "/backups",
            routes::backups_router()
                .layer(axum_middleware::from_fn_with_state(state.clone(), auth_middleware)),
        )
        .nest(
            "/plugins",
            routes::plugins_router()
                .layer(axum_middleware::from_fn_with_state(state.clone(), auth_middleware)),
        )
        .nest(
            "/users",
            routes::users_router()
                .layer(axum_middleware::from_fn_with_state(state.clone(), auth_middleware)),
        );

    // Static file serving for frontend
    let public_path = Path::new("public");
    let static_service = if public_path.exists() {
        Some(ServeDir::new("public").append_index_html_on_directories(true))
    } else {
        None
    };

    let mut app = Router::new()
        .nest("/api", api_routes)
        .layer(sio_layer)
        .layer(session_layer)
        .layer(
            CorsLayer::new()
                // Mirror the request origin to allow any origin with credentials
                .allow_origin(tower_http::cors::AllowOrigin::mirror_request())
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::DELETE,
                    axum::http::Method::OPTIONS,
                ])
                .allow_credentials(true)
                .allow_headers([
                    axum::http::header::AUTHORIZATION,
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::ACCEPT,
                ]),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Add static file serving if public directory exists
    if let Some(service) = static_service {
        app = app.fallback_service(service);
    }

    app
}

fn setup_socket_handlers(io: SocketIo, state: Arc<AppState>) {
    io.ns("/", move |socket: SocketRef| {
        let state = state.clone();
        
        tracing::info!("New client connected: {}", socket.id);

        // Send initial status
        let status = state.minecraft.get_status();
        let _ = socket.emit("status", &status);

        // Send log history
        let logs = state.minecraft.get_log_history();
        tracing::info!("Sending initial log_history to client {}: {} items", socket.id, logs.len());
        if let Err(e) = socket.emit("log_history", &logs) {
            tracing::error!("Failed to emit log_history to {}: {}", socket.id, e);
        }

        // Handle version request
        let state_versions = state.clone();
        socket.on("get_versions", move |socket: SocketRef| {
            let state = state_versions.clone();
            async move {
                match state.minecraft.get_available_versions().await {
                    Ok(versions) => {
                        let _ = socket.emit("versions_list", (versions,));
                    }
                    Err(e) => {
                        tracing::error!("Failed to fetch versions: {:?}", e);
                        let _ = socket.emit("versions_error", "Failed to fetch versions");
                    }
                }
            }
        });

        let state_logs = state.clone();
        socket.on("request_log_history", move |socket: SocketRef| {
            let state = state_logs.clone();
            async move {
                let logs = state.minecraft.get_log_history();
                tracing::info!("[Socket] Emitting log_history with {} items", logs.len());
                let _ = socket.emit("log_history", &logs);
            }
        });

        socket.on_disconnect(|socket: SocketRef, reason: DisconnectReason| async move {
            tracing::info!("Client disconnected: {} - {:?}", socket.id, reason);
        });
    });
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received, starting graceful shutdown");
}
