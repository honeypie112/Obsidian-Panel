use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

fn default_now() -> bson::DateTime {
    bson::DateTime::now()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Backup {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub file_name: String,
    pub download_page: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub guest_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encryption_password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default = "default_now")]
    pub created_at: bson::DateTime,
}

impl Backup {
    pub fn new(file_name: String, download_page: String, size: Option<String>, encryption_password: Option<String>, notes: Option<String>) -> Self {
        Self {
            id: None,
            file_name,
            download_page,
            guest_token: None,
            size,
            encryption_password,
            notes,
            created_at: bson::DateTime::now(),
        }
    }
}

/// Backup configuration settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_frequency")]
    pub frequency: String,
    #[serde(default = "default_cron")]
    pub cron_expression: String,
    #[serde(default = "default_max_backups")]
    pub max_backups: u32,
}

fn default_frequency() -> String {
    "daily".to_string()
}

fn default_cron() -> String {
    "0 0 * * *".to_string()
}

fn default_max_backups() -> u32 {
    10
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            frequency: default_frequency(),
            cron_expression: default_cron(),
            max_backups: default_max_backups(),
        }
    }
}
