# Claude Code Command Center - Windows Setup Script
# For Matt's ThinkPad X1 running Windows

$ErrorActionPreference = "Stop"

Write-Host @"
+=============================================================+
|     Claude Code Command Center - Windows Setup              |
|     Neural Observatory for HackLearn Pro                    |
+=============================================================+
"@ -ForegroundColor Cyan

function Write-Step { param($msg) Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Check prerequisites
Write-Step "Checking prerequisites..."

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Success "Node.js found: $nodeVersion"
} catch {
    Write-Err "Node.js not found. Please install from https://nodejs.org/"
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Success "npm found: $npmVersion"
} catch {
    Write-Err "npm not found. Please install Node.js from https://nodejs.org/"
    exit 1
}

# Check Python
try {
    $pythonVersion = python --version
    Write-Success "Python found: $pythonVersion"
} catch {
    try {
        $pythonVersion = python3 --version
        Write-Success "Python3 found: $pythonVersion"
    } catch {
        Write-Warning "Python not found. Hooks may not work properly."
        Write-Warning "Install from https://python.org/"
    }
}

# Check Bun (optional, will use npm as fallback)
$useBun = $false
try {
    $bunVersion = bun --version
    Write-Success "Bun found: $bunVersion"
    $useBun = $true
} catch {
    Write-Warning "Bun not found. Will use npm for server."
    Write-Warning "For better performance, install Bun: https://bun.sh/"
}

Write-Host ""
Write-Step "Setting up Command Center..."

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Install server dependencies
Write-Step "Installing server dependencies..."
Set-Location server
if ($useBun) {
    bun install
} else {
    npm install
}
Set-Location ..

# Install dashboard dependencies
Write-Step "Installing dashboard dependencies..."
Set-Location dashboard
npm install
Set-Location ..

# Setup Claude Code configuration
Write-Step "Setting up Claude Code configuration..."

$claudeDir = "$env:USERPROFILE\.claude"
$dirs = @("agents", "commands", "hooks", "memory")

# Create directories
New-Item -ItemType Directory -Force -Path $claudeDir | Out-Null
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Force -Path "$claudeDir\$dir" | Out-Null
}

# Copy template files
if (Test-Path ".claude-template") {
    Copy-Item -Recurse -Force ".claude-template\*" $claudeDir
    Write-Success "Copied configuration to $claudeDir"
}

# Update hook paths for Windows
Write-Step "Configuring hooks for Windows..."
$settingsPath = "$claudeDir\settings.json"
if (Test-Path $settingsPath) {
    $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json

    # Update Python command to use 'python' instead of 'python3' on Windows
    $settingsJson = Get-Content $settingsPath -Raw
    $settingsJson = $settingsJson -replace 'python3', 'python'
    $settingsJson = $settingsJson -replace '\.claude/hooks/', "$claudeDir\hooks\" -replace '/', '\'
    Set-Content $settingsPath $settingsJson

    Write-Success "Updated hook paths for Windows"
}

# Create start script
Write-Step "Creating convenience scripts..."

$startScript = @'
# Start Claude Code Command Center - Neural Observatory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host @"

    _   __                     __   ____  __                              __
   / | / /__  __  ___________ _/ /  / __ \/ /_  ________  ______   ______ _/ /_____  _______  __
  /  |/ / _ \/ / / / ___/ __ `/ /  / / / / __ \/ ___/ _ \/ ___/ | / / __ `/ __/ __ \/ ___/ / / /
 / /|  /  __/ /_/ / /  / /_/ / /  / /_/ / /_/ (__  )  __/ /   | |/ / /_/ / /_/ /_/ / /  / /_/ /
/_/ |_/\___/\__,_/_/   \__,_/_/   \____/_.___/____/\___/_/    |___/\__,_/\__/\____/_/   \__, /
                                                                                       /____/
"@ -ForegroundColor Cyan

Write-Host "Starting Claude Code Command Center..." -ForegroundColor Yellow

# Start server (using Node.js compatible version)
$serverJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location "$dir\server"
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        bun run start
    } else {
        npm run start:node
    }
} -ArgumentList $scriptDir

Start-Sleep -Seconds 3

# Start dashboard
$dashboardJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location "$dir\dashboard"
    npm run dev
} -ArgumentList $scriptDir

Start-Sleep -Seconds 2

Write-Host @"

+=============================================================+
|  NEURAL OBSERVATORY IS ONLINE                               |
+=============================================================+
|                                                             |
|  Dashboard:  http://localhost:5173                          |
|  Server:     http://localhost:4000                          |
|                                                             |
|  Open the dashboard in your browser to view:                |
|    - Real-time thought patterns                             |
|    - Context health monitoring                              |
|    - Agent utilization                                      |
|    - Session insights                                       |
|                                                             |
|  Press Ctrl+C to stop                                       |
+=============================================================+
"@ -ForegroundColor Green

# Open dashboard in browser
Start-Process "http://localhost:5173"

# Wait and cleanup
try {
    while ($true) {
        Start-Sleep -Seconds 1
        Receive-Job $serverJob, $dashboardJob -ErrorAction SilentlyContinue
    }
} finally {
    Stop-Job $serverJob, $dashboardJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob, $dashboardJob -ErrorAction SilentlyContinue
    Write-Host "Neural Observatory shutdown complete." -ForegroundColor Yellow
}
'@

Set-Content "start.ps1" $startScript

# Create stop script
$stopScript = @'
Write-Host "Stopping Claude Code Command Center..." -ForegroundColor Yellow
Get-Process -Name "node", "bun" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Stopped." -ForegroundColor Green
'@

Set-Content "stop.ps1" $stopScript

# Create batch file wrappers for easier execution
@"
@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"
"@ | Set-Content "start.bat"

@"
@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
"@ | Set-Content "stop.bat"

Write-Host ""
Write-Success "Setup complete!"
Write-Host ""

Write-Host @"
+=============================================================+
|                     SETUP COMPLETE                          |
+=============================================================+
|                                                             |
|  To start the Command Center:                               |
|    .\start.bat  (or .\start.ps1)                           |
|                                                             |
|  To stop:                                                   |
|    .\stop.bat  (or .\stop.ps1 or Ctrl+C)                   |
|                                                             |
|  Your .claude folder is configured at:                      |
|    $env:USERPROFILE\.claude\                                |
|                                                             |
|  Available agents:                                          |
|    @researcher   - Deep exploration                         |
|    @implementer  - Systematic building                      |
|    @reviewer     - Code quality checks                      |
|    @consensus    - Multi-perspective decisions              |
|    @memory-keeper - Long-term project memory                |
|                                                             |
|  Available commands:                                        |
|    /research, /implement, /review, /decide,                 |
|    /memory, /test, /hacklearn                               |
|                                                             |
+=============================================================+
"@ -ForegroundColor Cyan

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run .\start.bat to launch the Command Center"
Write-Host "2. Open http://localhost:5173 in your browser"
Write-Host "3. Start a Claude Code session in any project"
Write-Host "4. Watch events stream into your Neural Observatory!"
Write-Host ""
