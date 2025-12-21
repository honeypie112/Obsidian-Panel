use std::{path::PathBuf, sync::Arc};

use axum::{
    body::Body,
    extract::{Multipart, State},
    http::{header, StatusCode},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::{
    error::{AppError, Result},
    middleware::{AuthUser, PermissionGuard},
    models::ServerConfig,
    state::AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/status", get(get_status))
        .route("/action", post(server_action))
        .route("/command", post(send_command))
        .route("/install", post(install))
        .route("/config", post(update_config))
        .route("/files/list", post(list_files))
        .route("/files/read", post(read_file))
        .route("/files/save", post(save_file))
        .route("/files/download", post(download_file))
        .route("/files/upload", post(upload_file))
        .route("/files/upload-chunk", post(upload_chunk))
        .route("/files/create", post(create_file))
        .route("/files/extract", post(extract_archive))
        .route("/files/compress", post(compress_files))
        .route("/files/rename", post(rename_file))
        .route("/files/delete", post(delete_file))
}

// Helper to get safe path
fn get_safe_path(server_dir: &PathBuf, req_path: &str) -> Result<PathBuf> {
    let target = server_dir.join(req_path);
    
    // Canonicalize both paths for proper comparison
    let canonical_server = server_dir.canonicalize()
        .map_err(|e| AppError::Io(e))?;
    let canonical_target = target.canonicalize().unwrap_or(target.clone());
    
    // For new files/folders that don't exist yet, check parent
    let path_to_check = if canonical_target.exists() {
        canonical_target.clone()
    } else {
        // For non-existent paths, just join and verify parent is within server_dir
        let parent = target.parent().unwrap_or(&target);
        let canonical_parent = parent.canonicalize().unwrap_or(parent.to_path_buf());
        if !canonical_parent.starts_with(&canonical_server) {
            return Err(AppError::Forbidden("Access denied: Invalid path".to_string()));
        }
        return Ok(target);
    };
    
    if !path_to_check.starts_with(&canonical_server) {
        return Err(AppError::Forbidden("Access denied: Invalid path".to_string()));
    }
    
    Ok(canonical_target)
}

async fn get_status(
    State(state): State<Arc<AppState>>,
    _: AuthUser,
) -> Result<Json<serde_json::Value>> {
    let status = state.minecraft.get_status();
    Ok(Json(serde_json::to_value(status).unwrap()))
}

#[derive(Debug, Deserialize)]
struct ActionRequest {
    action: String,
}

async fn server_action(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<ActionRequest>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "overview.control").await?;

    match payload.action.as_str() {
        "start" => state.minecraft.start().await?,
        "stop" => state.minecraft.stop().await?,
        "restart" => state.minecraft.restart().await?,
        "kill" => state.minecraft.kill().await?,
        _ => return Err(AppError::BadRequest("Invalid action".to_string())),
    }

    let status = state.minecraft.get_status();
    Ok(Json(serde_json::to_value(status).unwrap()))
}

#[derive(Debug, Deserialize)]
struct CommandRequest {
    command: String,
}

async fn send_command(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<CommandRequest>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "console.command").await?;

    if payload.command.is_empty() {
        return Err(AppError::BadRequest("Command required".to_string()));
    }

    state.minecraft.send_command(&payload.command).await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

#[derive(Debug, Deserialize)]
struct InstallRequest {
    version: String,
}

async fn install(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<InstallRequest>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "settings.edit").await?;

    tracing::info!("Install request received. Version: {}", payload.version);
    state.minecraft.install(&payload.version).await?;
    
    Ok(Json(serde_json::json!({ "message": "Installation started" })))
}

async fn update_config(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<ServerConfig>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "settings.edit").await?;

    tracing::info!("Received config update request: {:?}", payload);
    state.minecraft.save_config(&state.db, payload).await?;
    
    let status = state.minecraft.get_status();
    Ok(Json(serde_json::to_value(status).unwrap()))
}

#[derive(Debug, Deserialize)]
struct PathRequest {
    path: Option<String>,
}

#[derive(Debug, Serialize)]
struct FileEntry {
    name: String,
    #[serde(rename = "type")]
    file_type: String,
    size: String,
}

