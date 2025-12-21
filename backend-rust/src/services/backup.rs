use std::{path::PathBuf, sync::Arc, time::Duration};

use chrono::Utc;
use mongodb::Database;
use parking_lot::RwLock;
use rand::Rng;
use tokio::process::Command;
use tokio_cron_scheduler::{Job, JobScheduler};

use crate::{
    config::CONFIG,
    error::{AppError, Result},
    models::{Backup, BackupConfig, Settings},
    services::MinecraftService,
};

pub struct BackupService {
    db: Database,
    minecraft: Arc<MinecraftService>,
    is_in_progress: RwLock<bool>,
    scheduler: RwLock<Option<JobScheduler>>,
}

impl BackupService {
    pub fn new(db: Database, minecraft: Arc<MinecraftService>) -> Self {
        Self {
            db,
            minecraft,
            is_in_progress: RwLock::new(false),
            scheduler: RwLock::new(None),
        }
    }

    pub fn is_backup_in_progress(&self) -> bool {
        *self.is_in_progress.read()
    }

    async fn get_guest_token(&self) -> Result<String> {
        let client = reqwest::Client::new();
        let response: serde_json::Value = client
            .post("https://api.gofile.io/accounts")
            .header("Content-Type", "application/json")
            .body("{}")
            .send()
            .await
            .map_err(|e| AppError::Request(e))?
            .json()
            .await
            .map_err(|e| AppError::Request(e))?;

        if response["status"].as_str() == Some("ok") {
            response["data"]["token"]
                .as_str()
                .map(|s| s.to_string())
                .ok_or_else(|| AppError::Internal("Failed to get guest token".to_string()))
        } else {
            Err(AppError::Internal("Failed to create guest account".to_string()))
        }
    }

    fn generate_password(&self) -> String {
        // Use only alphanumeric characters to avoid shell escaping issues
        const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let mut rng = rand::thread_rng();
        (0..32)
            .map(|_| CHARS[rng.gen_range(0..CHARS.len())] as char)
            .collect()
    }

    pub async fn perform_backup(&self, manual_trigger: bool, notes: Option<String>) -> Result<Backup> {
        if *self.is_in_progress.read() {
            return Err(AppError::Conflict("Backup already in progress".to_string()));
        }

        // Get token from server config or generate guest token
        let config = self.minecraft.get_config();
        let token = if !config.gofile_token.is_empty() {
            config.gofile_token.clone()
        } else {
            tracing::info!("[BackupService] No API token found. Generating guest token...");
            self.get_guest_token().await?
        };

        let server_dir = self.minecraft.server_dir();
        if !server_dir.exists() {
            return Err(AppError::BadRequest("Server directory not found".to_string()));
        }

        *self.is_in_progress.write() = true;

        let timestamp = Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
        let suffix = if manual_trigger { "-manual" } else { "-auto" };
        let backup_name = format!("backup-{}{}.zip", timestamp, suffix);
        
        // Auto-generate notes for auto backups if not provided
        let final_notes = notes.or_else(|| {
            if !manual_trigger {
                Some(format!("Auto backup - {}", Utc::now().format("%Y-%m-%d %H:%M")))
            } else {
                None
            }
        });

        // Convert relative temp path to absolute
        let temp_dir = {
            let path = PathBuf::from(&CONFIG.temp_backup_path);
            if path.is_relative() {
                std::env::current_dir()
                    .map(|cwd| cwd.join(&path))
                    .unwrap_or(path)
            } else {
                path
            }
        };
        if !temp_dir.exists() {
            tokio::fs::create_dir_all(&temp_dir)
                .await
                .map_err(|e| AppError::Io(e))?;
        }

        let temp_zip_path = temp_dir.join(&backup_name);
        let encryption_password = self.generate_password();

        let result = self.do_backup(
            server_dir,
            &temp_zip_path,
            &encryption_password,
            &token,
            &backup_name,
            final_notes,
        ).await;

        // Cleanup temp file
        if temp_zip_path.exists() {
            let _ = tokio::fs::remove_file(&temp_zip_path).await;
        }

        *self.is_in_progress.write() = false;

        result
    }

