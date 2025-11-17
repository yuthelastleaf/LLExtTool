# 修复 electron-builder winCodeSign 缓存的符号链接问题
# 通过删除有问题的 macOS 符号链接文件来避免打包错误

$ErrorActionPreference = "Continue"

# 缓存目录
$cacheDir = Join-Path $env:LOCALAPPDATA "electron-builder\Cache\winCodeSign"

Write-Host "清理 winCodeSign 缓存..." -ForegroundColor Yellow

if (Test-Path $cacheDir) {
    # 删除整个缓存目录
    Remove-Item -Path $cacheDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✓ 缓存已清理" -ForegroundColor Green
} else {
    Write-Host "缓存目录不存在，无需清理" -ForegroundColor Gray
}

# 重新下载并手动提取（跳过符号链接）
Write-Host "`n开始下载 winCodeSign..." -ForegroundColor Yellow

$url = "https://npmmirror.com/mirrors/electron-builder-binaries/winCodeSign-2.6.0/winCodeSign-2.6.0.7z"
$zipFile = "$env:TEMP\winCodeSign-2.6.0.7z"
$extractDir = "$cacheDir\winCodeSign-2.6.0"

# 下载
try {
    Invoke-WebRequest -Uri $url -OutFile $zipFile -ErrorAction Stop
    Write-Host "✓ 下载完成" -ForegroundColor Green
} catch {
    Write-Host "✗ 下载失败: $_" -ForegroundColor Red
    exit 1
}

# 创建目标目录
New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

# 使用 7z 提取，忽略符号链接错误
Write-Host "开始提取..." -ForegroundColor Yellow
$sevenZip = "F:\GitProject\LLExtTool\node_modules\7zip-bin\win\x64\7za.exe"

if (Test-Path $sevenZip) {
    # 提取但忽略错误（符号链接会失败，但我们不需要 macOS 文件）
    & $sevenZip x -bd $zipFile "-o$extractDir" 2>&1 | Out-Null
    
    # 删除有问题的 macOS 目录（我们只需要 Windows 文件）
    $darwinDir = Join-Path $extractDir "darwin"
    if (Test-Path $darwinDir) {
        Remove-Item -Path $darwinDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✓ 已删除 macOS 相关文件" -ForegroundColor Green
    }
    
    Write-Host "✓ 提取完成" -ForegroundColor Green
} else {
    Write-Host "✗ 找不到 7-Zip" -ForegroundColor Red
    exit 1
}

# 清理临时文件
Remove-Item -Path $zipFile -Force -ErrorAction SilentlyContinue

Write-Host "`n✓ 修复完成！现在可以运行打包命令了。" -ForegroundColor Green
