mod config;
mod http_bridge;
mod ws_bridge;
mod state;

use std::{net::SocketAddr, sync::Arc, path::Path};

use axum::{Router, routing::get};
use mongodb::Client;
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
    state::GatewayState,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment variables
    dotenvy::dotenv().ok();
    
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,gateway=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Gateway Service");

    // Connect to MongoDB for session storage
    tracing::info!("Connecting to MongoDB at {}", CONFIG.mongo_uri);
    let mongo_client = Client::with_uri_str(&CONFIG.mongo_uri).await?;
    
    // Test connection
    mongo_client
        .database("admin")
        .run_command(bson::doc! { "ping": 1 }, None)
        .await?;
    tracing::info!("MongoDB Connected");

    // Initialize Gateway state (ZeroMQ connections)
    let state = Arc::new(GatewayState::new().await?);
    tracing::info!("ZeroMQ connections established");

    // Start WebSocket broadcast listener
    tokio::spawn(ws_bridge::broadcast_listener(state.clone()));
    
    // Initialize session store
    let session_store = MongoDBStore::new(mongo_client.clone(), CONFIG.mongo_db_name.clone());
    let session_layer = SessionManagerLayer::new(session_store)
        .with_secure(false)
        .with_same_site(tower_sessions::cookie::SameSite::Lax)
        .with_expiry(Expiry::OnInactivity(time::Duration::days(5)));

    // Build router
    let app = build_router(state.clone(), session_layer);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], CONFIG.port));
    tracing::info!("Gateway running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app.into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

fn build_router(
    state: Arc<GatewayState>, 
    session_layer: SessionManagerLayer<MongoDBStore>
) -> Router {
    // API routes - proxied to Worker via ZeroMQ
    let api_routes = Router::new()
        .fallback(http_bridge::proxy_handler);

    // WebSocket route
    let ws_routes = Router::new()
        .route("/ws", get(ws_bridge::ws_handler));

    // Static file serving for frontend
    let public_path = Path::new("public");
    
    let app = Router::new()
        .nest("/api", api_routes)
        .merge(ws_routes)
        .with_state(state)
        .layer(
            CorsLayer::new()
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
                    axum::http::header::UPGRADE,
                    axum::http::header::CONNECTION,
                ]),
        )
        .layer(session_layer)
        .layer(TraceLayer::new_for_http());

    // Add static file serving with SPA fallback if public directory exists
    if public_path.exists() {
        let static_files = ServeDir::new("public")
            .append_index_html_on_directories(true)
            .not_found_service(tower_http::services::ServeFile::new("public/index.html"));
        
        app.fallback_service(static_files)
    } else {
        app
    }
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
