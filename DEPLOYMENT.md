# Merchalyzer Production Deployment Guide

This guide explains how to deploy the Merchalyzer application to a production server on port 3030.

## Prerequisites

1. **SSH Access**: Passwordless SSH access to `192.168.100.206` as user `ray-svc`
2. **Docker**: Docker and Docker Compose installed on the target server
3. **SSH Key**: SSH key pair generated and public key added to authorized_keys

## SSH Setup (Already Completed)

SSH keys have been generated and configured for passwordless authentication:

- **Private Key**: `~/.ssh/merchalyzer_deploy_key`
- **Public Key**: Added to `ray-svc@192.168.100.206:~/.ssh/authorized_keys`

## Project Structure

```
merchalyzer/
├── Dockerfile.prod          # Production Dockerfile for Next.js app
├── docker-compose.yml       # Production Docker Compose configuration
├── env.production          # Production environment variables
├── deploy.sh               # Bash deployment script (Linux/Mac)
├── deploy.ps1              # PowerShell deployment script (Windows)
└── web/                    # Next.js application
    └── src/app/api/health/ # Health check endpoint
```

## Deployment Instructions

### Option 1: Using PowerShell (Windows)

```powershell
# Run the deployment script
.\deploy.ps1
```

### Option 2: Using Bash (Linux/Mac)

```bash
# Make script executable and run
chmod +x deploy.sh
./deploy.sh
```

### Option 3: Manual Deployment

1. **Copy files to server:**
   ```bash
   rsync -avz --exclude='node_modules' --exclude='.git' --exclude='tmp' \
     -e "ssh -i ~/.ssh/merchalyzer_deploy_key" \
     ./ ray-svc@192.168.100.206:/opt/merchalyzer/
   ```

2. **Deploy on server:**
   ```bash
   ssh -i ~/.ssh/merchalyzer_deploy_key ray-svc@192.168.100.206
   cd /opt/merchalyzer
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

## Services

After deployment, the following services will be available:

- **Main Application**: http://192.168.100.206:3030
- **Upscayl Service**: http://192.168.100.206:5001
- **Health Check**: http://192.168.100.206:3030/api/health

## Docker Configuration

### Production Dockerfile Features

- Multi-stage build for optimized image size
- Non-root user for security
- Health checks with curl
- Production-optimized Node.js runtime

### Docker Compose Services

1. **web**: Next.js application on port 3030
2. **upscayl**: Image upscaling service on port 5001

## Environment Variables

Production environment variables are defined in `env.production`:

```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://192.168.100.206:3030
PORT=3000
```

## Monitoring and Maintenance

### Check Service Status

```bash
ssh -i ~/.ssh/merchalyzer_deploy_key ray-svc@192.168.100.206
cd /opt/merchalyzer
docker-compose ps
```

### View Logs

```bash
# All logs
docker-compose logs -f

# Specific service logs
docker-compose logs -f web
docker-compose logs -f upscayl
```

### Restart Services

```bash
docker-compose restart
```

### Update Deployment

```bash
docker-compose pull
docker-compose up -d
```

### Cleanup

```bash
# Remove stopped containers
docker-compose down

# Remove unused images
docker image prune -f

# Remove unused volumes
docker volume prune -f
```

## Troubleshooting

### Common Issues

1. **Port 3030 already in use:**
   ```bash
   # Check what's using the port
   sudo lsof -i :3030
   # Kill the process or change port in docker-compose.yml
   ```

2. **SSH connection issues:**
   ```bash
   # Test SSH connection
   ssh -i ~/.ssh/merchalyzer_deploy_key ray-svc@192.168.100.206
   ```

3. **Docker build failures:**
   ```bash
   # Check build logs
   docker-compose build --no-cache
   docker-compose logs
   ```

4. **Health check failures:**
   ```bash
   # Test health endpoint
   curl http://localhost:3000/api/health
   ```

## Security Considerations

- SSH keys are used for passwordless authentication
- Docker containers run as non-root users
- Health checks ensure service availability
- Environment variables are externalized
- No sensitive data in Docker images

## Performance Optimization

- Multi-stage Docker build reduces image size
- Node.js production mode enabled
- Health checks for container orchestration
- Automatic cleanup of old Docker images
