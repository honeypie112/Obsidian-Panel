use std::{
    collections::VecDeque,
    os::unix::fs::PermissionsExt,
    path::PathBuf,
    process::Stdio,
    sync::Arc,
    time::Duration,
};

use mongodb::Database;
use parking_lot::RwLock;
use socketioxide::SocketIo;
use sysinfo::System;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, Command},
    sync::{broadcast, Mutex, Notify},
    time::interval,
};

use crate::{
    config::CONFIG,
    error::{AppError, Result},
    models::{NetworkStats, RamStats, ServerConfig, ServerStatus, ServerType, StorageStats, SystemStats},
};

// RAM Buffer size (Backup ke liye)
const LOG_BUFFER_SIZE: usize = 5000;

#[derive(Debug, Clone, PartialEq)]
pub enum ProcessStatus {
    Offline,
    Starting,
    Online,
    Stopping,
    Installing,
}

impl std::fmt::Display for ProcessStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProcessStatus::Offline => write!(f, "offline"),
            ProcessStatus::Starting => write!(f, "starting"),
            ProcessStatus::Online => write!(f, "online"),
            ProcessStatus::Stopping => write!(f, "stopping"),
            ProcessStatus::Installing => write!(f, "installing"),
        }
    }
}

pub struct MinecraftService {
    server_dir: PathBuf,
    jar_file: PathBuf,
    process: Mutex<Option<Child>>,
    stdin_tx: Mutex<Option<tokio::sync::mpsc::Sender<String>>>,
    status: RwLock<ProcessStatus>,
    config: RwLock<ServerConfig>,
    log_buffer: Arc<RwLock<VecDeque<String>>>,
    is_operation_locked: RwLock<bool>,
    io: SocketIo,
    stop_notify: Notify,
    log_tx: broadcast::Sender<String>,
}

impl MinecraftService {
    pub fn new(io: SocketIo) -> Self {
        let server_dir = PathBuf::from(&CONFIG.mc_server_base_path);
        let jar_file = server_dir.join("server.jar");
        let (log_tx, _) = broadcast::channel(100);

        if !server_dir.exists() {
            std::fs::create_dir_all(&server_dir).ok();
        }

        let service = Self {
            server_dir,
            jar_file,
            process: Mutex::new(None),
            stdin_tx: Mutex::new(None),
            status: RwLock::new(ProcessStatus::Offline),
            config: RwLock::new(ServerConfig::default()),
            log_buffer: Arc::new(RwLock::new(VecDeque::with_capacity(LOG_BUFFER_SIZE))),
            is_operation_locked: RwLock::new(false),
            io,
            stop_notify: Notify::new(),
            log_tx,
        };

        service
    }

    pub fn server_dir(&self) -> &PathBuf {
        &self.server_dir
    }

    pub fn jar_file(&self) -> &PathBuf {
        &self.jar_file
    }

    pub async fn init_database(&self, db: &Database) -> Result<()> {
        let collection = db.collection::<ServerConfig>("server_config");

        let existing = collection
        .find_one(bson::doc! { "name": "main-server" }, None)
        .await
        .map_err(AppError::Database)?;

        if let Some(config) = existing {
            *self.config.write() = config;
            tracing::info!("Loaded ServerConfig from MongoDB");
        } else {
            let default_config = ServerConfig::default();
            collection
            .insert_one(&default_config, None)
            .await
            .map_err(AppError::Database)?;
            *self.config.write() = default_config;
            tracing::info!("Created default ServerConfig in MongoDB");
        }

        Ok(())
    }

    pub async fn save_config(&self, db: &Database, new_config: ServerConfig) -> Result<()> {
        if *self.is_operation_locked.read() {
            return Err(AppError::Locked("Operation locked: Server maintenance in progress.".to_string()));
        }

        let collection = db.collection::<ServerConfig>("server_config");

        let options = mongodb::options::ReplaceOptions::builder()
        .upsert(true)
        .build();
        collection
        .replace_one(bson::doc! { "name": "main-server" }, &new_config, options)
        .await
        .map_err(AppError::Database)?;

        *self.config.write() = new_config;
        tracing::info!("Saved config to MongoDB");

        self.broadcast_status();
        Ok(())
    }

