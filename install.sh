#!/bin/bash

# Obsidian Panel Installation Script

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to handle input (compatible with CI & TTY)
get_input() {
    local prompt="$1"
    local var_name="$2"
    if [ "$CI" = "true" ]; then
        read -r "$var_name"
    else
        read -p "$prompt" "$var_name" < /dev/tty
    fi
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Obsidian Panel Installer   ${NC}"
echo -e "${BLUE}========================================${NC}"

# 0. Docker Check
echo -e "${BLUE}Checking Docker status...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed! Please install Docker first.${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}Docker service is not running.${NC}"
    echo -e "${BLUE}Attempting to start Docker service...${NC}"
    
    if command -v systemctl &> /dev/null; then
        sudo systemctl start docker
        sudo systemctl enable docker
        sleep 3
    elif command -v service &> /dev/null; then
        sudo service docker start
        sleep 3
    fi
    
    # Check again
    if ! docker info &> /dev/null; then
        echo -e "${RED}Failed to start Docker. Please start the Docker service manually.${NC}"
        exit 1
    else
        echo -e "${GREEN}Docker service started successfully.${NC}"
    fi
else
    echo -e "${GREEN}Docker is running.${NC}"
fi

# 0.5 Configuration
OLD_CONTAINER="obsidian-panel"
FINAL_MC_PATH="/minecraft_server"
echo -e "${GREEN}Server Data Path set to: ${FINAL_MC_PATH}${NC}"

# 1. Check for Existing Installation
if docker ps -a --format '{{.Names}}' | grep -q "^${OLD_CONTAINER}$"; then
    echo -e "${GREEN}✓ Detected existing installation (container: ${OLD_CONTAINER}).${NC}"
    echo -e "${BLUE}Do you want to reinstall/update? (This will recreate the container but KEEP data)${NC}"
    get_input "Reinstall? (y/n): " reinstall_choice
    
    if [[ "$reinstall_choice" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Stopping and removing old container...${NC}"
        docker rm -f "$OLD_CONTAINER"
    else
        echo -e "${GREEN}Installation cancelled.${NC}"
        exit 0
    fi
else
    echo -e "${BLUE}Fresh installation detected.${NC}"
fi

# Create directory for config if it doesn't exist
INSTALL_DIR="obsidian-panel-config"
if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${BLUE}Creating configuration directory: ${INSTALL_DIR}${NC}"
    mkdir -p "$INSTALL_DIR"
fi
cd "$INSTALL_DIR" || exit 1

# 2. Universal Container Setup
echo -e "\n${BLUE}Using Universal Java Container (Java 8, 17, 21)...${NC}"
DOCKERFILE="Dockerfile"

# 3. Configuration (.env setup)
echo -e "\n${BLUE}Configuration Setup:${NC}"

# Mongo URI
while true; do
    get_input "Enter MongoDB URI (Required): " MONGO_URI
    if [ -n "$MONGO_URI" ]; then
        break
    else
        echo -e "${RED}MongoDB URI is required!${NC}"
    fi
done



# Create .env file
echo -e "\n${BLUE}Generating .env file...${NC}"
cat <<EOF > .env
# Backend Config
MONGO_URI=$MONGO_URI
MONGO_DB_NAME=obsidian-panel

PORT=5000
MC_SERVER_BASE_PATH=/minecraft_server
TEMP_BACKUP_PATH=/tmp
NODE_ENV=production

# Optional
EOF
echo -e "${GREEN}✓ .env file created.${NC}"

# 4. Port Management
PORTS="-p 5000:5000/tcp -p 5000:5000/udp -p 25565:25565/tcp -p 25565:25565/udp -p 19132:19132/tcp -p 19132:19132/udp -p 24454:24454/tcp -p 24454:24454/udp"
echo -e "\n${BLUE}Port Configuration:${NC}"
echo "Default ports exposed: 5000 (Panel), 25565 (Java), 19132 (Bedrock), 24454 (Voice Chat UDP)"
get_input "Do you want to expose additional ports? (y/n): " expose_more

if [[ "$expose_more" =~ ^[Yy]$ ]]; then

    get_input "Enter additional ports (space separated, e.g., 8123 25566): " extra_ports
    for port in $extra_ports; do
        PORTS="$PORTS -p $port:$port/tcp -p $port:$port/udp"
    done
fi

# 5. Docker Pull & Run
echo -e "\n${BLUE}Pulling Docker Image (alexbhai/obsidian-panel)...${NC}"
if docker pull alexbhai/obsidian-panel:latest; then
    echo -e "${GREEN}✓ Image pull successful.${NC}"
else
    echo -e "${RED}Docker pull failed! Check your internet connection.${NC}"
    exit 1
fi

echo -e "\n${BLUE}Starting Container...${NC}"

# Stop existing container if running
# Stop existing container if running
docker rm -f "$OLD_CONTAINER" &>/dev/null

# Prepare Volume Args (Always use obsidian-data volume mapped to standard path)
VOLUME_ARGS="-v obsidian-data:/minecraft_server"
echo -e "${GREEN}Using Volume: obsidian-data -> /minecraft_server${NC}"

COMMAND="docker run -itd --restart unless-stopped --env-file .env $PORTS $VOLUME_ARGS --name obsidian-panel alexbhai/obsidian-panel:latest"
echo "Running: $COMMAND"

if $COMMAND; then
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}   Installation Complete!               ${NC}"
    echo -e "${GREEN}========================================${NC}"
    # Get Public IP
    PUBLIC_IP=$(curl -s ifconfig.me)
    
    echo -e "Panel is running at: http://localhost:5000"
    if [ -n "$PUBLIC_IP" ]; then
        echo -e "External Access: http://$PUBLIC_IP:5000"
    fi
    echo -e "Admin Account: The first user to register will be Admin."

    echo -e "${GREEN}✓ Panel is running in the background.${NC}"
else
    echo -e "${RED}Failed to start container.${NC}"
    exit 1
fi
