use shared::messages::{Broadcast, WsEvent};
use std::sync::Arc;
use tokio::sync::Mutex;
use zeromq::{PubSocket, SocketSend};

use crate::state::WorkerState;

/// Handle WebSocket events and publish broadcasts
pub async fn handle_event(
    event: WsEvent,
    _state: Arc<WorkerState>,
    pub_socket: Arc<Mutex<PubSocket>>,
) {
    tracing::debug!("Processing WS event: {}", event.event_type);

    match event.event_type.as_str() {
        // Server control events
        "start_server" => {
            handle_start_server_event(pub_socket).await;
        }
        
        "stop_server" => {
            handle_stop_server_event(pub_socket).await;
        }
        
        "send_command" => {
            if let Some(command) = event.data.get("command").and_then(|v| v.as_str()) {
                handle_send_command_event(command, pub_socket).await;
            }
        }
        
        // Version management
        "get_versions" => {
            handle_get_versions_event(pub_socket).await;
        }
        
        // Log requests
        "request_log_history" => {
            handle_log_history_request(pub_socket).await;
        }
        
        _ => {
            tracing::warn!("Unknown event type: {}", event.event_type);
        }
    }
}

async fn handle_start_server_event(pub_socket: Arc<Mutex<PubSocket>>) {
    // TODO: Actually start the server
    tracing::info!("Starting server via WebSocket event");
    
    // Broadcast status update
    broadcast_message(
        pub_socket.clone(),
        "status",
        serde_json::json!({
            "status": "starting",
            "message": "Server is starting..."
        }),
    ).await;
    
    // Simulate startup delay
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    
    // Broadcast log messages
    broadcast_message(
        pub_socket.clone(),
        "log",
        serde_json::json!({
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "message": "Server started successfully"
        }),
    ).await;
    
    broadcast_message(
        pub_socket,
        "status",
        serde_json::json!({
            "status": "running",
            "message": "Server is running"
        }),
    ).await;
}

async fn handle_stop_server_event(pub_socket: Arc<Mutex<PubSocket>>) {
    tracing::info!("Stopping server via WebSocket event");
    
    broadcast_message(
        pub_socket.clone(),
        "status",
        serde_json::json!({
            "status": "stopping",
            "message": "Server is stopping..."
        }),
    ).await;
    
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    
    broadcast_message(
        pub_socket,
        "status",
        serde_json::json!({
            "status": "stopped",
            "message": "Server stopped"
        }),
    ).await;
}

async fn handle_send_command_event(command: &str, pub_socket: Arc<Mutex<PubSocket>>) {
    tracing::info!("Sending command to server: {}", command);
    
    // TODO: Send command to Minecraft server
    
    // Broadcast command echo
    broadcast_message(
        pub_socket,
        "log",
        serde_json::json!({
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "message": format!("> {}", command)
        }),
    ).await;
}

async fn handle_get_versions_event(pub_socket: Arc<Mutex<PubSocket>>) {
    tracing::info!("Fetching Minecraft versions");
    
    // TODO: Fetch actual versions from API
    let versions = vec!["1.20.1", "1.19.4", "1.18.2", "1.17.1"];
    
    broadcast_message(
        pub_socket,
        "versions_list",
        serde_json::json!(versions),
    ).await;
}

async fn handle_log_history_request(pub_socket: Arc<Mutex<PubSocket>>) {
    tracing::info!("Sending log history");
    
    // TODO: Get actual log history
    let logs = vec![
        serde_json::json!({
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "message": "Welcome to Obsidian Panel"
        }),
        serde_json::json!({
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "message": "Server ready"
        }),
    ];
    
    broadcast_message(
        pub_socket,
        "log_history",
        serde_json::json!(logs),
    ).await;
}

/// Helper function to broadcast a message to all Gateway instances
async fn broadcast_message(
    pub_socket: Arc<Mutex<PubSocket>>,
    event_type: &str,
    data: serde_json::Value,
) {
    let broadcast = Broadcast {
        event_type: event_type.to_string(),
        data,
    };
    
    match serde_json::to_vec(&broadcast) {
        Ok(serialized) => {
            let mut socket = pub_socket.lock().await;
            if let Err(e) = socket.send(serialized.into()).await {
                tracing::error!("Failed to broadcast message: {}", e);
            }
        }
        Err(e) => {
            tracing::error!("Failed to serialize broadcast: {}", e);
        }
    }
}
