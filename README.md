# Obsidian Panel

**Obsidian Panel** is a modern, dark-themed, and feature-rich Minecraft Server Management Panel. It provides a powerful web interface to manage your Minecraft server, handle files, schedule backups, and monitor performance it has sellf backup feature with gofile.io.

![Obsidian Panel Interface](images/main.png)

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

### 1. Setup Backend (I willl add it soon)

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
