#!/bin/bash
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Obsidian Panel Migration Utility   ${NC}"
echo -e "${BLUE}========================================${NC}"

# Target Legacy Path
if [ -n "$1" ]; then
    LEGACY_PATH="$1"
    echo -e "Using user-specified legacy path: ${BLUE}$LEGACY_PATH${NC}"
else
    LEGACY_PATH="/app/backend/minecraft_server"
    echo -e "Using default legacy path: ${BLUE}$LEGACY_PATH${NC}"
fi

CONTAINER_NAME="obsidian-panel"

# check if container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}Error: Container '$CONTAINER_NAME' not found.${NC}"
    exit 1
fi

echo -e "${BLUE}Detected '$CONTAINER_NAME'. Checking for legacy data path...${NC}"

# Check if data is already mounted (if so, no copy needed!)
MOUNT_SOURCE=$(docker inspect --format='{{range .Mounts}}{{if eq .Destination "'"$LEGACY_PATH"'"}}{{if eq .Type "volume"}}{{.Name}}{{else}}{{.Source}}{{end}}{{end}}{{end}}' "$CONTAINER_NAME")

if [ -n "$MOUNT_SOURCE" ]; then
    echo -e "${GREEN}Good News! Your server data is already persisted at: $MOUNT_SOURCE${NC}"
    echo -e "You don't need to migrate data manually. The installer will detect this automatically."
    echo -e "Just run ./install.sh and choose to reuse existing data."
    exit 0
fi

# If NO mount found, data is inside the container. We must rescue it.
echo -e "${RED}Warning: Server data is NOT mounted to a volume. It exists inside the container only.${NC}"
read -p "Do you want to extract this data to a Docker Volume (obsidian-data)? (y/n): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

echo -e "${BLUE}Stopping container to ensure data safety...${NC}"
docker stop "$CONTAINER_NAME"

echo -e "${BLUE}Creating destination volume 'obsidian-data'...${NC}"
docker volume create obsidian-data

echo -e "${BLUE}Copying data from container... This may take a while.${NC}"

# We use a temporary helper container to copy directly from the old container to the volume
# 1. Create a dummy container with the volume monted
docker container create --name migration-helper -v obsidian-data:/target alpine

# 2. Copy from Old Container -> Host Temp -> New Volume?  
# efficient way: docker cp from old container to host, then host to volume.
# Or: docker cp old_container:/app/backend/minecraft_server ./temp_migration_data

rm -rf ./current_migration_data
docker cp "$CONTAINER_NAME:$LEGACY_PATH" ./current_migration_data

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Data extracted to local './current_migration_data'.${NC}"
    
    echo -e "${BLUE}Uploading to 'obsidian-data' volume...${NC}"
    # Copy from local to helper container which writes to volume
    docker cp ./current_migration_data/. migration-helper:/target/
    
    echo -e "${BLUE}Cleaning up...${NC}"
    docker rm migration-helper
    rm -rf ./current_migration_data
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   Migration Complete!               ${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "Your data is now safe in the volume named: ${BLUE}obsidian-data${NC}"
    echo -e "You can now run ${BLUE}./install.sh${NC}"
    echo -e "Select 'Reinstall fresh', and it will automatically use 'obsidian-data'."
else
    echo -e "${RED}Failed to copy data from container. Check if path exists.${NC}"
    docker rm migration-helper
    exit 1
fi
