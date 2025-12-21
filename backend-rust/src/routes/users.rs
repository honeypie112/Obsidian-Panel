use std::sync::Arc;

use axum::{
    extract::{Path, State},
    routing::{delete, get, post, put},
    Json, Router,
};
use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

use crate::{
    error::{AppError, Result},
    middleware::{AuthUser, PermissionGuard},
    models::{User, UserRole},
    state::AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_users))
        .route("/:id", get(get_user))
        .route("/:id", put(update_user))
        .route("/:id", delete(delete_user))
        .route("/", post(create_user))
}

#[derive(Debug, Serialize)]
struct UserListItem {
    id: String,
    username: String,
    role: UserRole,
    permissions: Vec<String>,
    #[serde(rename = "createdAt")]
    created_at: String,
}

async fn list_users(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
) -> Result<Json<Vec<UserListItem>>> {
    PermissionGuard::check(&state, &auth_user, "users.view").await?;

    let collection = state.db.collection::<User>("users");
    
    use futures::TryStreamExt;
    let cursor = collection
        .find(bson::doc! {}, None)
        .await
        .map_err(AppError::Database)?;

    let users: Vec<User> = cursor.try_collect().await.map_err(AppError::Database)?;

    let items = users
        .into_iter()
        .map(|u| UserListItem {
            id: u.id.map(|id| id.to_hex()).unwrap_or_default(),
            username: u.username,
            role: u.role,
            permissions: u.permissions,
            created_at: u.created_at.try_to_rfc3339_string().unwrap_or_default(),
        })
        .collect();

    Ok(Json(items))
}

async fn get_user(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<UserListItem>> {
    PermissionGuard::check(&state, &auth_user, "users.view").await?;

    let collection = state.db.collection::<User>("users");
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    let user = collection
        .find_one(bson::doc! { "_id": object_id }, None)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(Json(UserListItem {
        id: user.id.map(|id| id.to_hex()).unwrap_or_default(),
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        created_at: user.created_at.try_to_rfc3339_string().unwrap_or_default(),
    }))
}

#[derive(Debug, Deserialize)]
struct CreateUserRequest {
    username: String,
    password: String,
    role: UserRole,
    #[serde(default)]
    permissions: Vec<String>,
}

async fn create_user(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<serde_json::Value>> {
    // Only admin can create users
    if auth_user.role != UserRole::Admin {
        return Err(AppError::Forbidden("Only admins can create users".to_string()));
    }

    let collection = state.db.collection::<User>("users");

    // Check if username exists
    let existing = collection
        .find_one(bson::doc! { "username": &payload.username }, None)
        .await
        .map_err(AppError::Database)?;

    if existing.is_some() {
        return Err(AppError::BadRequest("Username already exists".to_string()));
    }

    // Use cost 10 to match Node.js bcryptjs
    let password_hash = bcrypt::hash(&payload.password, 10)
        .map_err(|e| AppError::Internal(format!("Password hashing failed: {}", e)))?;

    let mut user = User::new(payload.username.clone(), password_hash, payload.role.clone());
    user.permissions = if payload.role == UserRole::SubAdmin {
        payload.permissions.clone()
    } else {
        vec![]
    };

    let result = collection
        .insert_one(&user, None)
        .await
        .map_err(AppError::Database)?;

    let user_id = result.inserted_id.as_object_id()
        .map(|id| id.to_hex())
        .unwrap_or_default();

    Ok(Json(serde_json::json!({
        "id": user_id,
        "username": user.username,
        "role": user.role,
        "permissions": user.permissions
    })))
}

#[derive(Debug, Deserialize)]
struct UpdateUserRequest {
    username: Option<String>,
    password: Option<String>,
    role: Option<UserRole>,
    permissions: Option<Vec<String>>,
}

async fn update_user(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(id): Path<String>,
    Json(payload): Json<UpdateUserRequest>,
) -> Result<Json<serde_json::Value>> {
    // Only admin can update users
    if auth_user.role != UserRole::Admin {
        return Err(AppError::Forbidden("Only admins can modify users".to_string()));
    }

    let collection = state.db.collection::<User>("users");
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    let mut user = collection
        .find_one(bson::doc! { "_id": object_id }, None)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    // Prevent self-demotion (like Node.js)
    if let Some(ref new_role) = payload.role {
        if id == auth_user.id && *new_role != UserRole::Admin {
            return Err(AppError::BadRequest("Cannot demote yourself".to_string()));
        }
    }

    // Update username if provided
    if let Some(username) = payload.username {
        if username != user.username {
            let existing = collection
                .find_one(bson::doc! { "username": &username }, None)
                .await
                .map_err(AppError::Database)?;
            if existing.is_some() {
                return Err(AppError::BadRequest("Username already taken".to_string()));
            }
        }
        user.username = username;
    }

    // Update password if provided (use cost 10 to match Node.js)
    if let Some(password) = payload.password {
        if !password.is_empty() {
            user.password = bcrypt::hash(&password, 10)
                .map_err(|e| AppError::Internal(format!("Password hashing failed: {}", e)))?;
        }
    }

    // Update role if provided
    if let Some(role) = payload.role {
        user.role = role;
    }

    // Update permissions if provided
    if let Some(permissions) = payload.permissions {
        user.permissions = permissions;
    }

    collection
        .replace_one(bson::doc! { "_id": object_id }, &user, None)
        .await
        .map_err(AppError::Database)?;

    Ok(Json(serde_json::json!({
        "id": id,
        "username": user.username,
        "role": user.role,
        "permissions": user.permissions
    })))
}

async fn delete_user(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "users.delete").await?;

    // Only admin can delete users
    if auth_user.role != UserRole::Admin {
        return Err(AppError::Forbidden("Only admins can delete users".to_string()));
    }

    let collection = state.db.collection::<User>("users");
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Prevent self-deletion
    if id == auth_user.id {
        return Err(AppError::BadRequest("Cannot delete yourself".to_string()));
    }

    let result = collection
        .delete_one(bson::doc! { "_id": object_id }, None)
        .await
        .map_err(AppError::Database)?;

    if result.deleted_count == 0 {
        return Err(AppError::NotFound("User not found".to_string()));
    }

    Ok(Json(serde_json::json!({ "success": true })))
}
