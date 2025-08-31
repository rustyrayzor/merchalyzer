# Simple test script to debug deployment issues
$RemoteHost = "192.168.100.206"
$RemoteUser = "ray-svc"
$SshKeyPath = "$env:USERPROFILE\.ssh\merchalyzer_deploy_key"

Write-Host "Testing SSH connection..." -ForegroundColor Green
try {
    $result = & ssh -i $SshKeyPath -o ConnectTimeout=10 -o BatchMode=yes "$RemoteUser@$RemoteHost" "echo 'SSH connection successful'" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SSH connection successful" -ForegroundColor Green
    } else {
        Write-Host "SSH connection failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host "SSH connection error: $_" -ForegroundColor Red
}

Write-Host "Testing Docker..." -ForegroundColor Green
try {
    $dockerVersion = & ssh -i $SshKeyPath "$RemoteUser@$RemoteHost" "docker --version" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker found: $dockerVersion" -ForegroundColor Green
    } else {
        Write-Host "Docker not found, exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "Output: $dockerVersion" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Docker check error: $_" -ForegroundColor Red
}
