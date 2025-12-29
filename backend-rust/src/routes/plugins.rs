use std::sync::Arc;

use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;

use crate::{
    error::Result,
    middleware::{AuthUser, PermissionGuard},
    services::{InstallResult, PluginInfo},
    state::AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/search", get(search_plugins))
        .route("/install", post(install_plugin))
}

#[derive(Debug, Deserialize)]
struct SearchQuery {
    #[serde(default)]
    query: String, // Changed from q to query directly
    #[serde(default = "default_limit")]
    limit: usize,
}

fn default_limit() -> usize {
    10
}

async fn search_plugins(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    axum::extract::Query(params): axum::extract::Query<SearchQuery>,
) -> Result<Json<Vec<PluginInfo>>> {
    PermissionGuard::check(&state, &auth_user, "plugins.view").await?;
    
    // Use params.query instead of params.q
    let results = state.plugin.search(&params.query, params.limit).await?;
    Ok(Json(results))
}

#[derive(Debug, Deserialize)]
struct InstallRequest {
    source: String,
    #[serde(alias = "projectId")]
    id: String,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    loaders: Vec<String>,
}

async fn install_plugin(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(payload): Json<InstallRequest>,
) -> Result<Json<InstallResult>> {
    PermissionGuard::check(&state, &auth_user, "plugins.install").await?;
    
    let loaders = if payload.loaders.is_empty() {
        vec!["paper".to_string(), "bukkit".to_string(), "spigot".to_string()]
    } else {
        payload.loaders
    };
    
    let version_str = payload.version.unwrap_or_default();
    
    let result = state
        .plugin
        .install(&payload.source, &payload.id, &version_str, &loaders)
        .await?;
    
    Ok(Json(result))
}
