#!/bin/bash

# Configuration
CONTAINER_NAME="obsidian-panel"
BACKUP_DIR="$(pwd)/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting Container Path Backup for $CONTAINER_NAME...${NC}"

# 1. Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH.${NC}"
    exit 1
fi

# 2. Find the container (running or stopped)
if ! docker ps -a --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    echo -e "${RED}Error: Container '$CONTAINER_NAME' not found.${NC}"
    exit 1
fi

# 3. Determine Path to Backup
if [ -n "$1" ]; then
    INTERNAL_PATH="$1"
    echo -e "Target path: ${BLUE}$INTERNAL_PATH${NC}"
else
    # Auto-detect from env or default
    INTERNAL_PATH=$(docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' $CONTAINER_NAME | grep "^MC_SERVER_BASE_PATH=" | cut -d= -f2)
    [ -z "$INTERNAL_PATH" ] && INTERNAL_PATH="/minecraft_server"
    echo -e "Target path (auto-detected): ${BLUE}$INTERNAL_PATH${NC}"
fi

# 4. Prepare Backup Directory
mkdir -p "$BACKUP_DIR"
TEMP_DIR="$(pwd)/temp_backup_${TIMESTAMP}"
mkdir -p "$TEMP_DIR"

# Generate Filename
SAFE_NAME=$(echo "$INTERNAL_PATH" | sed 's/[^a-zA-Z0-9]/_/g')
BACKUP_FILE="$BACKUP_DIR/obsidian_backup_${SAFE_NAME}_${TIMESTAMP}.tar.gz"

echo -e "${BLUE}Copying files from container...${NC}"

# 5. Extract Data using docker cp
# We copy to a temp dir first. 
# docker cp container:path local_dir
# If path is /app/data, and we cp to ./temp, it creates ./temp/data
if docker cp "$CONTAINER_NAME:$INTERNAL_PATH" "$TEMP_DIR/"; then
    echo -e "${GREEN}Files extracted to temporary directory.${NC}"
else
    echo -e "${RED}Error: Failed to copy files from container. Check if path '$INTERNAL_PATH' exists.${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# 6. Archive
echo -e "${BLUE}Creating archive: $BACKUP_FILE${NC}"
# We navigate into the temp dir to tar the *contents* of the extracted folder, 
# or just tar the folder itself? 
# Usually 'docker cp' creates the directory name. 
# e.g. path=/foo. cp container:/foo temp/. -> temp/foo.
# We probably want the tar to contain the contents of foo at root, or foo?
# Let's preserve the directory name 'foo' inside the tar for safety, 
# OR just cd into it. 
# Standard practice: cd into the *parent* of the copied folder and tar the folder.

# The folder name created in TEMP_DIR is the basename of INTERNAL_PATH
BASENAME=$(basename "$INTERNAL_PATH")

cd "$TEMP_DIR" || exit 1

if tar -czf "$BACKUP_FILE" .; then
    echo -e "${GREEN}Backup successful!${NC}"
    echo -e "Saved to: $BACKUP_FILE"
    
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "Size: $SIZE"
else
    echo -e "${RED}Archiving failed!${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Cleanup
cd ..
rm -rf "$TEMP_DIR"
exit 0
