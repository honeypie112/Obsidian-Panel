use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};
use zeromq::{PubSocket, ReqSocket, Socket};

use crate::config::CONFIG;

#[derive(Clone)]
pub struct GatewayState {
    /// REQ socket for synchronous HTTP requests to Worker
    pub zmq_req: Arc<Mutex<ReqSocket>>,
    /// PUSH socket for async WebSocket events to Worker
    pub zmq_push: Arc<Mutex<PubSocket>>,
    /// Broadcast channel for sending to all connected WebSocket clients
    pub broadcast_tx: broadcast::Sender<String>,
}

impl GatewayState {
    pub async fn new() -> anyhow::Result<Self> {
        // REQ socket for HTTP requests
        let mut zmq_req = ReqSocket::new();
        zmq_req.connect(&CONFIG.worker_req_endpoint).await?;
        tracing::info!("Connected REQ socket to {}", CONFIG.worker_req_endpoint);

        // PUSH socket for WebSocket events
        let mut zmq_push = PubSocket::new();
        zmq_push.connect(&CONFIG.worker_push_endpoint).await?;
        tracing::info!("Connected PUSH socket to {}", CONFIG.worker_push_endpoint);

        // Broadcast channel for WebSocket clients (1000 message buffer)
        let (broadcast_tx, _) = broadcast::channel::<String>(1000);

        Ok(Self {
            zmq_req: Arc::new(Mutex::new(zmq_req)),
            zmq_push: Arc::new(Mutex::new(zmq_push)),
            broadcast_tx,
        })
    }
}
