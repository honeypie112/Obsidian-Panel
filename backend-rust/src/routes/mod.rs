pub mod auth;
pub mod control;
pub mod backups;
pub mod plugins;
pub mod users;

pub use auth::router as auth_router;
pub use control::router as control_router;
pub use backups::router as backups_router;
pub use plugins::router as plugins_router;
pub use users::router as users_router;
