use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use futures::{sink::SinkExt, stream::StreamExt};
use shared::messages::{Broadcast, WsEvent};
use std::sync::Arc;
use zeromq::{Socket, SocketRecv, SocketSend, SubSocket};

use crate::{config::CONFIG, state::GatewayState};

/// WebSocket upgrade handler
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<GatewayState>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

/// Handle individual WebSocket connection
async fn handle_socket(socket: WebSocket, state: Arc<GatewayState>) {
    let (mut sender, mut receiver) = socket.split();
    let socket_id = uuid::Uuid::new_v4().to_string();
    
    tracing::info!("New WebSocket connection: {}", socket_id);

    // Subscribe to broadcast channel
    let mut broadcast_rx = state.broadcast_tx.subscribe();

    // Task 1: Forward incoming WS messages → ZeroMQ PUSH
    let push_task = {
        let state = state.clone();
        let socket_id = socket_id.clone();

        tokio::spawn(async move {
            while let Some(Ok(msg)) = receiver.next().await {
                match msg {
                    Message::Text(text) => {
                        tracing::debug!("[{}] Received WS message: {}", socket_id, text);

                        // Parse and forward to ZeroMQ
                        if let Ok(data) = serde_json::from_str::<serde_json::Value>(&text) {
                            let ws_event = WsEvent {
                                event_type: data.get("type")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("message")
                                    .to_string(),
                                data,
                                socket_id: socket_id.clone(),
                                user_id: None, // TODO: Extract from session
                            };

                            // Serialize and send via PUSH socket
                            let serialized = match serde_json::to_vec(&ws_event) {
                                Ok(s) => s,
                                Err(e) => {
                                    tracing::error!("Failed to serialize WS event: {}", e);
                                    continue;
                                }
                            };

                            // Lock, send, and immediately release to avoid Send issues
                            {
                                let mut push = state.zmq_push.lock().await;
                                if let Err(e) = push.send(serialized.into()).await {
                                    tracing::error!("Failed to push to ZeroMQ: {}", e);
                                    break;
                                }
                            }
                            
                            tracing::debug!("[{}] Forwarded to Worker", socket_id);
                        }
                    }
                    Message::Close(_) => {
                        tracing::info!("[{}] Connection closed by client", socket_id);
                        break;
                    }
                    _ => {}
                }
            }
        })
    };

    // Task 2: Receive broadcasts from ZeroMQ SUB → Send to WS client
    let broadcast_task = tokio::spawn(async move {
        while let Ok(broadcast_msg) = broadcast_rx.recv().await {
            if sender
                .send(Message::Text(broadcast_msg))
                .await
                .is_err()
            {
                // Client disconnected
                break;
            }
        }
    });

    // Wait for either task to complete
    tokio::select! {
        _ = push_task => {}
        _ = broadcast_task => {}
    }

    tracing::info!("[{}] Connection handler finished", socket_id);
}

/// Background task: Listen to ZeroMQ SUB and broadcast to all WS clients
pub async fn broadcast_listener(state: Arc<GatewayState>) {
    tracing::info!("Starting broadcast listener");

    let mut sub_socket = SubSocket::new();
    
    // Connect to Worker's PUB socket
    if let Err(e) = sub_socket.connect(&CONFIG.worker_sub_endpoint).await {
        tracing::error!("Failed to connect ZeroMQ SUB: {}", e);
        return;
    }

    // Subscribe to all topics (empty string = all)
    if let Err(e) = sub_socket.subscribe("").await {
        tracing::error!("Failed to subscribe: {}", e);
        return;
    }

    tracing::info!("ZeroMQ SUB socket connected to {}", CONFIG.worker_sub_endpoint);

    loop {
        match sub_socket.recv().await {
            Ok(msg) => {
                // Deserialize broadcast message
                let msg_bytes: Vec<u8> = msg.into_vec().into_iter().flat_map(|b| b.to_vec()).collect();
                match serde_json::from_slice::<Broadcast>(&msg_bytes) {
                    Ok(broadcast) => {
                        tracing::debug!("Received broadcast: {}", broadcast.event_type);
                        
                        // Create Socket.IO-compatible message
                        let socket_io_msg = serde_json::json!({
                            "type": broadcast.event_type,
                            "data": broadcast.data
                        });

                        let msg_str = match serde_json::to_string(&socket_io_msg) {
                            Ok(s) => s,
                            Err(e) => {
                                tracing::error!("Failed to serialize broadcast: {}", e);
                                continue;
                            }
                        };

                        // Broadcast to all connected WebSocket clients
                        let _ = state.broadcast_tx.send(msg_str);
                    }
                    Err(e) => {
                        tracing::error!("Failed to deserialize broadcast: {}", e);
                    }
                }
            }
            Err(e) => {
                tracing::error!("Error receiving from ZeroMQ: {}", e);
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        }
    }
}
