Write-Host "Stopping Claude Code Command Center..." -ForegroundColor Yellow
Get-Process -Name "node", "bun" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Stopped." -ForegroundColor Green
