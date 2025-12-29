use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

fn default_now() -> bson::DateTime {
    bson::DateTime::now()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub key: String,
    pub value: serde_json::Value,
    #[serde(default = "default_now")]
    pub updated_at: bson::DateTime,
}

impl Settings {
    pub fn new<T: Serialize>(key: String, value: T) -> Result<Self, serde_json::Error> {
        Ok(Self {
            id: None,
            key,
            value: serde_json::to_value(value)?,
            updated_at: bson::DateTime::now(),
        })
    }

    pub fn get_value<T: for<'de> Deserialize<'de>>(&self) -> Result<T, serde_json::Error> {
        serde_json::from_value(self.value.clone())
    }
}
