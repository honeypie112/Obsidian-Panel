use std::sync::Arc;

use mongodb::{Client, Database};
use socketioxide::SocketIo;

use crate::services::{BackupService, MinecraftService, PluginService};

/// Application state shared across all handlers
#[allow(dead_code)]
pub struct AppState {
    pub db: Database,
    pub mongo_client: Client,
    pub minecraft: Arc<MinecraftService>,
    pub backup: Arc<BackupService>,
    pub plugin: Arc<PluginService>,
    pub io: SocketIo,
}

impl AppState {
    pub async fn new(
        mongo_client: Client,
        db_name: &str,
        io: SocketIo,
    ) -> Self {
        let db = mongo_client.database(db_name);
        
        let minecraft = Arc::new(MinecraftService::new(io.clone()));
        let backup = Arc::new(BackupService::new(db.clone(), minecraft.clone()));
        let plugin = Arc::new(PluginService::new(minecraft.clone()));

        Self {
            db,
            mongo_client,
            minecraft,
            backup,
            plugin,
            io,
        }
    }

    /// Initialize database collections and default data
    pub async fn init_database(&self) -> anyhow::Result<()> {
        self.minecraft.init_database(&self.db).await.map_err(|e| anyhow::anyhow!("{}", e))?;
        Ok(())
    }
}
