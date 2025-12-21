use std::{path::PathBuf, sync::Arc};

use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;

use crate::{
    error::{AppError, Result},
    services::MinecraftService,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub source: String,
    pub web_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
    pub downloads: u64,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallResult {
    pub filename: String,
    pub source: String,
}

pub struct PluginService {
    minecraft: Arc<MinecraftService>,
    user_agent: &'static str,
}

impl PluginService {
    pub fn new(minecraft: Arc<MinecraftService>) -> Self {
        Self {
            minecraft,
            user_agent: "ObsidianPanel/1.0",
        }
    }

    fn plugins_dir(&self) -> PathBuf {
        self.minecraft.server_dir().join("plugins")
    }

    pub async fn search(&self, query: &str, limit: usize) -> Result<Vec<PluginInfo>> {
        // Run all searches in parallel
        let (modrinth, hangar, spiget) = tokio::join!(
            self.search_modrinth(query, limit),
            self.search_hangar(query, limit),
            self.search_spiget(query, limit),
        );

        let mut results = Vec::new();
        results.extend(modrinth.unwrap_or_default());
        results.extend(hangar.unwrap_or_default());
        results.extend(spiget.unwrap_or_default());

        Ok(results)
    }

    async fn search_modrinth(&self, query: &str, limit: usize) -> Result<Vec<PluginInfo>> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://api.modrinth.com/v2/search?query={}&limit={}",
            urlencoding::encode(query),
            limit
        );

        let response: serde_json::Value = client
            .get(&url)
            .header("User-Agent", self.user_agent)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Modrinth Search Error: {}", e);
                AppError::Request(e)
            })?
            .json()
            .await
            .map_err(|e| AppError::Request(e))?;

        let empty_vec = vec![];
        let hits = response["hits"].as_array().unwrap_or(&empty_vec);
        
        Ok(hits
            .iter()
            .map(|hit| PluginInfo {
                id: hit["project_id"].as_str().unwrap_or("").to_string(),
                name: hit["title"].as_str().unwrap_or("").to_string(),
                description: hit["description"].as_str().unwrap_or("").to_string(),
                source: "Modrinth".to_string(),
                web_url: format!(
                    "https://modrinth.com/plugin/{}",
                    hit["slug"].as_str().unwrap_or("")
                ),
                icon_url: hit["icon_url"].as_str().map(|s| s.to_string()),
                downloads: hit["downloads"].as_u64().unwrap_or(0),
                author: hit["author"].as_str().unwrap_or("Unknown").to_string(),
            })
            .collect())
    }

    async fn search_hangar(&self, query: &str, limit: usize) -> Result<Vec<PluginInfo>> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://hangar.papermc.io/api/v1/projects?q={}&limit={}",
            urlencoding::encode(query),
            limit
        );

        let response: serde_json::Value = client
            .get(&url)
            .header("User-Agent", self.user_agent)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Hangar Search Error: {}", e);
                AppError::Request(e)
            })?
            .json()
            .await
            .map_err(|e| AppError::Request(e))?;

        let empty_vec = vec![];
        let results = response["result"].as_array().unwrap_or(&empty_vec);
        
        Ok(results
            .iter()
            .map(|p| PluginInfo {
                id: p["namespace"]["slug"].as_str().unwrap_or("").to_string(),
                name: p["name"].as_str().unwrap_or("").to_string(),
                description: p["description"].as_str().unwrap_or("").to_string(),
                source: "Hangar".to_string(),
                web_url: format!(
                    "https://hangar.papermc.io/{}/{}",
                    p["namespace"]["owner"].as_str().unwrap_or(""),
                    p["namespace"]["slug"].as_str().unwrap_or("")
                ),
                icon_url: p["avatarUrl"].as_str().map(|s| s.to_string()),
                downloads: p["stats"]["downloads"].as_u64().unwrap_or(0),
                author: p["namespace"]["owner"].as_str().unwrap_or("Unknown").to_string(),
            })
            .collect())
    }

    async fn search_spiget(&self, query: &str, limit: usize) -> Result<Vec<PluginInfo>> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://api.spiget.org/v2/search/resources/{}?size={}&sort=-downloads",
            urlencoding::encode(query),
            limit
        );

        let response: serde_json::Value = client
            .get(&url)
            .header("User-Agent", self.user_agent)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Spiget Search Error: {}", e);
                AppError::Request(e)
            })?
            .json()
            .await
            .map_err(|e| AppError::Request(e))?;

        let empty_vec = vec![];
        let results = response.as_array().unwrap_or(&empty_vec);
        
        Ok(results
            .iter()
            .map(|r| {
                let id = r["id"].as_u64().unwrap_or(0).to_string();
                PluginInfo {
                    id: id.clone(),
                    name: r["name"].as_str().unwrap_or("").to_string(),
                    description: r["tag"].as_str().unwrap_or("").to_string(),
                    source: "Spigot".to_string(),
                    web_url: format!("https://www.spigotmc.org/resources/{}", id),
                    icon_url: r["icon"]["url"]
                        .as_str()
                        .map(|url| format!("https://www.spigotmc.org/{}", url)),
                    downloads: r["downloads"].as_u64().unwrap_or(0),
                    author: r["author"]["id"]
                        .as_u64()
                        .map(|id| id.to_string())
                        .unwrap_or_else(|| "Unknown".to_string()),
                }
            })
            .collect())
    }

    pub async fn install(
        &self,
        source: &str,
        id: &str,
        version: &str,
        loaders: &[String],
    ) -> Result<InstallResult> {
        let plugins_dir = self.plugins_dir();
        if !plugins_dir.exists() {
            tokio::fs::create_dir_all(&plugins_dir)
                .await
                .map_err(|e| AppError::Io(e))?;
        }

        let client = reqwest::Client::new();
        let (download_url, filename) = match source {
            "Modrinth" => self.get_modrinth_download(&client, id, version, loaders).await?,
            "Hangar" => self.get_hangar_download(&client, id, version).await?,
            "Spigot" => self.get_spiget_download(&client, id).await?,
            _ => return Err(AppError::BadRequest(format!("Unknown source: {}", source))),
        };

        // Download the file
        let file_path = plugins_dir.join(&filename);
        self.download_file(&client, &download_url, &file_path).await?;

        Ok(InstallResult {
            filename,
            source: source.to_string(),
        })
    }

    async fn get_modrinth_download(
        &self,
        client: &reqwest::Client,
        id: &str,
        version: &str,
        loaders: &[String],
    ) -> Result<(String, String)> {
        let url = format!("https://api.modrinth.com/v2/project/{}/version", id);
        
        let versions: Vec<serde_json::Value> = client
            .get(&url)
            .header("User-Agent", self.user_agent)
            .send()
            .await
            .map_err(|e| AppError::Request(e))?
            .json()
            .await
            .map_err(|e| AppError::Request(e))?;

        let empty_game_vec: Vec<serde_json::Value> = vec![];
        let empty_loader_vec: Vec<serde_json::Value> = vec![];
        let compatible = versions
            .iter()
            .find(|v| {
                let game_versions = v["game_versions"].as_array().unwrap_or(&empty_game_vec);
                let v_loaders = v["loaders"].as_array().unwrap_or(&empty_loader_vec);
                
                let version_match = if version.is_empty() {
                    true
                } else {
                    game_versions.iter().any(|gv| gv.as_str() == Some(version))
                };
                
                version_match
                    && v_loaders.iter().any(|l| {
                        loaders.iter().any(|loader| l.as_str() == Some(loader))
                    })
            })
            .ok_or_else(|| AppError::NotFound(format!("Modrinth: No version found for {}", if version.is_empty() { "any" } else { version })))?;

        let empty_files_vec: Vec<serde_json::Value> = vec![];
        let files = compatible["files"].as_array().unwrap_or(&empty_files_vec);
        let file = files
            .iter()
            .find(|f| f["primary"].as_bool() == Some(true))
            .or_else(|| files.first())
            .ok_or_else(|| AppError::NotFound("No downloadable file found".to_string()))?;

        let url = file["url"]
            .as_str()
            .ok_or_else(|| AppError::Internal("Missing download URL".to_string()))?
            .to_string();
        let filename = file["filename"]
            .as_str()
            .unwrap_or("plugin.jar")
            .to_string();

        Ok((url, filename))
    }

    async fn get_hangar_download(
        &self,
        client: &reqwest::Client,
        id: &str,
        version: &str,
    ) -> Result<(String, String)> {
        let url = format!("https://hangar.papermc.io/api/v1/projects/{}/versions", id);
        
        let response: serde_json::Value = client
            .get(&url)
            .header("User-Agent", self.user_agent)
            .send()
            .await
            .map_err(|e| AppError::Request(e))?
            .json()
            .await
            .map_err(|e| AppError::Request(e))?;

        let empty_versions_vec: Vec<serde_json::Value> = vec![];
        let versions = response["result"].as_array().unwrap_or(&empty_versions_vec);
        
        let _empty_deps_vec: Vec<serde_json::Value> = vec![];
        let compatible = versions
            .iter()
            .find(|v| {
                let Some(platform_depend) = v["platformDependencies"].as_object() else {
                    return false;
                };
                let empty_vec = vec![];
                let platform_array = platform_depend
                    .values()
                    .next()
                    .and_then(|v| v.as_array())
                    .unwrap_or(&empty_vec);
                
                if version.is_empty() {
                    true
                } else {
                    platform_array.iter().any(|pv| pv.as_str() == Some(version))
                }
            })
            .ok_or_else(|| AppError::NotFound(format!("Hangar: No version found for {}", if version.is_empty() { "any" } else { version })))?;

        let download_url = compatible["downloads"]["PAPER"]["downloadUrl"]
            .as_str()
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                let ver_name = compatible["name"].as_str().unwrap_or("latest");
                format!(
                    "https://hangar.papermc.io/api/v1/projects/{}/versions/{}/PAPER/download",
                    id, ver_name
                )
            });

        let ver_name = compatible["name"].as_str().unwrap_or("latest");
        let filename = format!("{}-{}.jar", id, ver_name);

        Ok((download_url, filename))
    }

    async fn get_spiget_download(
        &self,
        client: &reqwest::Client,
        id: &str,
    ) -> Result<(String, String)> {
        // Get resource info for filename
        let info_url = format!("https://api.spiget.org/v2/resources/{}", id);
        let info: serde_json::Value = client
            .get(&info_url)
            .header("User-Agent", self.user_agent)
            .send()
            .await
            .map_err(|e| AppError::Request(e))?
            .json()
            .await
            .map_err(|e| AppError::Request(e))?;

        let name = info["name"].as_str().unwrap_or("plugin");
        let filename = format!("{}.jar", name.replace(' ', "_"));
        let download_url = format!("https://api.spiget.org/v2/resources/{}/download", id);

        Ok((download_url, filename))
    }

    async fn download_file(
        &self,
        client: &reqwest::Client,
        url: &str,
        path: &PathBuf,
    ) -> Result<()> {
        let response = self.download_with_redirects(client, url).await?;

        if !response.status().is_success() {
            return Err(AppError::BadRequest(format!(
                "Download failed: {}",
                response.status()
            )));
        }

        let bytes = response.bytes().await.map_err(|e| AppError::Request(e))?;
        
        let mut file = tokio::fs::File::create(path)
            .await
            .map_err(|e| AppError::Io(e))?;
        
        file.write_all(&bytes)
            .await
            .map_err(|e| AppError::Io(e))?;

        Ok(())
    }

    async fn download_with_redirects(
        &self,
        client: &reqwest::Client,
        url: &str,
    ) -> Result<reqwest::Response> {
        let response = client
            .get(url)
            .header("User-Agent", self.user_agent)
            .send()
            .await
            .map_err(|e| AppError::Request(e))?;

        // reqwest handles redirects automatically by default
        Ok(response)
    }
}
