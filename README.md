# Obsidian Panel - Minecraft Server Hosting Panel

A modern, beautiful web-based control panel for managing multiple Minecraft servers. Built with React, Node.js, Express, MongoDB, and Socket.IO.

![Obsidian Panel](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- 🎮 **Multi-Server Management** - Host and manage multiple Minecraft servers on different ports
- 📊 **Real-time Monitoring** - Live CPU, RAM usage, and player count tracking
- 💻 **Console Access** - Real-time server console with command execution
- 📁 **File Manager** - Upload, download, edit, and delete server files from the web interface
- 🔐 **Secure Authentication** - JWT-based admin login system
- 🌙 **Beautiful Dark UI** - Modern, responsive design with smooth animations
- 🐳 **Docker Ready** - Single-container deployment with Docker Compose

## 📸 Screenshots

The panel features a sleek dark theme with real-time stats, console output, and file management capabilities.

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- At least 4GB RAM
- Ports 3000 and 25565-25575 available

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Obsidian-Panel
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and set your JWT_SECRET
   ```

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the panel**
   - Open http://localhost:3000 in your browser
   - Create your admin account (first user registration)
   - Login and start managing servers!

## 🛠️ Development Setup

### Backend Development

```bash
cd backend
npm install
npm run dev
```

The backend will run on http://localhost:3000

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on http://localhost:5173

### Environment Variables

Create a `.env` file in the root directory:

```env
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/minecraft-panel
MONGO_DB_NAME=minecraft-panel

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this

# Server Configuration
PORT=3000
NODE_ENV=development

# Minecraft Server Settings
MC_SERVER_BASE_PATH=./servers
MC_PORT_RANGE_START=25565
MC_PORT_RANGE_END=25575
MC_DEFAULT_MEMORY=2048
```

## 📖 Usage Guide

### Creating a Server

1. Click the server selector dropdown
2. Create a new server with:
   - Server name
   - Port (25565-25575)
   - Memory allocation (in MB)
   - Minecraft version

### Uploading Server Files

1. Navigate to **File Manager**
2. Click **Upload File**
3. Select your `server.jar` file
4. Upload any plugins, mods, or world files

### Starting a Server

1. Select your server from the dropdown
2. Go to **Overview**
3. Click **Start Server**
4. Monitor real-time stats

### Using the Console

1. Navigate to **Console**
2. View live server logs
3. Send commands directly to the server
4. Use AI Assist for command suggestions

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/register` - First admin registration
- `GET /api/auth/verify` - Verify JWT token

### Servers
- `GET /api/servers` - List all servers
- `POST /api/servers` - Create new server
- `GET /api/servers/:id` - Get server details
- `PUT /api/servers/:id/start` - Start server
- `PUT /api/servers/:id/stop` - Stop server
- `POST /api/servers/:id/command` - Send console command
- `DELETE /api/servers/:id` - Delete server

### Files
- `GET /api/files/:serverId` - List server files
- `POST /api/files/:serverId/upload` - Upload file
- `GET /api/files/:serverId/download` - Download file
- `GET /api/files/:serverId/read` - Read file content
- `PUT /api/files/:serverId/edit` - Edit file
- `DELETE /api/files/:serverId/delete` - Delete file

## 🏗️ Tech Stack

**Frontend:**
- React 18
- React Router
- Socket.IO Client
- Axios
- Lucide React (Icons)
- Vite

**Backend:**
- Node.js
- Express
- MongoDB (Mongoose)
- Socket.IO
- JWT Authentication
- Multer (File uploads)

**Deployment:**
- Docker
- Docker Compose

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ⚠️ Important Notes

- Always backup your server data before making changes
- Ensure you have sufficient RAM for multiple servers
- The first user to register becomes the admin
- Change the JWT_SECRET in production
- Server JAR files must be uploaded manually

## 🐛 Troubleshooting

**Server won't start:**
- Ensure `server.jar` exists in the server directory
- Check memory allocation is sufficient
- Verify port is not already in use

**Cannot upload files:**
- Check file size limits (500MB max)
- Ensure server directory has write permissions

**MongoDB connection failed:**
- Verify MongoDB is running
- Check MONGO_URI in .env file

## 📧 Support

For issues and questions, please open an issue on GitHub.

---

Made with ❤️ for the Minecraft community
