use std::env;

use once_cell::sync::Lazy;

pub static CONFIG: Lazy<Config> = Lazy::new(Config::from_env);

#[derive(Debug, Clone)]
pub struct Config {
    #[allow(dead_code)]
    pub host: String,
    pub port: u16,
    pub mongo_uri: String,
    pub mongo_db_name: String,

    pub mc_server_base_path: String,
    pub temp_backup_path: String,

}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "5000".to_string())
                .parse()
                .expect("PORT must be a valid number"),
            mongo_uri: env::var("MONGO_URI")
                .unwrap_or_else(|_| "mongodb://localhost:27017".to_string()),
            mongo_db_name: env::var("MONGO_DB_NAME")
                .unwrap_or_else(|_| "obsidian_panel".to_string()),

            mc_server_base_path: env::var("MC_SERVER_BASE_PATH")
                .unwrap_or_else(|_| "/minecraft_server".to_string()),
            temp_backup_path: env::var("TEMP_BACKUP_PATH")
                .unwrap_or_else(|_| "/tmp/obsidian_backups".to_string()),

        }
    }
}
