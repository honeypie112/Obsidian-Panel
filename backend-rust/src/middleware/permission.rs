use std::sync::Arc;

use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use bson::oid::ObjectId;

use crate::{
    error::AppError,
    middleware::AuthUser,
    models::UserRole,
    state::AppState,
};

/// Permission checking middleware factory
/// Returns a middleware that checks if the user has the required permission
#[allow(dead_code)]
pub fn require_permission(
    permission: &'static str,
) -> impl Fn(
    State<Arc<AppState>>,
    Request,
    Next,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Response, AppError>> + Send>>
       + Clone
       + Send
       + 'static {
    move |state, request, next| {
        Box::pin(check_permission(state, request, next, permission))
    }
}

#[allow(dead_code)]
async fn check_permission(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
    required_permission: &str,
) -> Result<Response, AppError> {
    // Get user from request extensions (set by auth middleware)
    let auth_user = request
        .extensions()
        .get::<AuthUser>()
        .ok_or_else(|| AppError::Unauthorized("Unauthorized".to_string()))?;

    // Admin bypass - admins have all permissions
    if auth_user.role == UserRole::Admin {
        return Ok(next.run(request).await);
    }

    // Fetch user from database to get permissions
    let user_id = ObjectId::parse_str(&auth_user.id)
        .map_err(|_| AppError::Unauthorized("Invalid user ID".to_string()))?;

    let user = state
        .db
        .collection::<crate::models::User>("users")
        .find_one(bson::doc! { "_id": user_id }, None)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::Unauthorized("User not found".to_string()))?;

    // Check if user has the required permission
    if user.permissions.contains(&required_permission.to_string()) {
        return Ok(next.run(request).await);
    }

    Err(AppError::Forbidden(format!(
        "Access denied. Requires '{}' permission.",
        required_permission
    )))
}

/// Helper struct for extracting user with permission check in handlers
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct PermissionGuard {
    pub user_id: ObjectId,
    pub role: UserRole,
}

impl PermissionGuard {
    pub async fn check(
        state: &AppState,
        auth_user: &AuthUser,
        permission: &str,
    ) -> Result<Self, AppError> {
        // Admin bypass - has all permissions
        if auth_user.role == UserRole::Admin {
            return Ok(Self {
                user_id: ObjectId::parse_str(&auth_user.id)
                    .map_err(|_| AppError::Unauthorized("Invalid user ID".to_string()))?,
                role: auth_user.role.clone(),
            });
        }

        // User role has NO permissions - only can view status/overview
        if auth_user.role == UserRole::User {
            return Err(AppError::Forbidden(
                "User role has no additional permissions. Contact admin for access.".to_string()
            ));
        }

        // Sub-admin: check specific permissions
        let user_id = ObjectId::parse_str(&auth_user.id)
            .map_err(|_| AppError::Unauthorized("Invalid user ID".to_string()))?;

        let user = state
            .db
            .collection::<crate::models::User>("users")
            .find_one(bson::doc! { "_id": user_id }, None)
            .await
            .map_err(AppError::Database)?
            .ok_or_else(|| AppError::Unauthorized("User not found".to_string()))?;

        if user.permissions.contains(&permission.to_string()) {
            return Ok(Self {
                user_id,
                role: auth_user.role.clone(),
            });
        }

        Err(AppError::Forbidden(format!(
            "Access denied. Requires '{}' permission.",
            permission
        )))
    }
}