    pub fn get_config(&self) -> ServerConfig {
        self.config.read().clone()
    }

    pub fn get_status(&self) -> ServerStatus {
        let config = self.config.read().clone();
        let status = self.status.read().to_string();
        let is_installed = self.jar_file.exists();
        let is_locked = *self.is_operation_locked.read();
        let mut sys = System::new();
        sys.refresh_memory();

        ServerStatus {
            status,
            total_mem: sys.total_memory(),
            is_installed,
            is_locked,
            config,
        }
    }

    /// Get log history from RAM buffer only (same as Node.js backend)
    pub fn get_log_history(&self) -> Vec<String> {
        let history: Vec<String> = self.log_buffer.read().iter().cloned().collect();
        tracing::info!("[LogHistory] Serving {} logs from RAM buffer", history.len());
        history
    }

    fn push_log(&self, message: &str) {
        let _ = self.io.emit("console_log", message);
        let _ = self.log_tx.send(message.to_string());

        // RAM buffer mein bhi daalo (Backup ke liye)
        let mut buffer = self.log_buffer.write();
        for line in message.lines() {
            if !line.trim().is_empty() {
                buffer.push_back(line.to_string());
                if buffer.len() > LOG_BUFFER_SIZE {
                    buffer.pop_front();
                }
            }
        }
    }

    fn broadcast_status(&self) {
        let status = self.get_status();
        let _ = self.io.emit("status", &status);
    }

    /// Find Java executable for specified version using multiple strategies
    fn get_java_executable(&self, version: u8) -> Option<PathBuf> {
        tracing::info!("[JavaExecutable] Resolving java binary for version: {}", version);

        // Strategy 1: Check environment variable (JAVA_8_HOME, JAVA_17_HOME, etc.)
        let env_var = format!("JAVA_{}_HOME", version);
        if let Ok(java_home) = std::env::var(&env_var) {
            let java_path = PathBuf::from(java_home).join("bin").join("java");
            if java_path.exists() {
                if let Some(verified) = self.verify_java_version(&java_path, version) {
                    tracing::info!("[JavaExecutable] ✓ Found via ${}: {}", env_var, verified.display());
                    return Some(verified);
                }
            }
        }

        // Strategy 2: Scan /usr/lib/jvm/ for matching directories
        if let Ok(entries) = std::fs::read_dir("/usr/lib/jvm") {
            let mut candidates = Vec::new();
            
            for entry in entries.flatten() {
                let dir_name = entry.file_name();
                let name = dir_name.to_string_lossy();
                
                // Match patterns like: java-8-openjdk, java-1.8-openjdk, java-17-openjdk-amd64
                let version_str = version.to_string();
                let legacy_version = if version == 8 { "1.8" } else { &version_str };
                
                if name.contains(&format!("java-{}", version_str)) || 
                   name.contains(&format!("java-{}", legacy_version)) {
                    let java_path = entry.path().join("bin").join("java");
                    if java_path.exists() {
                        candidates.push(java_path);
                    }
                }
            }

            // Verify each candidate and return the first one that matches
            for candidate in candidates {
                if let Some(verified) = self.verify_java_version(&candidate, version) {
                    tracing::info!("[JavaExecutable] ✓ Found via JVM scan: {}", verified.display());
                    return Some(verified);
                }
            }
        }

        // Strategy 3: Try common hardcoded paths as fallback
        let fallback_paths: &[&str] = match version {
            8 => &[
                "/usr/lib/jvm/java-1.8-openjdk/bin/java",
                "/usr/lib/jvm/java-8-openjdk/bin/java",
                "/usr/lib/jvm/java-8-openjdk-amd64/bin/java",
            ],
            17 => &[
                "/usr/lib/jvm/java-17-openjdk/bin/java",
                "/usr/lib/jvm/java-17-openjdk-amd64/bin/java",
            ],
            21 => &[
                "/usr/lib/jvm/java-21-openjdk/bin/java",
                "/usr/lib/jvm/java-21-openjdk-amd64/bin/java",
            ],
            _ => &[],
        };

        for path in fallback_paths {
            let java_path = PathBuf::from(path);
            if java_path.exists() {
                if let Some(verified) = self.verify_java_version(&java_path, version) {
                    tracing::info!("[JavaExecutable] ✓ Found via fallback: {}", verified.display());
                    return Some(verified);
                }
            }
        }

        tracing::error!("[JavaExecutable] ✗ Could not find Java {} anywhere!", version);
        None
    }

