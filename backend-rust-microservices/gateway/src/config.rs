use once_cell::sync::Lazy;
use std::env;

pub struct Config {
    pub port: u16,
    pub mongo_uri: String,
    pub mongo_db_name: String,
    pub worker_req_endpoint: String,
    pub worker_push_endpoint: String,
    pub worker_sub_endpoint: String,
}

pub static CONFIG: Lazy<Config> = Lazy::new(|| {
    Config {
        port: env::var("PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()
            .expect("PORT must be a number"),
        mongo_uri: env::var("MONGO_URI")
            .unwrap_or_else(|_| "mongodb://localhost:27017".to_string()),
        mongo_db_name: env::var("MONGO_DB_NAME")
            .unwrap_or_else(|_| "obsidian_panel".to_string()),
        worker_req_endpoint: env::var("WORKER_REQ_ENDPOINT")
            .unwrap_or_else(|_| "tcp://worker:5555".to_string()),
        worker_push_endpoint: env::var("WORKER_PUSH_ENDPOINT")
            .unwrap_or_else(|_| "tcp://worker:5556".to_string()),
        worker_sub_endpoint: env::var("WORKER_SUB_ENDPOINT")
            .unwrap_or_else(|_| "tcp://worker:5557".to_string()),
    }
});
