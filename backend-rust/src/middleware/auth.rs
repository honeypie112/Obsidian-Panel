

use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use tower_sessions::Session;

use crate::error::AppError;
use crate::models::UserRole;

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: String,
    pub role: UserRole,
}

/// Session Authentication middleware
pub async fn auth_middleware(
    session: Session,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let user_id: Option<String> = session.get("user_id").await.map_err(|e| {
        tracing::error!("Session get error: {}", e);
        AppError::Internal("Session error".to_string())
    })?;

    let role: Option<UserRole> = session.get("role").await.map_err(|e| {
        tracing::error!("Session get error: {}", e);
        AppError::Internal("Session error".to_string())
    })?;

    if let (Some(id), Some(role)) = (user_id, role) {
        request.extensions_mut().insert(AuthUser { id, role });
        Ok(next.run(request).await)
    } else {
        Err(AppError::Unauthorized("Not authenticated".to_string()))
    }
}

#[axum::async_trait]
impl<S> axum::extract::FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or_else(|| AppError::Unauthorized("Not authenticated".to_string()))
    }
}
