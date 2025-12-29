use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

fn default_now() -> bson::DateTime {
    bson::DateTime::now()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    Admin,
    #[serde(rename = "sub-admin")]
    SubAdmin,
    User,
}

impl Default for UserRole {
    fn default() -> Self {
        Self::User
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub role: UserRole,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(rename = "createdAt", default = "default_now")]
    pub created_at: bson::DateTime,
}

impl User {
    pub fn new(username: String, password_hash: String, role: UserRole) -> Self {
        Self {
            id: None,
            username,
            password: password_hash,
            role,
            permissions: Vec::new(),
            created_at: bson::DateTime::now(),
        }
    }

    /// Check if user has a specific permission
    #[allow(dead_code)]
    pub fn has_permission(&self, permission: &str) -> bool {
        // Admin has all permissions
        if self.role == UserRole::Admin {
            return true;
        }
        self.permissions.contains(&permission.to_string())
    }
}

/// Response struct for user data (without password)
#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub username: String,
    pub role: UserRole,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Vec<String>>,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id.map(|id| id.to_hex()).unwrap_or_default(),
            username: user.username,
            role: user.role,
            permissions: Some(user.permissions),
        }
    }
}


