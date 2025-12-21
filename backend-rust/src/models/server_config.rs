use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ServerType {
    #[default]
    Vanilla,
    Paper,
    Purpur,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    #[serde(default = "default_name")]
    pub name: String,
    #[serde(default = "default_ram")]
    pub ram: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(rename = "type", default)]
    pub server_type: ServerType,
    #[serde(default)]
    pub gofile_token: String,
    #[serde(default = "default_java_version")]
    pub java_version: u8,
}

fn default_name() -> String {
    "main-server".to_string()
}

fn default_ram() -> String {
    "4GB".to_string()
}

fn default_port() -> u16 {
    25565
}

fn default_version() -> String {
    "1.20.4".to_string()
}

fn default_java_version() -> u8 {
    21
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            name: default_name(),
            ram: default_ram(),
            port: default_port(),
            version: default_version(),
            server_type: ServerType::default(),
            gofile_token: String::new(),
            java_version: default_java_version(),
        }
    }
}

/// Server status response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub status: String,
    pub total_mem: u64,
    pub is_installed: bool,
    pub is_locked: bool,
    #[serde(flatten)]
    pub config: ServerConfig,
}

/// System stats for real-time monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu: f32,
    pub cores: usize,
    pub ram: RamStats,
    pub storage: StorageStats,
    pub network: NetworkStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RamStats {
    pub total: u64,
    pub used: u64,
    pub free: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStats {
    pub total: u64,
    pub used: u64,
    pub free: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkStats {
    pub rx: u64,
    pub tx: u64,
}

impl Default for NetworkStats {
    fn default() -> Self {
        Self { rx: 0, tx: 0 }
    }
}