    async fn do_backup(
        &self,
        server_dir: &PathBuf,
        temp_zip_path: &PathBuf,
        encryption_password: &str,
        token: &str,
        backup_name: &str,
        notes: Option<String>,
    ) -> Result<Backup> {
        tracing::info!("[BackupService] Starting backup: {}", backup_name);
        tracing::info!("[BackupService] Server dir: {}", server_dir.display());
        tracing::info!("[BackupService] Temp zip path: {}", temp_zip_path.display());

        // Create encrypted zip
        let zip_cmd = format!(
            "zip -r -q -P \"{}\" \"{}\" .",
            encryption_password,
            temp_zip_path.display()
        );
        
        tracing::info!("[BackupService] Running zip command in: {}", server_dir.display());

        let output = Command::new("sh")
            .arg("-c")
            .arg(&zip_cmd)
            .current_dir(server_dir)
            .output()
            .await
            .map_err(|e| {
                tracing::error!("[BackupService] Failed to execute zip command: {}", e);
                AppError::Process(format!("Zip command failed: {}", e))
            })?;

        tracing::info!("[BackupService] Zip exit status: {}", output.status);
        if !output.stdout.is_empty() {
            tracing::info!("[BackupService] Zip stdout: {}", String::from_utf8_lossy(&output.stdout));
        }
        if !output.stderr.is_empty() {
            tracing::warn!("[BackupService] Zip stderr: {}", String::from_utf8_lossy(&output.stderr));
        }

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Check if it's just a warning
            if !temp_zip_path.exists() {
                tracing::error!("[BackupService] Zip failed and file doesn't exist: {}", stderr);
                return Err(AppError::Process(format!("Zip failed: {}", stderr)));
            }
            tracing::warn!("[BackupService] Zip completed with warnings: {}", stderr);
        }

        // Get file size
        let metadata = tokio::fs::metadata(&temp_zip_path)
            .await
            .map_err(|e| AppError::Io(e))?;
        let file_size = format!("{:.2} MB", metadata.len() as f64 / (1024.0 * 1024.0));

        tracing::info!("[BackupService] Uploading to GoFile...");

        // Upload using curl (more reliable for large files)
        let curl_cmd = format!(
            "curl -s -X POST https://upload.gofile.io/uploadfile -H \"Authorization: Bearer {}\" -F \"file=@{}\"",
            token,
            temp_zip_path.display()
        );

        let output = Command::new("sh")
            .arg("-c")
            .arg(&curl_cmd)
            .output()
            .await
            .map_err(|e| AppError::Process(format!("Curl upload failed: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Process(format!("Upload failed: {}", stderr)));
        }

        let response: serde_json::Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| AppError::Internal(format!("Invalid GoFile response: {}", e)))?;

        if response["status"].as_str() != Some("ok") {
            return Err(AppError::Internal(format!("GoFile error: {}", response)));
        }

        let file_name = response["data"]["fileName"]
            .as_str()
            .unwrap_or(backup_name)
            .to_string();
        let download_page = response["data"]["downloadPage"]
            .as_str()
            .ok_or_else(|| AppError::Internal("Missing download page".to_string()))?
            .to_string();

        // Save to database
        let backup = Backup::new(
            file_name.clone(),
            download_page,
            Some(file_size),
            Some(encryption_password.to_string()),
            notes,
        );

        let collection = self.db.collection::<Backup>("backups");
        collection
            .insert_one(&backup, None)
            .await
            .map_err(AppError::Database)?;

        tracing::info!("[BackupService] Backup success: {}", file_name);

        Ok(backup)
    }

    pub async fn init_scheduler(self: Arc<Self>) -> Result<()> {
        tracing::info!("[BackupService] Initializing Scheduler...");

        let settings = self.get_settings().await?;
        self.apply_schedule(&settings).await?;

        Ok(())
    }

    pub async fn apply_schedule(self: &Arc<Self>, config: &BackupConfig) -> Result<()> {
        // Stop existing scheduler - take it out of the lock first
        let existing_scheduler = self.scheduler.write().take();
        if let Some(mut scheduler) = existing_scheduler {
            scheduler.shutdown().await.ok();
        }

        if !config.enabled {
            tracing::info!("[BackupService] Auto-backup is disabled.");
            return Ok(());
        }

        // Validate cron expression (basic check)
        let cron_parts: Vec<&str> = config.cron_expression.split_whitespace().collect();
        if cron_parts.len() < 5 {
            return Err(AppError::BadRequest(format!(
                "Invalid cron expression: {}",
                config.cron_expression
            )));
        }

        tracing::info!(
            "[BackupService] Scheduled auto-backup: {} ({})",
            config.cron_expression,
            config.frequency
        );

        let scheduler = JobScheduler::new()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to create scheduler: {}", e)))?;

        let service = self.clone();
        let cron_expr = config.cron_expression.clone();

        let job = Job::new_async(cron_expr.as_str(), move |_uuid, _lock| {
            let service = service.clone();
            Box::pin(async move {
                tracing::info!("[BackupService] Triggering auto-backup...");
                if let Err(e) = service.perform_backup(false, None).await {
                    tracing::error!("[BackupService] Auto-backup failure: {}", e);
                }
            })
        })
        .map_err(|e| AppError::Internal(format!("Failed to create job: {}", e)))?;

        scheduler
            .add(job)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to add job: {}", e)))?;

        scheduler
            .start()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to start scheduler: {}", e)))?;

        // Store the new scheduler
        *self.scheduler.write() = Some(scheduler);

        Ok(())
    }