    /// Verify that a Java executable is actually the correct version
    fn verify_java_version(&self, java_path: &PathBuf, expected_version: u8) -> Option<PathBuf> {
        use std::process::Command;

        // Run java -version and parse output
        match Command::new(java_path).arg("-version").output() {
            Ok(output) => {
                // java -version outputs to stderr, not stdout
                let version_output = String::from_utf8_lossy(&output.stderr);
                
                // Parse version from output like: "openjdk version "17.0.9" 2023-10-17"
                // or "java version "1.8.0_392""
                let actual_version = self.parse_java_version_output(&version_output);
                
                if actual_version == Some(expected_version) {
                    tracing::debug!("[JavaExecutable] Verified {} is Java {}", java_path.display(), expected_version);
                    return Some(java_path.clone());
                } else {
                    tracing::warn!(
                        "[JavaExecutable] Version mismatch: {} reports Java {:?}, expected {}",
                        java_path.display(),
                        actual_version,
                        expected_version
                    );
                }
            }
            Err(e) => {
                tracing::warn!("[JavaExecutable] Failed to run {}: {}", java_path.display(), e);
            }
        }
        
        None
    }

    /// Parse Java version from `java -version` output
    fn parse_java_version_output(&self, output: &str) -> Option<u8> {
        // Look for patterns like:
        // "1.8.0_392" -> 8
        // "17.0.9" -> 17
        // "21.0.1" -> 21
        
        for line in output.lines() {
            if let Some(start) = line.find("version \"") {
                let version_str = &line[start + 9..];
                if let Some(end) = version_str.find('"') {
                    let version = &version_str[..end];
                    
                    // Handle legacy format "1.8.x" -> 8
                    if version.starts_with("1.8") {
                        return Some(8);
                    }
                    
                    // Handle modern format "17.x.x" -> 17
                    if let Some(major) = version.split('.').next() {
                        if let Ok(ver) = major.parse::<u8>() {
                            return Some(ver);
                        }
                    }
                }
            }
        }
        
        None
    }

    fn parse_ram(&self, ram: &str) -> String {
        let re = regex::Regex::new(r"(\d+)\s*([GgMm])[Bb]?").unwrap();
        if let Some(caps) = re.captures(ram) {
            let val: u32 = caps[1].parse().unwrap_or(4);
            let unit = caps[2].to_uppercase();
            if unit == "G" {
                format!("{}M", val * 1024)
            } else {
                format!("{}M", val)
            }
        } else {
            "4096M".to_string()
        }
    }