async fn list_files(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<PathRequest>,
) -> Result<Json<Vec<FileEntry>>> {
    PermissionGuard::check(&state, &auth_user, "files.view").await?;

    let server_dir = state.minecraft.server_dir().clone();
    let target_path = get_safe_path(&server_dir, payload.path.as_deref().unwrap_or(""))?;

    if !target_path.exists() {
        return Ok(Json(vec![]));
    }

    let mut entries = Vec::new();
    let mut read_dir = tokio::fs::read_dir(&target_path)
        .await
        .map_err(|e| AppError::Io(e))?;

    while let Some(entry) = read_dir.next_entry().await.map_err(|e| AppError::Io(e))? {
        let metadata = entry.metadata().await.map_err(|e| AppError::Io(e))?;
        let name = entry.file_name().to_string_lossy().to_string();

        let (file_type, size) = if metadata.is_dir() {
            // Just show "folder" for directories without counting
            ("folder".to_string(), "folder".to_string())
        } else {
            let size = metadata.len();
            let size_str = if size < 1024 {
                format!("{} B", size)
            } else if size < 1024 * 1024 {
                format!("{:.1} KB", size as f64 / 1024.0)
            } else {
                format!("{:.1} MB", size as f64 / (1024.0 * 1024.0))
            };
            ("file".to_string(), size_str)
        };

        entries.push(FileEntry {
            name,
            file_type,
            size,
        });
    }

    // Sort: folders first, then alphabetically
    entries.sort_by(|a, b| {
        if a.file_type == b.file_type {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.file_type == "folder" {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(Json(entries))
}

async fn read_file(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<PathRequest>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "files.view").await?;

    let server_dir = state.minecraft.server_dir().clone();
    let target_path = get_safe_path(&server_dir, payload.path.as_deref().unwrap_or(""))?;

    if !target_path.exists() {
        return Err(AppError::NotFound("File not found".to_string()));
    }

    let content = tokio::fs::read_to_string(&target_path)
        .await
        .map_err(|e| AppError::Io(e))?;

    Ok(Json(serde_json::json!({ "content": content })))
}

#[derive(Debug, Deserialize)]
struct SaveFileRequest {
    path: String,
    content: String,
}

async fn save_file(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<SaveFileRequest>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "files.edit").await?;

    let server_dir = state.minecraft.server_dir().clone();
    let target_path = get_safe_path(&server_dir, &payload.path)?;

    tokio::fs::write(&target_path, &payload.content)
        .await
        .map_err(|e| AppError::Io(e))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn download_file(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<PathRequest>,
) -> Result<Response> {
    PermissionGuard::check(&state, &auth_user, "files.view").await?;

    let server_dir = state.minecraft.server_dir().clone();
    let target_path = get_safe_path(&server_dir, payload.path.as_deref().unwrap_or(""))?;

    if !target_path.exists() {
        return Err(AppError::NotFound("File not found".to_string()));
    }

    let file_name = target_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or("download".to_string());

    let content = tokio::fs::read(&target_path)
        .await
        .map_err(|e| AppError::Io(e))?;

    let body = Body::from(content);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", file_name),
        )
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .body(body)
        .unwrap())
}

async fn upload_file(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "files.upload").await?;

    let server_dir = state.minecraft.server_dir().clone();
    let mut target_dir = server_dir.clone();
    let mut file_data: Option<(String, Vec<u8>)> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::BadRequest(format!("Multipart error: {}", e))
    })? {
        let name = field.name().unwrap_or("").to_string();

        if name == "path" {
            let path = field.text().await.map_err(|e| {
                AppError::BadRequest(format!("Failed to read path: {}", e))
            })?;
            target_dir = get_safe_path(&server_dir, &path)?;
        } else if name == "file" {
            let filename = field
                .file_name()
                .unwrap_or("upload")
                .to_string();
            let data = field.bytes().await.map_err(|e| {
                AppError::BadRequest(format!("Failed to read file: {}", e))
            })?;
            file_data = Some((filename, data.to_vec()));
        }
    }

    if let Some((filename, data)) = file_data {
        let target_path = target_dir.join(&filename);
        tokio::fs::write(&target_path, &data)
            .await
            .map_err(|e| AppError::Io(e))?;
        
        tracing::info!("[Upload] File saved: {}", target_path.display());
        Ok(Json(serde_json::json!({ "success": true })))
    } else {
        Err(AppError::BadRequest("No file uploaded".to_string()))
    }
}

