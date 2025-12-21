use std::sync::Arc;

use axum::{
    extract::{Path, State},
    routing::{delete, get, post},
    Json, Router,
};

use crate::{
    error::Result,
    middleware::{AuthUser, PermissionGuard},
    models::{Backup, BackupConfig},
    state::AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_backups))
        .route("/status", get(get_status))
        .route("/create", post(create_backup))
        .route("/config", get(get_config))
        .route("/config/save", post(save_config))
        .route("/:id", delete(delete_backup))
        .route("/:id/notes", axum::routing::put(update_notes))
        .route("/:id/restore", post(restore_backup))
}

#[derive(serde::Serialize)]
struct BackupStatus {
    #[serde(rename = "isBackupInProgress")]
    is_backup_in_progress: bool,
    #[serde(rename = "isRestoreInProgress")]
    is_restore_in_progress: bool,
}

async fn get_status(
    State(state): State<Arc<AppState>>,
    _: AuthUser,
) -> Result<Json<BackupStatus>> {
    Ok(Json(BackupStatus {
        is_backup_in_progress: state.backup.is_backup_in_progress(),
        is_restore_in_progress: state.backup.is_backup_in_progress(), // Same flag for now
    }))
}

async fn list_backups(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
) -> Result<Json<Vec<Backup>>> {
    PermissionGuard::check(&state, &auth_user, "backups.view").await?;
    
    let backups = state.backup.get_all_backups().await?;
    Ok(Json(backups))
}

#[derive(serde::Deserialize, Default)]
struct CreateBackupRequest {
    notes: Option<String>,
}

async fn create_backup(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    payload: Option<Json<CreateBackupRequest>>,
) -> Result<Json<Backup>> {
    PermissionGuard::check(&state, &auth_user, "backups.create").await?;
    
    let notes = payload.map(|p| p.notes.clone()).flatten();
    let backup = state.backup.perform_backup(true, notes).await?;
    Ok(Json(backup))
}

async fn get_config(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
) -> Result<Json<BackupConfig>> {
    PermissionGuard::check(&state, &auth_user, "backups.settings").await?;
    
    let settings = state.backup.get_settings().await?;
    Ok(Json(settings))
}

async fn save_config(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<BackupConfig>,
) -> Result<Json<BackupConfig>> {
    PermissionGuard::check(&state, &auth_user, "backups.settings").await?;
    
    let settings = state.backup.save_settings(payload).await?;
    Ok(Json(settings))
}

async fn delete_backup(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "backups.delete").await?;
    
    state.backup.delete_backup(&id).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

async fn restore_backup(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "backups.restore").await?;
    
    let backup = state.backup.get_backup_by_id(&id).await?;
    state.backup.restore_backup(&backup).await?;
    
    Ok(Json(serde_json::json!({ 
        "success": true, 
        "message": "Server restored successfully." 
    })))
}

#[derive(serde::Deserialize)]
struct UpdateNotesRequest {
    notes: Option<String>,
}

async fn update_notes(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(id): Path<String>,
    Json(payload): Json<UpdateNotesRequest>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "backups.create").await?;
    
    state.backup.update_notes(&id, payload.notes).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}
