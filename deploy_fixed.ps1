# Merchalyzer Production Deployment Script (PowerShell) - Fixed Version
# Deploys the application to 192.168.100.206 on port 3030

param(
    [switch]$SkipBuild,
    [switch]$SkipPush
)

# Configuration
$RemoteHost = "192.168.100.206"
$RemoteUser = "ray-svc"
$RemotePath = "~/merchalyzer"
$SshKeyPath = "$env:USERPROFILE\.ssh\merchalyzer_deploy_key"

# Colors for output
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Cyan = "Cyan"

function Write-Status {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor $Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor $Cyan
}

Write-Host "🚀 Starting Merchalyzer Production Deployment" -ForegroundColor $Green

# Check if SSH key exists
if (-not (Test-Path $SshKeyPath)) {
    Write-Error "SSH key not found at $SshKeyPath"
    Write-Error "Please run the following command to generate SSH keys:"
    Write-Error "ssh-keygen -t rsa -b 4096 -C `"merchalyzer-deploy`" -f `"$env:USERPROFILE\.ssh\merchalyzer_deploy_key`" -N `"`""
    exit 1
}

# Test SSH connection
Write-Status "Testing SSH connection..."
try {
    $result = & ssh -i $SshKeyPath -o ConnectTimeout=10 -o BatchMode=yes "$RemoteUser@$RemoteHost" "echo 'SSH connection successful'" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "SSH connection failed"
    }
} catch {
    Write-Error "SSH connection failed: $_"
    exit 1
}

# Check Docker installation
Write-Status "Checking Docker installation on remote server..."
try {
    $dockerVersion = & ssh -i $SshKeyPath "$RemoteUser@$RemoteHost" "docker --version" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not found"
    }
    Write-Info "Docker version: $dockerVersion"
} catch {
    Write-Error "Docker is not installed on remote server"
    exit 1
}

# Check Docker Compose installation (try both old and new syntax)
try {
    $composeVersion = & ssh -i $SshKeyPath "$RemoteUser@$RemoteHost" "docker compose version 2>$null || docker-compose --version 2>$null" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose not found"
    }
    Write-Info "Docker Compose available"
} catch {
    Write-Error "Docker Compose is not installed on remote server"
    exit 1
}

# Create remote directory
Write-Status "Creating remote deployment directory..."
try {
    & ssh -i $SshKeyPath "$RemoteUser@$RemoteHost" "mkdir -p $RemotePath" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create remote directory"
    }
} catch {
    Write-Error "Failed to create remote directory: $_"
    exit 1
}

# Copy project files
Write-Status "Copying project files to remote server..."
Write-Info "Using tar/scp to transfer files (this may take a while)..."

# Create a temporary tar file excluding unwanted directories
$tempTar = "deploy_temp.tar.gz"
Write-Info "Creating deployment archive..."

try {
    # Create exclude patterns file
    $excludeFile = "deploy_excludes.txt"
    @"
node_modules
.git
tmp
.next
*.log
deploy_temp.tar.gz
deploy_excludes.txt
"@ | Out-File -FilePath $excludeFile -Encoding UTF8

    # Create tar archive excluding unwanted files
    & tar -czf $tempTar --exclude-from=$excludeFile .
    if ($LASTEXITCODE -ne 0) {
        throw "tar creation failed"
    }

    # Transfer the archive
    Write-Info "Transferring files to remote server..."
    & scp -i $SshKeyPath $tempTar "$RemoteUser@$RemoteHost`:$RemotePath/"
    if ($LASTEXITCODE -ne 0) {
        throw "scp transfer failed"
    }

    # Extract on remote server
    Write-Info "Extracting files on remote server..."
    & ssh -i $SshKeyPath "$RemoteUser@$RemoteHost" "cd $RemotePath && tar -xzf $tempTar && rm $tempTar"
    if ($LASTEXITCODE -ne 0) {
        throw "remote extraction failed"
    }

    # Cleanup local temp files
    Remove-Item $tempTar -ErrorAction SilentlyContinue
    Remove-Item $excludeFile -ErrorAction SilentlyContinue

} catch {
    Write-Error "Failed to copy files to remote server: $_"
    # Cleanup on error
    Remove-Item $tempTar -ErrorAction SilentlyContinue
    Remove-Item $excludeFile -ErrorAction SilentlyContinue
    exit 1
}

# Build and deploy
Write-Status "Building and deploying application..."

# Stop existing containers
Write-Info "Stopping existing containers..."
& ssh -i $SshKeyPath "$RemoteUser@$RemoteHost" "cd $RemotePath && (docker compose down || docker-compose down)" 2>$null

# Build new images
Write-Info "Building Docker images..."
& ssh -i $SshKeyPath "$RemoteUser@$RemoteHost" "cd $RemotePath && (docker compose build --no-cache || docker-compose build --no-cache)" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build failed"
    exit 1
}

# Start services
Write-Info "Starting services..."
& ssh -i $SshKeyPath "$RemoteUser@$RemoteHost" "cd $RemotePath && (docker compose up -d || docker-compose up -d)" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to start services"
    exit 1
}

# Wait for services to start
Write-Status "Waiting for services to start..."
Start-Sleep -Seconds 30

# Check service status
Write-Status "Checking service status..."
$statusOutput = & ssh -i $SshKeyPath "$RemoteUser@$RemoteHost" "cd $RemotePath && (docker compose ps || docker-compose ps)" 2>$null
if ($statusOutput -match "Up") {
    Write-Status "Services are running successfully!"
    Write-Host ""
    Write-Host "Application URLs:" -ForegroundColor $Green
    Write-Host "  Main App: http://$RemoteHost`:3030" -ForegroundColor $Cyan
    Write-Host "  Upscayl Service: http://$RemoteHost`:5001" -ForegroundColor $Cyan
} else {
    Write-Error "Services failed to start properly"
    Write-Host "Container status:" -ForegroundColor $Red
    Write-Host $statusOutput
    Write-Host ""
    Write-Host "Recent logs:" -ForegroundColor $Red
    $logs = & ssh -i $SshKeyPath "$RemoteUser@$RemoteHost" "cd $RemotePath && (docker compose logs --tail=50 || docker-compose logs --tail=50)" 2>$null
    Write-Host $logs
    exit 1
}

# Clean up old images
Write-Status "Cleaning up old Docker images..."
& ssh -i $SshKeyPath "$RemoteUser@$RemoteHost" "docker image prune -f" 2>$null

Write-Host ""
Write-Host "🎉 Deployment completed successfully!" -ForegroundColor $Green
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor $Yellow
Write-Host "  Check logs: ssh -i $SshKeyPath $RemoteUser@$RemoteHost 'cd $RemotePath && docker-compose logs -f'"
Write-Host "  Restart: ssh -i $SshKeyPath $RemoteUser@$RemoteHost 'cd $RemotePath && docker-compose restart'"
Write-Host "  Stop: ssh -i $SshKeyPath $RemoteUser@$RemoteHost 'cd $RemotePath && docker-compose down'"