#[derive(Debug, Deserialize)]
struct ChunkUploadMeta {
    path: String,
    #[serde(rename = "fileName")]
    file_name: String,
    #[serde(rename = "chunkIndex")]
    chunk_index: u32,
    #[serde(rename = "totalChunks")]
    total_chunks: u32,
}

async fn upload_chunk(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "files.upload").await?;

    let server_dir = state.minecraft.server_dir().clone();
    let temp_dir = server_dir.join(".temp_uploads");
    
    if !temp_dir.exists() {
        tokio::fs::create_dir_all(&temp_dir)
            .await
            .map_err(|e| AppError::Io(e))?;
    }

    let mut meta: Option<ChunkUploadMeta> = None;
    let mut chunk_data: Option<Vec<u8>> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::BadRequest(format!("Multipart error: {}", e))
    })? {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "path" | "fileName" | "chunkIndex" | "totalChunks" => {
                // Collect form fields for meta
                let value = field.text().await.unwrap_or_default();
                if meta.is_none() {
                    meta = Some(ChunkUploadMeta {
                        path: String::new(),
                        file_name: String::new(),
                        chunk_index: 0,
                        total_chunks: 0,
                    });
                }
                if let Some(ref mut m) = meta {
                    match name.as_str() {
                        "path" => m.path = value,
                        "fileName" => m.file_name = value,
                        "chunkIndex" => m.chunk_index = value.parse().unwrap_or(0),
                        "totalChunks" => m.total_chunks = value.parse().unwrap_or(0),
                        _ => {}
                    }
                }
            }
            "file" => {
                let data = field.bytes().await.map_err(|e| {
                    AppError::BadRequest(format!("Failed to read chunk: {}", e))
                })?;
                chunk_data = Some(data.to_vec());
            }
            _ => {}
        }
    }

    let meta = meta.ok_or_else(|| AppError::BadRequest("Missing chunk metadata".to_string()))?;
    let data = chunk_data.ok_or_else(|| AppError::BadRequest("No chunk uploaded".to_string()))?;

    let part_file = temp_dir.join(format!("{}.part", meta.file_name));

    // Write or append chunk
    if meta.chunk_index == 0 {
        tokio::fs::write(&part_file, &data)
            .await
            .map_err(|e| AppError::Io(e))?;
    } else {
        use tokio::io::AsyncWriteExt;
        let mut file = tokio::fs::OpenOptions::new()
            .append(true)
            .open(&part_file)
            .await
            .map_err(|e| AppError::Io(e))?;
        file.write_all(&data).await.map_err(|e| AppError::Io(e))?;
    }

    // If last chunk, move to final destination
    if meta.chunk_index == meta.total_chunks - 1 {
        let target_dir = get_safe_path(&server_dir, &meta.path)?;
        let target_path = target_dir.join(&meta.file_name);

        tokio::fs::rename(&part_file, &target_path)
            .await
            .map_err(|e| AppError::Io(e))?;

        tracing::info!("[ChunkUpload] Finalized file: {}", target_path.display());
        return Ok(Json(serde_json::json!({ "success": true, "completed": true })));
    }

    Ok(Json(serde_json::json!({ "success": true, "chunkIndex": meta.chunk_index })))
}

#[derive(Debug, Deserialize)]
struct CreateRequest {
    path: String,
    name: String,
    #[serde(rename = "type")]
    item_type: String,
}

