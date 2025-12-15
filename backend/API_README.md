# Obsidian Panel Backend API Documentation

This document outlines the API endpoints available in the Obsidian Panel backend.

**Base URL**: `/api`

## Authentication
Base path: `/api/auth`

### 1. Register User
- **Endpoint**: `POST /register`
- **Description**: Registers a new user. The first user registered becomes `admin`.
- **Body**:
  ```json
  {
    "username": "admin",
    "password": "securepassword"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "token": "jwt_token_here",
    "user": { "id": "...", "username": "admin", "role": "admin" }
  }
  ```

### 2. Login User
- **Endpoint**: `POST /login`
- **Description**: Authenticates a user and returns a JWT token.
- **Body**:
  ```json
  {
    "username": "admin",
    "password": "securepassword"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "token": "jwt_token_here",
    "user": { "id": "...", "username": "admin", "role": "admin" }
  }
  ```

### 3. Get Current User
- **Endpoint**: `GET /me`
- **Headers**: `x-auth-token: <token>`
- **Description**: Returns the profile of the currently logged-in user.
- **Response**: `200 OK` (User Object)

### 4. Update Profile
- **Endpoint**: `PUT /profile`
- **Headers**: `x-auth-token: <token>`
- **Description**: Updates username or password.
- **Body**:
  ```json
  {
    "username": "newname",
    "currentPassword": "oldpassword",
    "newPassword": "newpassword"
  }
  ```

### 5. Check Admin Existence
- **Endpoint**: `GET /has-admin`
- **Description**: Checks if any admin account exists (used for initial setup).
- **Response**: `200 OK` `{ "hasAdmin": true/false }`

---

## Server Control
Base path: `/api/control`
**Headers**: `x-auth-token: <token>` required for all.

### 1. Get Status
- **Endpoint**: `GET /status`
- **Description**: Returns current server status (online/offline/starting), RAM usage, and player count.
- **Response**: `200 OK` (Status Object)

### 2. specific Action
- **Endpoint**: `POST /action`
- **Description**: Controls server power state.
- **Body**: `{ "action": "start" | "stop" | "restart" }`

### 3. Send Command
- **Endpoint**: `POST /command`
- **Description**: Sends a command to the Minecraft server console.
- **Body**: `{ "command": "op user" }`

### 4. Install Version
- **Endpoint**: `POST /install`
- **Description**: Installs or updates the Minecraft server JAR.
- **Body**: `{ "version": "1.20.1" }`

### 5. Update Config
- **Endpoint**: `POST /config`
- **Description**: Updates server settings (saved to `server.properties` or internal config).
- **Body**: Arbitrary config object.

---

## File Management
Base path: `/api/control/files`
**Headers**: `x-auth-token: <token>` required for all.

- **List Files**: `POST /list` - Body: `{ "path": "world" }`
- **Read File**: `POST /read` - Body: `{ "path": "server.properties" }`
- **Save File**: `POST /save` - Body: `{ "path": "server.properties", "content": "..." }`
- **Download**: `POST /download` - Body: `{ "path": "world/level.dat" }`
- **Upload**: `POST /upload` - Form-Data: `file` (binary), `path` (text target dir)
- **Create**: `POST /create` - Body: `{ "path": "plugins", "name": "Folder", "type": "folder" | "file" }`
- **Delete**: `POST /delete` - Body: `{ "path": "crash-reports/old.txt" }`
- **Extract**: `POST /extract` - Body: `{ "path": "backup.zip" }`

---

## Backups & Auto-Backup
Base path: `/api/backups`
**Headers**: `x-auth-token: <token>` required for all.

### 1. List Backups
- **Endpoint**: `GET /`
- **Description**: Returns list of all stored backups.

### 2. Create Backup
- **Endpoint**: `POST /create`
- **Description**: Triggers a manual backup (zipping + GoFile upload).
- **Response**: Backup Object

### 3. Restore Backup
- **Endpoint**: `POST /:id/restore`
- **Description**: Restores a specific backup. **Destructive**: Wipes current server files.

### 4. Delete Backup Record
- **Endpoint**: `DELETE /:id`
- **Description**: Deletes the database record (does not remove from GoFile).

### 5. Check Status
- **Endpoint**: `GET /status`
- **Description**: Returns `isBackupInProgress` and `isRestoreInProgress` flags.

### 6. Get Auto-Backup Config
- **Endpoint**: `GET /config`
- **Description**: Returns current auto-backup settings.
- **Response**:
  ```json
  {
    "enabled": true,
    "frequency": "daily",
    "cronExpression": "0 0 * * *"
  }
  ```

### 7. Update Auto-Backup Config
- **Endpoint**: `POST /config`
- **Description**: Updates scheduling settings.
- **Body**:
  ```json
  {
    "enabled": true,
    "frequency": "custom",
    "cronExpression": "*/30 * * * *"
  }
  ```
