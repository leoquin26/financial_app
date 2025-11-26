# Fix Development Server Infinite Loop

Write-Host "`nFixing webpack hot reload loop..." -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Yellow

# Step 1: Stop any running processes
Write-Host "`n1. Stopping Node processes..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Step 2: Clear webpack cache
Write-Host "2. Clearing webpack cache..." -ForegroundColor Cyan
$cachePath = Join-Path $PSScriptRoot "client\node_modules\.cache"
if (Test-Path $cachePath) {
    Remove-Item -Path $cachePath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   Cache cleared!" -ForegroundColor Green
} else {
    Write-Host "   No cache found" -ForegroundColor Gray
}

# Step 3: Remove hot update files
Write-Host "3. Removing hot update files..." -ForegroundColor Cyan
Get-ChildItem -Path (Join-Path $PSScriptRoot "client") -Filter "*.hot-update.*" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force
Write-Host "   Hot update files removed!" -ForegroundColor Green

# Step 4: Clear React Scripts cache
Write-Host "4. Clearing React build cache..." -ForegroundColor Cyan
$buildPath = Join-Path $PSScriptRoot "client\build"
if (Test-Path $buildPath) {
    Remove-Item -Path $buildPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   Build cache cleared!" -ForegroundColor Green
}

# Step 5: Create temporary env file to disable fast refresh
Write-Host "5. Configuring development environment..." -ForegroundColor Cyan
$envContent = @"
# Temporary fix for hot reload loop
FAST_REFRESH=false
CHOKIDAR_USEPOLLING=false
WDS_SOCKET_PORT=0
"@

$envPath = Join-Path $PSScriptRoot "client\.env.development.local"
$envContent | Out-File -FilePath $envPath -Encoding utf8
Write-Host "   Environment configured!" -ForegroundColor Green

Write-Host "`n✅ Fixes applied!" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green

Write-Host "`n📝 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Clear your browser cache (Ctrl+Shift+Delete)" -ForegroundColor White
Write-Host "   2. Close all browser tabs with the app" -ForegroundColor White
Write-Host "   3. Run: cd client && npm start" -ForegroundColor White
Write-Host "   4. Use a new incognito/private window" -ForegroundColor White

Write-Host "`n💡 If the problem persists:" -ForegroundColor Cyan
Write-Host "   - Try a different port: npm start -- --port 3001" -ForegroundColor White
Write-Host "   - Or restart your computer to clear all processes" -ForegroundColor White

Write-Host "`nPress any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
