# deploy.ps1 — Stop server, pull changes, migrate DB, rebuild, restart on port 7200

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# ── 1. Stop any process currently listening on port 7200 ──────────────────────
Write-Host "Checking for process on port 7200..."
$listening = netstat -ano | Select-String "TCP\s+[^\s]+:7200\s+[^\s]+\s+LISTENING"
foreach ($line in $listening) {
    $parts = $line.Line.Trim() -split '\s+'
    $procId = $parts[-1]
    if ($procId -match '^\d+$' -and [int]$procId -gt 0) {
        Write-Host "  Stopping PID $procId..."
        Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

# ── 2. Pull latest changes ─────────────────────────────────────────────────────
Write-Host "Pulling latest changes..."
git pull
if ($LASTEXITCODE -ne 0) { throw "git pull failed" }

# ── 3. Install dependencies ────────────────────────────────────────────────────
Write-Host "Installing dependencies..."
yarn install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw "yarn install failed" }

# ── 4. Run database migrations / push schema ──────────────────────────────────
Write-Host "Applying database schema..."
yarn db:push
if ($LASTEXITCODE -ne 0) { throw "db:push failed" }

# ── 5. Build the app ──────────────────────────────────────────────────────────
Write-Host "Building application..."
yarn build
if ($LASTEXITCODE -ne 0) { throw "yarn build failed" }

# ── 6. Load .env and start server in background ───────────────────────────────
Write-Host "Loading environment from .env..."
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and !$line.StartsWith('#') -and $line -match '^([^=]+)=(.*)$') {
            $key   = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
        }
    }
}

$env:PORT = "7200"
$env:HOST = "0.0.0.0"

New-Item -ItemType Directory -Force -Path "logs" | Out-Null

Write-Host "Starting server on port 7200..."
$proc = Start-Process `
    -FilePath "node" `
    -ArgumentList "build/index.js" `
    -RedirectStandardOutput "logs/server.log" `
    -RedirectStandardError  "logs/server.error.log" `
    -WindowStyle Hidden `
    -PassThru

Write-Host "Server started (PID $($proc.Id)). Logs: logs/server.log"
