use std::sync::Arc;

use axum::{
    extract::State,
    middleware as axum_middleware,
    routing::{get, post, put},
    Json, Router,
};
use bson::oid::ObjectId;
use tower_sessions::Session;
use serde::{Deserialize, Serialize};

use crate::{
    error::{AppError, Result},
    middleware::{auth_middleware, AuthUser},
    models::{User, UserResponse, UserRole},
    state::AppState,
};

pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/has-admin", get(has_admin));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        .route("/me", get(get_me))
        .route("/profile", put(update_profile))
        .layer(axum_middleware::from_fn_with_state(state.clone(), auth_middleware));

    public_routes.merge(protected_routes)
}

#[derive(Debug, Deserialize)]
struct AuthRequest {
    username: String,
    password: String,
}

#[derive(Debug, Serialize)]
struct AuthResponse {
    token: String,
    user: UserResponse,
}

#[derive(Debug, Deserialize)]
struct UpdateProfileRequest {
    username: Option<String>,
    #[serde(rename = "currentPassword")]
    current_password: Option<String>,
    #[serde(rename = "newPassword")]
    new_password: Option<String>,
}

async fn register(
    state: State<Arc<AppState>>,
    session: Session,
    Json(payload): Json<AuthRequest>,
) -> Result<Json<AuthResponse>> {
    let collection = state.db.collection::<User>("users");

    // Check if user exists
    let existing = collection
        .find_one(bson::doc! { "username": &payload.username }, None)
        .await
        .map_err(AppError::Database)?;

    if existing.is_some() {
        return Err(AppError::BadRequest("User already exists".to_string()));
    }

    // First user is admin
    let count = collection
        .count_documents(bson::doc! {}, None)
        .await
        .map_err(AppError::Database)?;

    let role = if count == 0 {
        UserRole::Admin
    } else {
        UserRole::User
    };

    // Hash password
    // Use cost 10 to match Node.js bcryptjs
    let password_hash = bcrypt::hash(&payload.password, 10)
        .map_err(|e| AppError::Internal(format!("Password hashing failed: {}", e)))?;

    let user = User::new(payload.username.clone(), password_hash, role);

    let result = collection
        .insert_one(&user, None)
        .await
        .map_err(AppError::Database)?;

    let user_id = result
        .inserted_id
        .as_object_id()
        .ok_or_else(|| AppError::Internal("Failed to get user ID".to_string()))?;

    // Create session
    session.insert("user_id", user_id.to_hex()).await.map_err(|e| {
        tracing::error!("Session error: {}", e);
        AppError::Internal("Failed to create session".to_string())
    })?;
    session.insert("role", user.role.clone()).await.map_err(|e| {
        tracing::error!("Session error: {}", e);
        AppError::Internal("Failed to create session".to_string())
    })?;

    Ok(Json(AuthResponse {
        token: "session".to_string(),
        user: UserResponse {
            id: user_id.to_hex(),
            username: user.username,
            role: user.role,
            permissions: None,
        },
    }))
}

async fn login(
    state: State<Arc<AppState>>,
    session: Session,
    Json(payload): Json<AuthRequest>,
) -> Result<Json<AuthResponse>> {
    let collection = state.db.collection::<User>("users");

    let user = collection
        .find_one(bson::doc! { "username": &payload.username }, None)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::BadRequest("Invalid Credentials".to_string()))?;

    // Check if password hash exists and is valid
    if user.password.is_empty() || !user.password.starts_with("$2") {
        tracing::error!("User {} has invalid password hash in database", payload.username);
        return Err(AppError::BadRequest("Invalid Credentials".to_string()));
    }

    // Verify password
    let valid = bcrypt::verify(&payload.password, &user.password)
        .map_err(|e| AppError::Internal(format!("Password verification failed: {}", e)))?;

    if !valid {
        return Err(AppError::BadRequest("Invalid Credentials".to_string()));
    }

    // Cycle session ID for security and to ensure fresh session
    if let Err(e) = session.cycle_id().await {
        tracing::error!("Failed to cycle session ID: {}", e);
        return Err(AppError::Internal("Session error".to_string()));
    }

    let user_id = user
        .id
        .ok_or_else(|| AppError::Internal("User has no ID".to_string()))?;

    // Create session
    session.insert("user_id", user_id.to_hex()).await.map_err(|e| {
        tracing::error!("Session error: {}", e);
        AppError::Internal("Failed to create session".to_string())
    })?;
    session.insert("role", user.role.clone()).await.map_err(|e| {
        tracing::error!("Session error: {}", e);
        AppError::Internal("Failed to create session".to_string())
    })?;

    Ok(Json(AuthResponse {
        token: "session".to_string(),
        user: UserResponse {
            id: user_id.to_hex(),
            username: user.username,
            role: user.role,
            permissions: None,
        },
    }))
}

async fn logout(session: Session) -> Result<Json<serde_json::Value>> {
    session.delete().await.map_err(|e| {
        tracing::error!("Session error: {}", e);
        AppError::Internal("Failed to logout".to_string())
    })?;
    Ok(Json(serde_json::json!({ "success": true })))
}

async fn get_me(
    state: State<Arc<AppState>>,
    AuthUser { id, .. }: AuthUser,
) -> Result<Json<UserResponse>> {
    let collection = state.db.collection::<User>("users");

    let user_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    let user = collection
        .find_one(bson::doc! { "_id": user_id }, None)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(Json(UserResponse::from(user)))
}

async fn update_profile(
    state: State<Arc<AppState>>,
    AuthUser { id, .. }: AuthUser,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<UserResponse>> {
    let collection = state.db.collection::<User>("users");

    let user_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    let mut user = collection
        .find_one(bson::doc! { "_id": user_id }, None)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    // Update username if provided
    if let Some(new_username) = &payload.username {
        if new_username != &user.username {
            // Check if username is taken
            let existing = collection
                .find_one(bson::doc! { "username": new_username }, None)
                .await
                .map_err(AppError::Database)?;

            if existing.is_some() {
                return Err(AppError::BadRequest("Username already taken".to_string()));
            }

            user.username = new_username.clone();
        }
    }

    // Update password if provided
    if let Some(new_password) = &payload.new_password {
        let current_password = payload
            .current_password
            .as_ref()
            .ok_or_else(|| {
                AppError::BadRequest("Current password is required to set a new password".to_string())
            })?;

        let is_valid = bcrypt::verify(current_password, &user.password)
            .map_err(|e| AppError::Internal(format!("Password verification failed: {}", e)))?;

        if !is_valid {
            return Err(AppError::BadRequest("Invalid current password".to_string()));
        }

        // Use cost 10 to match Node.js bcryptjs
        user.password = bcrypt::hash(new_password, 10)
            .map_err(|e| AppError::Internal(format!("Password hashing failed: {}", e)))?;
    }

    // Save updates
    collection
        .replace_one(bson::doc! { "_id": user_id }, &user, None)
        .await
        .map_err(AppError::Database)?;

    Ok(Json(UserResponse {
        id: user_id.to_hex(),
        username: user.username,
        role: user.role,
        permissions: None,
    }))
}

async fn has_admin(State(state): State<Arc<AppState>>) -> Result<Json<serde_json::Value>> {
    let collection = state.db.collection::<User>("users");

    let count = collection
        .count_documents(bson::doc! { "role": "admin" }, None)
        .await
        .map_err(AppError::Database)?;

    Ok(Json(serde_json::json!({ "hasAdmin": count > 0 })))
}