    pub async fn start(&self) -> Result<()> {
        {
            let status = self.status.read();
            if *status != ProcessStatus::Offline {
                return Err(AppError::BadRequest("Server is not offline".to_string()));
            }
        }

        if !self.jar_file.exists() {
            return Err(AppError::BadRequest("Server JAR not found. Please install first.".to_string()));
        }

        let config = self.config.read().clone();
        let java_version = config.java_version;

        // Find and verify Java BEFORE changing status
        let java_cmd = match self.get_java_executable(java_version) {
            Some(path) => path,
            None => {
                let error_msg = format!("Java {} binary NOT FOUND on this system!", java_version);
                self.push_log(&format!("[System] ERROR: {}", error_msg));
                return Err(AppError::Process(error_msg));
            }
        };

        // Only change status to Starting after we know Java exists
        *self.status.write() = ProcessStatus::Starting;
        self.broadcast_status();

        self.push_log(&format!("[System] Checking for Java {}...", java_version));
        self.push_log(&format!("[System] Found Java {} at: {}", java_version, java_cmd.display()));

        if std::fs::metadata(&java_cmd)
            .map(|m| m.permissions().mode() & 0o111 == 0)
            .unwrap_or(true)
            {
                return Err(AppError::Process(format!("Java binary at {} is not executable.", java_cmd.display())));
            }

            let max_ram = self.parse_ram(&config.ram);
        let args = vec![
            "-Xms1024M".to_string(),
            format!("-Xmx{}", max_ram),
                "-DTerminal.jline=false".to_string(),
                "-DTerminal.ansi=true".to_string(),
                "-Dlog4j.skipJansi=false".to_string(),
                "-jar".to_string(),
                "server.jar".to_string(),
                "nogui".to_string(),
        ];

        self.push_log("[System] Starting server subprocess...");
        tracing::info!("[Start] FINAL SPAWN CALL: {}", java_cmd.display());

        let mut child = Command::new(&java_cmd)
        .args(&args)
        .current_dir(&self.server_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("TERM", "xterm-256color")
        .env("FORCE_COLOR", "true")
        .spawn()
        .map_err(|e| AppError::Process(format!("Failed to start server: {}", e)))?;

        let stdin = child.stdin.take();
        let (stdin_tx, mut stdin_rx) = tokio::sync::mpsc::channel::<String>(32);
        *self.stdin_tx.lock().await = Some(stdin_tx);

        if let Some(mut stdin) = stdin {
            tokio::spawn(async move {
                while let Some(cmd) = stdin_rx.recv().await {
                    if stdin.write_all(cmd.as_bytes()).await.is_err() {
                        break;
                    }
                    let _ = stdin.flush().await;
                }
            });
        }

        if let Some(stdout) = child.stdout.take() {
            let io = self.io.clone();
            let log_tx = self.log_tx.clone();
            let log_buffer = self.log_buffer.clone();
            let _status = Arc::new(self.status.read().clone());

            tokio::spawn({
                let status_ptr = unsafe {
                    &*(&self.status as *const RwLock<ProcessStatus>)
                };
                let io = io.clone();

                async move {
                    let reader = BufReader::new(stdout);
                    let mut lines = reader.lines();

                    while let Ok(Some(line)) = lines.next_line().await {
                        let _ = io.emit("console_log", &line);
                        let _ = log_tx.send(line.clone());

                        {
                            let mut buffer = log_buffer.write();
                            buffer.push_back(line.clone());
                            if buffer.len() > LOG_BUFFER_SIZE {
                                buffer.pop_front();
                            }
                        }

                        if line.contains("Done") && line.contains("! For help") {
                            *status_ptr.write() = ProcessStatus::Online;
                            let _ = io.emit("status", "online");
                        }
                    }
                }
            });
        }

        if let Some(stderr) = child.stderr.take() {
            let io = self.io.clone();
            let log_tx = self.log_tx.clone();
            let log_buffer = self.log_buffer.clone();

            tokio::spawn(async move {
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();

                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = io.emit("console_log", &line);
                    let _ = log_tx.send(line.clone());

                    {
                        let mut buffer = log_buffer.write();
                        buffer.push_back(line);
                        if buffer.len() > LOG_BUFFER_SIZE {
                            buffer.pop_front();
                        }
                    }
                }
            });
        }

        *self.process.lock().await = Some(child);

        let _stop_notify = &self.stop_notify;
        let _status_ref = &self.status;
        let _io_ref = &self.io;

        tokio::spawn({
            let process = unsafe { &*(&self.process as *const Mutex<Option<Child>>) };
            let status = unsafe { &*(&self.status as *const RwLock<ProcessStatus>) };
            let io = self.io.clone();
            let stop_notify = unsafe { &*(&self.stop_notify as *const Notify) };

            async move {
                loop {
                    tokio::time::sleep(Duration::from_millis(500)).await;

                    let mut guard = process.lock().await;
                    if let Some(ref mut child) = *guard {
                        match child.try_wait() {
                            Ok(Some(exit_status)) => {
                                tracing::info!("Server process exited with: {:?}", exit_status);
                                *status.write() = ProcessStatus::Offline;
                                let _ = io.emit("console_log", format!("Server process exited with code {:?}", exit_status.code()));
                                let _ = io.emit("status", "offline");
                                stop_notify.notify_waiters();
                                *guard = None;
                                break;
                            }
                            Ok(None) => {}
                            Err(e) => {
                                tracing::error!("Error checking process status: {}", e);
                                break;
                            }
                        }
                    } else {
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    pub async fn stop(&self) -> Result<()> {
        let current_status = self.status.read().clone();
        if current_status == ProcessStatus::Offline {
            return Ok(());
        }

        *self.status.write() = ProcessStatus::Stopping;
        self.broadcast_status();

        if let Some(tx) = self.stdin_tx.lock().await.as_ref() {
            let _ = tx.send("stop\n".to_string()).await;
        }

        self.push_log("[System] Stop command sent...");
        Ok(())
    }

    pub async fn kill(&self) -> Result<()> {
        let mut guard = self.process.lock().await;

        if let Some(mut child) = guard.take() {
            child.kill().await.map_err(|e| AppError::Process(format!("Failed to kill process: {}", e)))?;
            tracing::info!("Server process killed successfully.");
        } else {
            tracing::warn!("Kill called but no process found.");
        }

        *self.status.write() = ProcessStatus::Offline;
        self.broadcast_status();
        self.push_log("Server was forcefully killed.");
        self.stop_notify.notify_waiters();
        Ok(())
    }

    pub async fn reset_status(&self) -> Result<()> {
        *self.status.write() = ProcessStatus::Offline;
        self.broadcast_status();
        Ok(())
    }

    pub async fn send_command(&self, command: &str) -> Result<()> {
        let status = self.status.read().clone();
        if status != ProcessStatus::Online {
            return Err(AppError::BadRequest("Server is not online".to_string()));
        }

        if let Some(tx) = self.stdin_tx.lock().await.as_ref() {
            tx.send(format!("{}\n", command))
            .await
            .map_err(|e| AppError::Process(format!("Failed to send command: {}", e)))?;
            self.push_log(&format!("> {}", command));
        }

        Ok(())
    }

    pub async fn restart(&self) -> Result<()> {
        let status = self.status.read().clone();

        if status == ProcessStatus::Offline {
            return self.start().await;
        }

        self.stop().await?;

        let timeout = tokio::time::timeout(
            Duration::from_secs(60),
                                           self.stop_notify.notified()
        ).await;

        if timeout.is_err() {
            return Err(AppError::Process("Restart timed out waiting for server to stop".to_string()));
        }

        tokio::time::sleep(Duration::from_secs(1)).await;

        self.start().await
    }

    pub async fn install(&self, version: &str) -> Result<()> {
        let status = self.status.read().clone();
        if status != ProcessStatus::Offline {
            return Err(AppError::BadRequest("Server must be offline to install/update".to_string()));
        }

        *self.status.write() = ProcessStatus::Installing;
        self.broadcast_status();

        let config = self.config.read().clone();
        let download_url = self.get_version_download_url(version, &config.server_type).await?;

        self.push_log(&format!("[System] Downloading {} version {}...", config.server_type.to_string(), version));

        let client = reqwest::Client::new();
        let response = client
        .get(&download_url)
        .header("User-Agent", "ObsidianPanel/1.0")
        .send()
        .await
        .map_err(|e| AppError::Request(e))?;

        if !response.status().is_success() {
            *self.status.write() = ProcessStatus::Offline;
            self.broadcast_status();
            return Err(AppError::BadRequest(format!("Download failed with status {}", response.status())));
        }

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;

        let mut file = tokio::fs::File::create(&self.jar_file)
        .await
        .map_err(|e| AppError::Io(e))?;

        let mut stream = response.bytes_stream();
        use futures::StreamExt;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| AppError::Request(e))?;
            tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|e| AppError::Io(e))?;

            downloaded += chunk.len() as u64;
            if total_size > 0 {
                let percent = (downloaded as f64 / total_size as f64) * 100.0;
                let _ = self.io.emit("install_progress", percent);
            }
        }

        let eula_path = self.server_dir.join("eula.txt");
        tokio::fs::write(&eula_path, "eula=true")
        .await
        .map_err(|e| AppError::Io(e))?;

        *self.status.write() = ProcessStatus::Offline;
        self.broadcast_status();
        self.push_log("[System] Installation complete!");

        Ok(())
    }

    async fn get_version_download_url(&self, version: &str, server_type: &ServerType) -> Result<String> {
        let client = reqwest::Client::new();

        match server_type {
            ServerType::Paper => self.get_paper_url(&client, version).await,
            ServerType::Purpur => self.get_purpur_url(version),
            ServerType::Vanilla => self.get_vanilla_url(&client, version).await,
        }
    }

    async fn get_paper_url(&self, client: &reqwest::Client, version: &str) -> Result<String> {
        let url = format!("https://api.papermc.io/v2/projects/paper/versions/{}/builds", version);

        let response: serde_json::Value = client
        .get(&url)
        .header("User-Agent", "ObsidianPanel/1.0")
        .send()
        .await
        .map_err(|e| AppError::Request(e))?
        .json()
        .await
        .map_err(|e| AppError::Request(e))?;

        let builds = response["builds"]
        .as_array()
        .ok_or_else(|| AppError::BadRequest(format!("No Paper builds found for version {}", version)))?;

        let latest = builds
        .last()
        .ok_or_else(|| AppError::BadRequest(format!("No Paper builds found for version {}", version)))?;

        let build_num = latest["build"].as_i64().unwrap_or(0);
        let file_name = latest["downloads"]["application"]["name"]
        .as_str()
        .unwrap_or("paper.jar");

        Ok(format!(
            "https://api.papermc.io/v2/projects/paper/versions/{}/builds/{}/downloads/{}",
            version, build_num, file_name
        ))
    }

    fn get_purpur_url(&self, version: &str) -> Result<String> {
        Ok(format!("https://api.purpurmc.org/v2/purpur/{}/latest/download", version))
    }

    async fn get_vanilla_url(&self, client: &reqwest::Client, version: &str) -> Result<String> {
        let manifest: serde_json::Value = client
        .get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
        .header("User-Agent", "ObsidianPanel/1.0")
        .send()
        .await
        .map_err(|e| AppError::Request(e))?
        .json()
        .await
        .map_err(|e| AppError::Request(e))?;

        let versions = manifest["versions"]
        .as_array()
        .ok_or_else(|| AppError::Internal("Invalid manifest format".to_string()))?;

        let version_entry = versions
        .iter()
        .find(|v| v["id"].as_str() == Some(version))
        .ok_or_else(|| AppError::BadRequest(format!("Version {} not found in Mojang manifest", version)))?;

        let package_url = version_entry["url"]
        .as_str()
        .ok_or_else(|| AppError::Internal("Version URL not found".to_string()))?;

        let package: serde_json::Value = client
        .get(package_url)
        .header("User-Agent", "ObsidianPanel/1.0")
        .send()
        .await
        .map_err(|e| AppError::Request(e))?
        .json()
        .await
        .map_err(|e| AppError::Request(e))?;

        package["downloads"]["server"]["url"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::BadRequest("No server download available via Mojang".to_string()))
    }

    pub async fn get_available_versions(&self) -> Result<Vec<serde_json::Value>> {
        let client = reqwest::Client::new();

        let response: serde_json::Value = client
        .get("https://mc-versions-api.net/api/java")
        .header("User-Agent", "ObsidianPanel/1.0")
        .send()
        .await
        .map_err(|e| AppError::Request(e))?
        .json()
        .await
        .map_err(|e| AppError::Request(e))?;

        let versions = response["result"]
        .as_array()
        .ok_or_else(|| AppError::Internal("Invalid version response".to_string()))?
        .iter()
        .filter_map(|v| v.as_str())
        .map(|id| serde_json::json!({ "id": id, "type": "release" }))
        .collect();

        Ok(versions)
    }

    pub async fn get_network_stats(&self) -> Option<NetworkStats> {
        match tokio::fs::read_to_string("/proc/net/dev").await {
            Ok(data) => {
                let mut total_rx: u64 = 0;
                let mut total_tx: u64 = 0;

                for line in data.lines() {
                    if !line.contains(':') {
                        continue;
                    }

                    let parts: Vec<&str> = line.split(':').collect();
                    if parts.len() < 2 {
                        continue;
                    }

                    let iface = parts[0].trim();

                    if iface == "lo"
                        || iface.starts_with("docker")
                        || iface.starts_with("veth")
                        || iface.starts_with("br-")
                        {
                            continue;
                        }

                        let stats: Vec<&str> = parts[1].split_whitespace().collect();
                    if stats.len() >= 9 {
                        total_rx += stats[0].parse::<u64>().unwrap_or(0);
                        total_tx += stats[8].parse::<u64>().unwrap_or(0);
                    }
                }

                Some(NetworkStats { rx: total_rx, tx: total_tx })
            }
            Err(_) => None,
        }
    }

    pub fn start_stats_monitoring(self: Arc<Self>) {
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(2));
            let mut last_net: Option<(NetworkStats, std::time::Instant)> = None;

            loop {
                interval.tick().await;

                let mut sys = System::new();
                sys.refresh_cpu_all();
                sys.refresh_memory();

                let cpu_usage: f32 = if !sys.cpus().is_empty() {
                    sys.cpus().iter().map(|c| c.cpu_usage()).sum::<f32>() / sys.cpus().len() as f32
                } else {
                    0.0
                };

                let net_speed = if let Some(current_net) = self.get_network_stats().await {
                    if let Some((prev, prev_time)) = &last_net {
                        let elapsed = prev_time.elapsed().as_millis() as u64;
                        if elapsed > 0 {
                            let rx_speed = ((current_net.rx.saturating_sub(prev.rx)) * 1000) / elapsed;
                            let tx_speed = ((current_net.tx.saturating_sub(prev.tx)) * 1000) / elapsed;
                            NetworkStats { rx: rx_speed, tx: tx_speed }
                        } else {
                            NetworkStats::default()
                        }
                    } else {
                        NetworkStats::default()
                    }
                } else {
                    NetworkStats::default()
                };

                if let Some(current_net) = self.get_network_stats().await {
                    last_net = Some((current_net, std::time::Instant::now()));
                }

                let storage = match nix::sys::statvfs::statvfs(&self.server_dir) {
                    Ok(stat) => {
                        let total = stat.block_size() as u64 * stat.blocks();
                        let free = stat.block_size() as u64 * stat.blocks_free();
                        StorageStats {
                            total,
                            used: total.saturating_sub(free),
                     free,
                        }
                    }
                    Err(_) => StorageStats { total: 0, used: 0, free: 0 },
                };

                let stats = SystemStats {
                    cpu: (cpu_usage * 10.0).round() / 10.0,
                     cores: sys.cpus().len(),
                     ram: RamStats {
                         total: sys.total_memory(),
                     used: sys.used_memory(),
                     free: sys.free_memory(),
                     },
                     storage,
                     network: net_speed,
                };

                let _ = self.io.emit("stats", &stats);
            }
        });
    }

