use axum::{
    extract::State,
    http::{Request, StatusCode},
    response::{IntoResponse, Response},
    body::Body,
};
use shared::messages::{HttpRequest as ZmqHttpRequest, HttpResponse as ZmqHttpResponse};
use std::sync::Arc;
use zeromq::{SocketRecv, SocketSend};

use crate::state::GatewayState;

/// Proxy HTTP requests to Worker via ZeroMQ REQ/REP
pub async fn proxy_handler(
    State(state): State<Arc<GatewayState>>,
    req: Request<Body>,
) -> Result<Response, StatusCode> {
    // 1. Extract request details
    let method = req.method().to_string();
    let path = req.uri().path().to_string();
    let query = req.uri().query().map(|q| q.to_string());
    
    // Combine path and query
    let full_path = if let Some(q) = query {
        format!("{}?{}", path, q)
    } else {
        path
    };
    
    let headers: Vec<(String, String)> = req
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    // 2. Read body
    let body_bytes = axum::body::to_bytes(req.into_body(), usize::MAX)
        .await
        .map_err(|e| {
            tracing::error!("Failed to read request body: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    let body = if !body_bytes.is_empty() {
        serde_json::from_slice(&body_bytes).ok()
    } else {
        None
    };

    // 3. Create ZeroMQ request message
    let zmq_request = ZmqHttpRequest {
        method: method.clone(),
        path: full_path.clone(),
        headers,
        body,
        user_id: None, // TODO: Extract from session
    };

    tracing::debug!("Proxying {} {}", method, full_path);

    // 4. Send to Worker via REQ socket (blocking until response)
    let mut req_socket = state.zmq_req.lock().await;
    
    let request_json = serde_json::to_vec(&zmq_request)
        .map_err(|e| {
            tracing::error!("Failed to serialize request: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    req_socket
        .send(request_json.into())
        .await
        .map_err(|e| {
            tracing::error!("Failed to send to Worker: {}", e);
            StatusCode::SERVICE_UNAVAILABLE
        })?;

    // 5. Wait for response from Worker
    let response_msg = req_socket
        .recv()
        .await
        .map_err(|e| {
            tracing::error!("Failed to receive from Worker: {}", e);
            StatusCode::SERVICE_UNAVAILABLE
        })?;

    let response_bytes: Vec<u8> = response_msg.into_vec().into_iter().flat_map(|b| b.to_vec()).collect();
    let response: ZmqHttpResponse = serde_json::from_slice(&response_bytes)
        .map_err(|e| {
            tracing::error!("Failed to deserialize response: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tracing::debug!("Received response with status {}", response.status);

    // 6. Convert to HTTP response
    let mut http_response = axum::Json(response.body).into_response();
    *http_response.status_mut() = StatusCode::from_u16(response.status)
        .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

    // Add response headers
    for (key, value) in response.headers {
        if let (Ok(header_name), Ok(header_value)) = (
            key.parse::<axum::http::HeaderName>(),
            value.parse::<axum::http::HeaderValue>(),
        ) {
            http_response.headers_mut().insert(header_name, header_value);
        }
    }

    Ok(http_response)
}
