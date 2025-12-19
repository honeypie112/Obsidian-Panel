# Obsidian Panel

**Obsidian Panel** is a modern, dark-themed, and feature-rich Minecraft Server Management Panel designed to **manage a single server in the best way possible**. It provides a powerful web interface to manage your Minecraft server, handle files, schedule backups, and monitor performance.

![Obsidian Panel Interface](images/dashboard.png)

## ✨ Features

-   **Server Control**: Start, stop, and restart your server with ease. Live console view via Socket.io.
-   **Multi-Version Support**: Native support for **Paper**, **Purpur**, and **Vanilla** Minecraft servers.
    <br>
    ![Server Console](images/console.png)

-   **Server Settings**: Manage server and versions through a simple UI.
    <br>
    ![Server Settings](images/server-settings.png)

-   **File Manager**: Full-featured web-based file manager with **Drag-and-Drop** support to upload, download, delete, and **extract (zip/tar)** server files. Use the **Built-in Text Editor** to edit configuration files directly.
    <br>
    ![File Manager](images/file-manager.png)
    <br>
    ![Drag and Drop](images/drag-and-drop.png)

-   **Infinite Server Backups**: Seamless integration with **GoFile** for unlimited cloud storage. Never worry about disk space again.
-   **One-Click Restore**: Restore your server from any backup with a single click (includes safety safeguards).
    <br>
    ![Backup System](images/backup-system.png)

-   **Plugin Store**: Unified search and install for thousands of plugins from **Modrinth**, **Hangar** (Paper), and **Spiget** (Spigot).
    <br>
    ![Plugin Store](images/plugin-store.png)
    <br>
    ![Plugin Store Installation](images/plugin-store-2.png)

-   **User Management & Granular Permissions**: Create **Sub-Admin** accounts with specific access rights. Grant granular control over:
    -   **Files**: View, Edit, Upload/Create, Delete.
    -   **Backups**: Create, Restore, Delete, Settings.
    -   **Power**: Start/Stop/Restart.
    -   **Console**: Execute Command Access.
    <br>
    ![User Management](images/user-management.png)

-   **Auto-Backup Scheduler**: Configure backups to run minutely, hourly, daily, or using custom Cron expressions.

-   **Responsive Design**: fully optimized for desktop and **mobile** use with a collapsible sidebar.
-   **Enterprise-Grade Security**:
    -   **DDoS Protection**: Global rate limiting to prevent flood attacks.
    -   **Brute-Force Protection**: Smart locking for login attempts.
    -   **Secure Headers**: Helmet integration and XSS sanitization.
    -   **RBAC**: Role-Based Access Control key security.
    <br>
    ![Profile Settings](images/profile.png)

-   **Aesthetic UI**: "Obsidian" dark mode design with glassmorphism effects and smooth animations.
-   **Easy Deployment**: Fully compatible with **Coolify** and **Dockploy** for hassle-free hosting.

## 🛠️ Tech Stack

-   **Frontend**: React (Vite), Tailwind CSS, Lucide Icons.
-   **Backend**: Node.js, Express, Socket.io, Mongoose (MongoDB).
-   **System**: Uses native system calls (`child_process`) to run the Minecraft Server JAR.

## 🚀 Installation

### Prerequisites
-   **Node.js** (v18+ recommended)
-   **MongoDB** (running locally or a connection URI)
-   **OS**: Linux (Ubuntu/Debian recommended)
-   **Runtime**: Docker & Docker Compose (Must be installed and running)
-   **RAM**: Minimum 2GB (4GB recommended)
-   **Java** (installed on the host machine to run Minecraft)

### ⚡ One-Click Installation (Docker)

Run the following command to install and configure Obsidian Panel automatically:

```bash
curl -fsSL https://raw.githubusercontent.com/honeypie112/Obsidian-Panel/master/install.sh | bash
```

This script will:
- Clone the repository.
- Help you select the Java version.
- Configure your `.env` file (MongoDB, etc.).
- Set up Docker containers.
- **Auto-Detect Old Data**: If you are upgrading, it automatically detects your old data volume or legacy configuration and offers to keep it.

### 🔄 Migration (For Legacy Users)
If you are transitioning from an older setup, run this script to rescue your data.
> **Note**: This script extracts your server files from the old container and moves them into the `obsidian-data` volume safely.

```bash
# Standard Migration
./migrate.sh

# Custom Path (if your data isn't in /app/backend/minecraft_server)
./migrate.sh /custom/internal/path
```
Once complete, the installer will automatically pick up your data from the volume.

### 💾 Backup Tools (`backup_volume.sh`)
Use this helper script to create backups of your server files.

**1. Full Server Backup (Default)**
Backs up the entire server directory (`/minecraft_server`) defined in your config.
```bash
sudo ./backup_volume.sh
```

**2. Specific Folder Backup**
Backs up a specific internal path. Useful for config files or worlds only.
```bash
sudo ./backup_volume.sh /minecraft_server/plugins
```
*Backups are saved in the `./backups` folder with a timestamp.*

### ⚙️ Configuration (`.env`)
The installer generates a `.env` file for you.
> [!WARNING]
> **Advanced Configuration**: Do NOT change paths like `MC_SERVER_BASE_PATH` unless you fully understand Docker Volumes and internal mapping.
> Changing these paths can break the connection between the backend and your server files.

**Safe to Change:**
- `MONGO_URI`: Remote database connection string.
- `JWT_SECRET`: Your security key.
- `PORT`: The panel's web port (default 5000).

**Critical Variables (Do Not Touch):**
- `MC_SERVER_BASE_PATH`: Must match the Docker volume mount point.
- `NODE_ENV`: Should remain `production`.

1.  Open your browser and navigate to the frontend URL.
2.  **First Login**: The first account registered automatically becomes the **Admin**.
3.  **Server Setup**:
    -   Go to **Server Settings**.
    -   Select a Minecraft version to install/download.
    -   Click **Start**.
4.  **Backups**:
    -   Go to the **Backups** tab.
    -   Click **Auto Backup** to configure your schedule.
    -   Use the manual "Create Backup" button to trigger one instantly.

## 📝 API Documentation

For detailed backend API usage, refer to the [Backend API README](backend/API_README.md).

## 📄 License

MIT License.