    pub async fn get_settings(&self) -> Result<BackupConfig> {
        let collection = self.db.collection::<Settings>("settings");
        
        let setting = collection
            .find_one(bson::doc! { "key": "backup_config" }, None)
            .await
            .map_err(AppError::Database)?;

        match setting {
            Some(s) => s.get_value().map_err(|e| AppError::Internal(e.to_string())),
            None => Ok(BackupConfig::default()),
        }
    }

    pub async fn save_settings(self: &Arc<Self>, new_config: BackupConfig) -> Result<BackupConfig> {
        // Validate cron if enabled
        if new_config.enabled {
            let parts: Vec<&str> = new_config.cron_expression.split_whitespace().collect();
            if parts.len() < 5 {
                return Err(AppError::BadRequest("Invalid cron expression".to_string()));
            }
        }

        let settings = Settings::new("backup_config".to_string(), &new_config)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let collection = self.db.collection::<Settings>("settings");
        
        let options = mongodb::options::ReplaceOptions::builder()
            .upsert(true)
            .build();
        collection
            .replace_one(bson::doc! { "key": "backup_config" }, &settings, options)
            .await
            .map_err(AppError::Database)?;

        self.apply_schedule(&new_config).await?;

        Ok(new_config)
    }

    pub async fn get_all_backups(&self) -> Result<Vec<Backup>> {
        use mongodb::options::FindOptions;
        let collection = self.db.collection::<Backup>("backups");
        
        use futures::TryStreamExt;
        let options = FindOptions::builder()
            .sort(bson::doc! { "createdAt": -1 })
            .build();
        let cursor = collection
            .find(bson::doc! {}, options)
            .await
            .map_err(AppError::Database)?;

        cursor.try_collect().await.map_err(AppError::Database)
    }

    pub async fn delete_backup(&self, id: &str) -> Result<()> {
        let collection = self.db.collection::<Backup>("backups");
        
        use bson::oid::ObjectId;
        let object_id = ObjectId::parse_str(id)
            .map_err(|_| AppError::BadRequest("Invalid backup ID".to_string()))?;

        let result = collection
            .delete_one(bson::doc! { "_id": object_id }, None)
            .await
            .map_err(AppError::Database)?;

        if result.deleted_count == 0 {
            return Err(AppError::NotFound("Backup not found".to_string()));
        }

        Ok(())
    }

    pub async fn update_notes(&self, id: &str, notes: Option<String>) -> Result<()> {
        let collection = self.db.collection::<Backup>("backups");
        
        use bson::oid::ObjectId;
        let object_id = ObjectId::parse_str(id)
            .map_err(|_| AppError::BadRequest("Invalid backup ID".to_string()))?;

        let update = if let Some(n) = notes {
            bson::doc! { "$set": { "notes": n } }
        } else {
            bson::doc! { "$unset": { "notes": "" } }
        };

        let result = collection
            .update_one(bson::doc! { "_id": object_id }, update, None)
            .await
            .map_err(AppError::Database)?;

        if result.matched_count == 0 {
            return Err(AppError::NotFound("Backup not found".to_string()));
        }

        Ok(())
    }

    pub async fn get_backup_by_id(&self, id: &str) -> Result<Backup> {
        let collection = self.db.collection::<Backup>("backups");
        
        use bson::oid::ObjectId;
        let object_id = ObjectId::parse_str(id)
            .map_err(|_| AppError::BadRequest("Invalid backup ID".to_string()))?;

        collection
            .find_one(bson::doc! { "_id": object_id }, None)
            .await
            .map_err(AppError::Database)?
            .ok_or_else(|| AppError::NotFound("Backup not found".to_string()))
    }

    pub async fn restore_backup(&self, backup: &Backup) -> Result<()> {
        if *self.is_in_progress.read() {
            return Err(AppError::Conflict("A backup or restore operation is already in progress.".to_string()));
        }

        *self.is_in_progress.write() = true;
        self.minecraft.set_operation_locked(true);

        let result = self.do_restore(backup).await;

        *self.is_in_progress.write() = false;
        self.minecraft.set_operation_locked(false);

        result
    }

