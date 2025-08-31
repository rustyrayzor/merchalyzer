#!/bin/bash

# Merchalyzer Production Deployment Script
# Deploys the application to 192.168.100.206 on port 3030

set -e  # Exit on any error

# Configuration
REMOTE_HOST="192.168.100.206"
REMOTE_USER="ray-svc"
REMOTE_PATH="/opt/merchalyzer"
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
ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "sudo mkdir -p $REMOTE_PATH && sudo chown $REMOTE_USER:$REMOTE_USER $REMOTE_PATH"

# Copy project files to remote server
print_status "Copying project files to remote server..."
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='tmp' \
    -e "ssh -i $SSH_KEY_PATH" \
    ./ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

# Build and deploy on remote server
print_status "Building and deploying application..."
ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && docker compose down || docker-compose down"

ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && docker compose build --no-cache || docker-compose build --no-cache"

ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && docker compose up -d || docker-compose up -d"

# Wait for services to be healthy
print_status "Waiting for services to start..."
sleep 30

# Check if services are running
print_status "Checking service status..."
if ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && docker compose ps || docker-compose ps" | grep -q "Up"; then
    print_status "Services are running successfully!"
    print_status "Application should be available at: http://$REMOTE_HOST:3030"
else
    print_error "Services failed to start properly"
    ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && docker compose logs || docker-compose logs"
    exit 1
fi

# Clean up old Docker images
print_status "Cleaning up old Docker images..."
ssh -i "$SSH_KEY_PATH" "$REMOTE_USER@$REMOTE_HOST" "docker image prune -f" || true

print_status "🎉 Deployment completed successfully!"
echo ""
echo -e "${GREEN}Application URLs:${NC}"
echo "  Main App: http://$REMOTE_HOST:3030"
echo "  Upscayl Service: http://$REMOTE_HOST:5001"
echo ""
echo -e "${YELLOW}To check logs:${NC}"
echo "  ssh -i $SSH_KEY_PATH $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && docker-compose logs -f'"
echo ""
echo -e "${YELLOW}To restart services:${NC}"
echo "  ssh -i $SSH_KEY_PATH $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && docker-compose restart'"
