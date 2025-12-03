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