    async fn do_restore(&self, backup: &Backup) -> Result<()> {
        tracing::info!("Starting restore for {}...", backup.file_name);

        // Stop server if running
        let status = self.minecraft.get_status();
        if status.status != "offline" {
            tracing::info!("Stopping server for restore...");
            self.minecraft.stop().await?;

            // Wait for server to stop
            for _ in 0..30 {
                tokio::time::sleep(Duration::from_secs(1)).await;
                if self.minecraft.get_status().status == "offline" {
                    break;
                }
            }

            if self.minecraft.get_status().status != "offline" {
                return Err(AppError::Process("Failed to stop server. Restore aborted.".to_string()));
            }
        }

        let server_dir = self.minecraft.server_dir();

        // Wipe server directory
        tracing::info!("Wiping server directory...");
        if server_dir.exists() {
            tokio::fs::remove_dir_all(&server_dir)
                .await
                .map_err(|e| AppError::Io(e))?;
            tokio::fs::create_dir_all(&server_dir)
                .await
                .map_err(|e| AppError::Io(e))?;
        }

        // Download from GoFile
        tracing::info!("Starting GoFile download for: {}", backup.download_page);

        let token = self.get_guest_token().await?;
        
        // Parse content ID from download page URL
        let content_id = backup.download_page
            .split('/')
            .last()
            .ok_or_else(|| AppError::BadRequest("Invalid download page URL".to_string()))?;

        // Fetch folder data
        let client = reqwest::Client::new();
        let url = format!("https://api.gofile.io/contents/{}?cache=true", content_id);
        
        let response: serde_json::Value = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Cookie", format!("accountToken={}", token))
            .header("User-Agent", "ObsidianPanel/1.0")
            .header("X-Website-Token", "4fd6sg89d7s6")
            .send()
            .await
            .map_err(|e| AppError::Request(e))?
            .json()
            .await
            .map_err(|e| AppError::Request(e))?;

        if response["status"].as_str() != Some("ok") {
            return Err(AppError::Internal(format!("GoFile API Error: {}", response["status"])));
        }

        let children = response["data"]["children"]
            .as_object()
            .ok_or_else(|| AppError::Internal("No files found in this content ID".to_string()))?;

        let target_file = children
            .values()
            .find_map(|f| {
                if f["name"].as_str() == Some(&backup.file_name) {
                    f["link"].as_str().map(|s| s.to_string())
                } else {
                    None
                }
            })
            .ok_or_else(|| AppError::NotFound(format!("File {} not found in GoFile folder", backup.file_name)))?;

        // Download the file
        let temp_dir = PathBuf::from(&CONFIG.temp_backup_path);
        if !temp_dir.exists() {
            tokio::fs::create_dir_all(&temp_dir).await.ok();
        }

        let download_path = temp_dir.join(format!("restore-{}", backup.file_name));

        let response = client
            .get(&target_file)
            .header("Cookie", format!("accountToken={}", token))
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "ObsidianPanel/1.0")
            .send()
            .await
            .map_err(|e| AppError::Request(e))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!("Download failed: {}", response.status())));
        }

        // Write to file
        let bytes = response.bytes().await.map_err(|e| AppError::Request(e))?;
        tokio::fs::write(&download_path, &bytes)
            .await
            .map_err(|e| AppError::Io(e))?;

        // Unzip
        let unzip_cmd = if let Some(ref password) = backup.encryption_password {
            format!(
                "unzip -o -q -P \"{}\" \"{}\" -d \"{}\"",
                password,
                download_path.display(),
                server_dir.display()
            )
        } else {
            format!(
                "unzip -o -q \"{}\" -d \"{}\"",
                download_path.display(),
                server_dir.display()
            )
        };

        let output = Command::new("sh")
            .arg("-c")
            .arg(&unzip_cmd)
            .output()
            .await
            .map_err(|e| AppError::Process(format!("Unzip failed: {}", e)))?;

        // Cleanup download
        let _ = tokio::fs::remove_file(&download_path).await;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Process(format!("Unzip failed: {}", stderr)));
        }

        // Write eula.txt if jar exists
        let jar_file = self.minecraft.jar_file();
        if jar_file.exists() {
            let eula_path = server_dir.join("eula.txt");
            tokio::fs::write(&eula_path, "eula=true").await.ok();
        } else {
            tracing::warn!("Warning: Server JAR missing after restore. You may need to reinstall version.");
        }

        tracing::info!("Restore completed successfully");
        Ok(())
    }
}
