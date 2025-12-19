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

# 2. Check if Legacy Path exists inside container
echo -e "${BLUE}Checking if files exist at ${LEGACY_PATH}...${NC}"
# Use docker exec to check existence. We need to start it momentarily if stopped? 
# No, we can copy from stopped. But to check existence reliably without copying?
# We can try to copy *one* file or list.
# 'docker cp' errors if path not found.

rm -rf ./current_migration_data
mkdir -p ./current_migration_data

echo -e "${BLUE}Extracting data from container...${NC}"
if docker cp "$CONTAINER_NAME:$LEGACY_PATH/." ./current_migration_data; then
   # Check if empty
   if [ -z "$(ls -A ./current_migration_data)" ]; then
       echo -e "${RED}Error: Source directory '$LEGACY_PATH' appears to be empty or copy failed.${NC}"
       rm -rf ./current_migration_data
       exit 1
   fi
   
   echo -e "${GREEN}✓ Successfully extracted data to local buffer.${NC}"
   FILE_COUNT=$(ls -A ./current_migration_data | wc -l)
   echo -e "Found $FILE_COUNT files/folders."

   echo -e "${BLUE}Uploading to 'obsidian-data' volume...${NC}"
   # Copy from local to helper container
   if docker cp ./current_migration_data/. migration-helper:/target/; then
       echo -e "${GREEN}✓ Upload successful.${NC}"
       
       # Final Verify
       echo -e "${BLUE}Verifying volume contents...${NC}"
       docker exec migration-helper ls -A /target > /dev/null
       if [ $? -eq 0 ]; then
           echo -e "${GREEN}========================================${NC}"
           echo -e "${GREEN}   Migration Complete!               ${NC}"
           echo -e "${GREEN}========================================${NC}"
           echo -e "Your data is now safe in the volume named: ${BLUE}obsidian-data${NC}"
           echo -e "You can now run ${BLUE}./install.sh${NC}"
           
           # CLEANUP
           docker rm -f migration-helper
           rm -rf ./current_migration_data
           exit 0
       else
           echo -e "${RED}Verification failed: Volume seems empty?${NC}"
       fi
   else
       echo -e "${RED}Failed to upload data to volume.${NC}"
   fi
else
    echo -e "${RED}Failed to find or copy path '$LEGACY_PATH' from container.${NC}"
    echo -e "Please verify the path. You can browse your container with:"
    echo -e "  docker start $CONTAINER_NAME"
    echo -e "  docker exec -it $CONTAINER_NAME ls -R /app"
    exit 1
fi

# Cleanup on failure
docker rm -f migration-helper &>/dev/null
rm -rf ./current_migration_data
exit 1
