use mongodb::{Client, Database};

use crate::config::CONFIG;

pub struct WorkerState {
    pub db: Database,
}

impl WorkerState {
    pub async fn new() -> anyhow::Result<Self> {
        // Connect to MongoDB
        tracing::info!("Connecting to MongoDB at {}", CONFIG.mongo_uri);
        let client = Client::with_uri_str(&CONFIG.mongo_uri).await?;
        
        // Test connection
        client
            .database("admin")
            .run_command(bson::doc! { "ping": 1 }, None)
            .await?;
        tracing::info!("MongoDB Connected");

        let db = client.database(&CONFIG.mongo_db_name);

        Ok(Self { db })
    }
}