    pub fn set_operation_locked(&self, locked: bool) {
        *self.is_operation_locked.write() = locked;
    }

    #[allow(dead_code)]
    pub fn is_locked(&self) -> bool {
        *self.is_operation_locked.read()
    }

    #[allow(dead_code)]
    pub fn subscribe_logs(&self) -> broadcast::Receiver<String> {
        self.log_tx.subscribe()
    }
}

impl ServerType {
    fn to_string(&self) -> &str {
        match self {
            ServerType::Vanilla => "vanilla",
            ServerType::Paper => "paper",
            ServerType::Purpur => "purpur",
        }
    }
}

mod regex {
    pub struct Regex {
        inner: regex_lite::Regex,
    }

    impl Regex {
        pub fn new(pattern: &str) -> Result<Self, regex_lite::Error> {
            Ok(Self { inner: regex_lite::Regex::new(pattern)? })
        }

        pub fn captures<'a>(&self, text: &'a str) -> Option<Captures<'a>> {
            self.inner.captures(text).map(|c| Captures { inner: c })
        }
    }

    pub struct Captures<'a> {
        inner: regex_lite::Captures<'a>,
    }

    impl<'a> std::ops::Index<usize> for Captures<'a> {
        type Output = str;
        fn index(&self, i: usize) -> &str {
            self.inner.get(i).map(|m| m.as_str()).unwrap_or("")
        }
    }
}
