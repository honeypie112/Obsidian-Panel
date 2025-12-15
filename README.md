# Obsidian Panel

**Obsidian Panel** is a modern, dark-themed, and feature-rich Minecraft Server Management Panel. It provides a powerful web interface to manage your Minecraft server, handle files, schedule backups, and monitor performance.

![Obsidian Panel Interface](images/main.png) *Replace with actual screenshot*

## ✨ Features

-   **Server Control**: Start, stop, and restart your server with ease. Live console view via Socket.io.
-   **File Manager**: Full-featured web-based file manager to specific upload, download, edit, and delete server files.
-   **Automated Backups**:
    -   Seamless integration with **GoFile** for unlimited cloud storage.
    -   **Auto-Backup Scheduler**: Configure backups to run minutely, hourly, daily, or using custom Cron expressions.
    -   **One-Click Restore**: Restore your server from any backup with a single click (includes safety safeguards).
-   **Responsive Design**: fully optimized for desktop and **mobile** use with a collapsible sidebar.
-   **Secure**: JWT-based authentication with role-based access control.
-   **Aesthetic UI**: "Obsidian" dark mode design with glassmorphism effects and smooth animations.

## 🛠️ Tech Stack

-   **Frontend**: React (Vite), Tailwind CSS, Lucide Icons.
-   **Backend**: Node.js, Express, Socket.io, Mongoose (MongoDB).
-   **System**: Uses native system calls (`child_process`) to run the Minecraft Server JAR.

## 🚀 Installation

### Prerequisites
-   **Node.js** (v18+ recommended)
-   **MongoDB** (running locally or a connection URI)
-   **Java** (installed on the host machine to run Minecraft)

### 1. Setup Backend

1.  Navigate to the backend folder:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure Environment:
    -   Copy `.env.example` to `.env` (or use the one in root if shared):
        ```bash
        cp ../.env.example .env
        ```
    -   Edit `.env` and fill in your details:
        ```env
        MONGO_URI=mongodb://localhost:27017
        MONGO_DB_NAME=obsidian_panel
        JWT_SECRET=your_super_secret_key
        GOFILE_API_TOKEN=your_gofile_token
        TEMP_BACKUP_PATH=/tmp/obsidian_backups
        # MINECRAFT_JAR_PATH is managed dynamically or set here
        ```

4.  Start the Server:
    ```bash
    npm start
    ```
    (Runs on Port `5000` by default)

### 2. Setup Frontend

1.  Navigate to the frontend folder:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start Development Server:
    ```bash
    npm run dev
    ```
    (Access at `http://localhost:5173`)

## 📖 Usage

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
