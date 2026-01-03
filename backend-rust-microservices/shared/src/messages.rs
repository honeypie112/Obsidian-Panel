use serde::{Deserialize, Serialize};

/// HTTP-like request sent from Gateway to Worker via REQ/REP
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpRequest {
    pub method: String,
    pub path: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<serde_json::Value>,
    pub user_id: Option<String>, // From session auth
}

/// Response from Worker to Gateway
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: serde_json::Value,
}

/// WebSocket event sent from Gateway to Worker via PUSH/PULL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsEvent {
    pub event_type: String,
    pub data: serde_json::Value,
    pub socket_id: String,
    pub user_id: Option<String>,
}

/// Broadcast message from Worker to Gateway via PUB/SUB
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Broadcast {
    pub event_type: String, // "log", "status", "stats", "versions_list", etc.
    pub data: serde_json::Value,
}
