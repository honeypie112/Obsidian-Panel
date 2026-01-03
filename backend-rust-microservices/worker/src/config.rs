use once_cell::sync::Lazy;
use std::env;

pub struct Config {
    pub mongo_uri: String,
    pub mongo_db_name: String,
    pub req_bind_addr: String,
    pub pull_bind_addr: String,
    pub pub_bind_addr: String,
}

pub static CONFIG: Lazy<Config> = Lazy::new(|| {
    Config {
        mongo_uri: env::var("MONGO_URI")
            .unwrap_or_else(|_| "mongodb://localhost:27017".to_string()),
        mongo_db_name: env::var("MONGO_DB_NAME")
            .unwrap_or_else(|_| "obsidian_panel".to_string()),
        req_bind_addr: env::var("REQ_BIND_ADDR")
            .unwrap_or_else(|_| "tcp://0.0.0.0:5555".to_string()),
        pull_bind_addr: env::var("PULL_BIND_ADDR")
            .unwrap_or_else(|_| "tcp://0.0.0.0:5556".to_string()),
        pub_bind_addr: env::var("PUB_BIND_ADDR")
            .unwrap_or_else(|_| "tcp://0.0.0.0:5557".to_string()),
    }
});