async fn create_file(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<CreateRequest>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "files.upload").await?;

    let server_dir = state.minecraft.server_dir().clone();
    let current_dir = get_safe_path(&server_dir, &payload.path)?;
    let target_path = current_dir.join(&payload.name);

    if payload.item_type == "folder" {
        tokio::fs::create_dir(&target_path)
            .await
            .map_err(|e| AppError::Io(e))?;
    } else {
        tokio::fs::write(&target_path, "")
            .await
            .map_err(|e| AppError::Io(e))?;
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn extract_archive(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<PathRequest>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "files.edit").await?;

    let server_dir = state.minecraft.server_dir().clone();
    let target_path = get_safe_path(&server_dir, payload.path.as_deref().unwrap_or(""))?;
    let parent_dir = target_path
        .parent()
        .ok_or_else(|| AppError::BadRequest("Invalid path".to_string()))?;

    let path_str = target_path.to_string_lossy();
    let cmd = if path_str.ends_with(".zip") {
        format!("unzip -o \"{}\" -d \"{}\"", target_path.display(), parent_dir.display())
    } else if path_str.ends_with(".tar.gz") {
        format!("tar -xzf \"{}\" -C \"{}\"", target_path.display(), parent_dir.display())
    } else {
        return Err(AppError::BadRequest("Unsupported archive format".to_string()));
    };

    let output = tokio::process::Command::new("sh")
        .arg("-c")
        .arg(&cmd)
        .output()
        .await
        .map_err(|e| AppError::Process(format!("Extraction failed: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Process(format!(
            "Extraction failed. Ensure unzip/tar is installed. {}",
            stderr
        )));
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

#[derive(Debug, Deserialize)]
struct CompressRequest {
    files: Vec<String>,
    #[serde(rename = "currentPath")]
    current_path: String,
}

async fn compress_files(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<CompressRequest>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "files.edit").await?;

    if payload.files.is_empty() {
        return Err(AppError::BadRequest("No files selected".to_string()));
    }

    let server_dir = state.minecraft.server_dir().clone();
    let current_dir = get_safe_path(&server_dir, &payload.current_path)?;
    let archive_name = format!("archive_{}.zip", chrono::Utc::now().timestamp());

    let file_args: String = payload
        .files
        .iter()
        .map(|f| format!("\"{}\"", f))
        .collect::<Vec<_>>()
        .join(" ");

    let cmd = format!(
        "cd \"{}\" && zip -r \"{}\" {}",
        current_dir.display(),
        archive_name,
        file_args
    );

    let output = tokio::process::Command::new("sh")
        .arg("-c")
        .arg(&cmd)
        .output()
        .await
        .map_err(|e| AppError::Process(format!("Compression failed: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Process(format!(
            "Compression failed. Ensure zip is installed. {}",
            stderr
        )));
    }

    Ok(Json(serde_json::json!({ "success": true, "archiveName": archive_name })))
}

#[derive(Debug, Deserialize)]
struct RenameRequest {
    path: String,
    #[serde(rename = "oldName")]
    old_name: String,
    #[serde(rename = "newName")]
    new_name: String,
}

async fn rename_file(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<RenameRequest>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "files.edit").await?;

    let server_dir = state.minecraft.server_dir().clone();
    let current_dir = get_safe_path(&server_dir, &payload.path)?;
    let old_path = current_dir.join(&payload.old_name);
    let new_path = current_dir.join(&payload.new_name);

    // Security check for new path
    if !new_path.starts_with(&server_dir) {
        return Err(AppError::BadRequest("Invalid new name".to_string()));
    }

    if !old_path.exists() {
        return Err(AppError::NotFound("File not found".to_string()));
    }

    if new_path.exists() {
        return Err(AppError::BadRequest("A file with that name already exists".to_string()));
    }

    tokio::fs::rename(&old_path, &new_path)
        .await
        .map_err(|e| AppError::Io(e))?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn delete_file(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<PathRequest>,
) -> Result<Json<serde_json::Value>> {
    PermissionGuard::check(&state, &auth_user, "files.delete").await?;

    let server_dir = state.minecraft.server_dir().clone();
    let target_path = get_safe_path(&server_dir, payload.path.as_deref().unwrap_or(""))?;

    let metadata = tokio::fs::metadata(&target_path)
        .await
        .map_err(|e| AppError::Io(e))?;

    if metadata.is_dir() {
        tokio::fs::remove_dir_all(&target_path)
            .await
            .map_err(|e| AppError::Io(e))?;
    } else {
        tokio::fs::remove_file(&target_path)
            .await
            .map_err(|e| AppError::Io(e))?;
    }

    Ok(Json(serde_json::json!({ "success": true })))
}
