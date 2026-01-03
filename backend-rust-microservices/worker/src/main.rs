mod config;
mod http_handler;
mod ws_handler;
mod state;

use shared::messages::*;
use std::sync::Arc;
use tokio::task;
use tokio::sync::Mutex;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use zeromq::{PubSocket, PullSocket, RepSocket, Socket, SocketRecv, SocketSend};

use crate::{
    config::CONFIG,
    state::WorkerState,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment variables
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,worker=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Worker Service");

    // Initialize Worker state (MongoDB, business logic, etc.)
    let state = Arc::new(WorkerState::new().await?);
    tracing::info!("Worker state initialized");

    // Initialize ZeroMQ sockets
    let mut rep_socket = RepSocket::new();
    rep_socket.bind(&CONFIG.req_bind_addr).await?;
    tracing::info!("REP socket listening on {}", CONFIG.req_bind_addr);

    let mut pull_socket = PullSocket::new();
    pull_socket.bind(&CONFIG.pull_bind_addr).await?;
    tracing::info!("PULL socket listening on {}", CONFIG.pull_bind_addr);

    let mut pub_socket = PubSocket::new();
    pub_socket.bind(&CONFIG.pub_bind_addr).await?;
    tracing::info!("PUB socket listening on {}", CONFIG.pub_bind_addr);

    let pub_socket = Arc::new(Mutex::new(pub_socket));

    // Spawn REQ/REP handler (HTTP-like requests)
    let rep_handle = {
        let state = state.clone();
        task::spawn(async move {
            handle_rep_loop(rep_socket, state).await;
        })
    };

    // Spawn PUSH/PULL handler (WebSocket events)
    let pull_handle = {
        let state = state.clone();
        let pub_socket = pub_socket.clone();
        task::spawn(async move {
            handle_pull_loop(pull_socket, state, pub_socket).await;
        })
    };

    tracing::info!("Worker service ready");

    // Wait for shutdown signal
    tokio::select! {
        _ = rep_handle => tracing::warn!("REP handler exited"),
        _ = pull_handle => tracing::warn!("PULL handler exited"),
        _ = shutdown_signal() => {
            tracing::info!("Shutdown signal received");
        }
    }

    Ok(())
}

/// Handle REQ/REP loop for synchronous HTTP requests
async fn handle_rep_loop(mut rep_socket: RepSocket, state: Arc<WorkerState>) {
    loop {
        match rep_socket.recv().await {
            Ok(msg) => {
                // Deserialize HttpRequest
                let msg_bytes: Vec<u8> = msg.into_vec().into_iter().flat_map(|b| b.to_vec()).collect();
                match serde_json::from_slice::<HttpRequest>(&msg_bytes) {
                    Ok(req) => {
                        tracing::debug!("Handling HTTP request: {} {}", req.method, req.path);
                        
                        // Process request
                        let response = http_handler::handle_request(req, state.clone()).await;
                        
                        // Send response
                        match serde_json::to_vec(&response) {
                            Ok(response_json) => {
                                if let Err(e) = rep_socket.send(response_json.into()).await {
                                    tracing::error!("Failed to send response: {}", e);
                                }
                            }
                            Err(e) => {
                                tracing::error!("Failed to serialize response: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to deserialize request: {}", e);
                        
                        // Send error response
                        let error_response = HttpResponse {
                            status: 500,
                            headers: vec![],
                            body: serde_json::json!({"error": "Invalid request format"}),
                        };
                        let _ = rep_socket.send(serde_json::to_vec(&error_response).unwrap().into()).await;
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to receive from REP socket: {}", e);
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        }
    }
}

/// Handle PUSH/PULL loop for asynchronous WebSocket events
async fn handle_pull_loop(
    mut pull_socket: PullSocket,
    state: Arc<WorkerState>,
    pub_socket: Arc<Mutex<PubSocket>>,
) {
    loop {
        match pull_socket.recv().await {
            Ok(msg) => {
                let msg_bytes: Vec<u8> = msg.into_vec().into_iter().flat_map(|b| b.to_vec()).collect();
                match serde_json::from_slice::<WsEvent>(&msg_bytes) {
                    Ok(event) => {
                        tracing::debug!("Handling WS event: {}", event.event_type);
                        
                        // Process event (non-blocking)
                        let state = state.clone();
                        let pub_socket = pub_socket.clone();
                        
                        task::spawn(async move {
                            ws_handler::handle_event(event, state, pub_socket).await;
                        });
                    }
                    Err(e) => {
                        tracing::error!("Failed to deserialize WS event: {}", e);
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to receive from PULL socket: {}", e);
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        }
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
}
