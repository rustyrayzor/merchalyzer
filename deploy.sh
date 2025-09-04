#!/bin/bash

# Merchalyzer Production Deployment Script
# Deploys the application to 192.168.100.206 on port 3030

set -e  # Exit on any error

# Configuration
REMOTE_HOST="192.168.100.206"
REMOTE_USER="ray-svc"
REMOTE_PATH="~/merchalyzer"
SSH_KEY_PATH="$HOME/.ssh/merchalyzer_deploy_key"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Merchalyzer Production Deployment${NC}"

# Function to print status messages
print_status() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if SSH key exists
if [ ! -f "$SSH_KEY_PATH" ]; then
    print_error "SSH key not found at $SSH_KEY_PATH"
    exit 1
fi

# Test SSH connection
print_status "Testing SSH connection..."
if ! ssh -i "$SSH_KEY_PATH" -o ConnectTimeout=10 "$REMOTE_USER@$REMOTE_HOST" "echo 'SSH connection successful'" > /dev/null 2>&1; then
    print_error "SSH connection failed"
    exit 1
fi

# Check if Docker is installed on remote server
print_status "Checking Docker installation on remote server..."
if ! ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "docker --version" > /dev/null 2>&1; then
    print_error "Docker is not installed on remote server"
    exit 1
fi

# Check if Docker Compose is installed (try both old and new syntax)
if ! ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "docker compose version || docker-compose --version" > /dev/null 2>&1; then
    print_error "Docker Compose is not installed on remote server"
    exit 1
fi

# Create remote directory if it doesn't exist
print_status "Creating remote deployment directory..."
ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_PATH"

# Prepare environment file for container
print_status "Preparing production env file (secrets) ..."

# Build a temporary env file for deployment without committing secrets
TMP_ENV="env.production.deploy"

# Load base values from existing file if present, otherwise create sensible defaults
if [ -f "env.production" ]; then
  cp env.production "$TMP_ENV"
else
  cat > "$TMP_ENV" << EOF
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=http://$REMOTE_HOST:3030
EOF
fi

# Helper to read a key from local env or .env.local
read_key() {
  local key="$1"
  local val="${!key}"
  if [ -z "$val" ] && [ -f "web/.env.local" ]; then
    val=$(grep -m1 "^$key=" web/.env.local | cut -d'=' -f2-)
  fi
  echo "$val"
}

# Ensure required secrets are present in the temp env file (do not echo values)
ensure_key() {
  local key="$1"
  local val
  if ! grep -q "^$key=" "$TMP_ENV" 2>/dev/null; then
    val=$(read_key "$key")
    if [ -n "$val" ]; then
      echo "$key=$val" >> "$TMP_ENV"
    fi
  fi
}

# Common secrets for the app (add as needed)
ensure_key PRINTIFY_API_KEY
ensure_key OPENROUTER_API_KEY
ensure_key REMBG_API_KEY
ensure_key REM_BG_API_KEY

print_status "Copying project files to remote server..."
print_warning "Using tar/scp for file transfer (this may take a while)..."

# Create temporary files
TEMP_TAR="deploy_temp.tar.gz"
EXCLUDE_FILE="deploy_excludes.txt"

# Create exclude file
cat > "$EXCLUDE_FILE" << 'EOF'
node_modules
.git
tmp
.next
*.log
deploy_temp.tar.gz
deploy_excludes.txt
env.production
EOF

# Create tar archive excluding unwanted files
print_warning "Creating deployment archive..."
tar -czf "$TEMP_TAR" --exclude-from="$EXCLUDE_FILE" --exclude="node_modules" --exclude=".next" --exclude=".git" --exclude="*.log" --exclude="deploy_temp.tar.gz" --exclude="deploy_excludes.txt" --exclude="tmp" --exclude=".cache" --exclude=".vscode" --exclude=".DS_Store" --ignore-failed-read .

# Transfer the archive
print_warning "Transferring files to remote server..."
scp -i "$SSH_KEY_PATH" "$TEMP_TAR" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

# Transfer the generated env file separately (not stored in git)
print_status "Uploading env.production (generated) ..."
scp -i "$SSH_KEY_PATH" "$TMP_ENV" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/env.production"

# Extract on remote server
print_warning "Extracting files on remote server..."
ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && tar -xzf $TEMP_TAR && rm $TEMP_TAR"

# Cleanup local temp files
rm -f "$TEMP_TAR" "$EXCLUDE_FILE" "$TMP_ENV"

# Build and deploy on remote server
print_status "Building and deploying application..."
ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && docker compose down"

ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && docker compose build --no-cache"

ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && docker compose up -d"

# Wait for services to be healthy
print_status "Waiting for services to start..."
sleep 30

# Check if services are running
print_status "Checking service status..."
if ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && docker compose ps" | grep -q "Up"; then
    print_status "Services are running successfully!"
    print_status "Application should be available at: http://$REMOTE_HOST:3030"
else
    print_error "Services failed to start properly"
    ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && docker compose logs"
    exit 1
fi

# Clean up old Docker images
print_status "Cleaning up old Docker images..."
ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "docker image prune -f" || true

print_status "🎉 Deployment completed successfully!"
echo ""
echo -e "${GREEN}Application URLs:${NC}"
echo "  Main App: http://$REMOTE_HOST:3030"
echo "  Note: Upscayl service is temporarily disabled"
echo ""
echo -e "${YELLOW}To check logs:${NC}"
echo "  ssh -i $SSH_KEY_PATH $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && docker compose logs -f'"
echo ""
echo -e "${YELLOW}To restart services:${NC}"
echo "  ssh -i $SSH_KEY_PATH $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && docker compose restart'"
echo ""
echo -e "${YELLOW}To stop services:${NC}"
echo "  ssh -i $SSH_KEY_PATH $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && docker compose down'"
