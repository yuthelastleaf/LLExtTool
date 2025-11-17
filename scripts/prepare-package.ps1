# 打包前准备脚本
# 确保所有必要的文件都已准备好

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Package Preparation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查必需的文件
$requiredPaths = @{
    "TypeScript Build" = "dist/main/main.js"
    "Renderer HTML" = "dist/renderer/index.html"
    "llvideo Native Module" = "build/Release/llvideo.node"
    "llwhisper Native Module" = "build/Release/llwhisper.node"
    "FFmpeg DLLs" = "native/ffmpeg/bin/avcodec-61.dll"
    "Whisper DLLs" = "native/whisper.cpp/build/bin/Release/whisper.dll"
    "GGML DLLs" = "native/whisper.cpp/build/bin/Release/ggml.dll"
}

$missingFiles = @()
$allGood = $true

Write-Host "Checking required files..." -ForegroundColor Yellow
Write-Host ""

foreach ($item in $requiredPaths.GetEnumerator()) {
    $name = $item.Key
    $path = $item.Value
    $fullPath = Join-Path (Join-Path $PSScriptRoot "..") $path
    
    if (Test-Path $fullPath) {
        Write-Host "[OK] $name" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $name" -ForegroundColor Red
        Write-Host "  Path: $path" -ForegroundColor Gray
        $missingFiles += $name
        $allGood = $false
    }
}

Write-Host ""

# 检查可选文件（翻译模型）
Write-Host "Checking optional files..." -ForegroundColor Yellow
Write-Host ""

$optionalPaths = @{
    "CTranslate2 DLL" = "native/ctranslate2/bin/ctranslate2.dll"
    "Translation Model" = "native/models/opus-mt-ja-zh-ct2/model.bin"
}

foreach ($item in $optionalPaths.GetEnumerator()) {
    $name = $item.Key
    $path = $item.Value
    $fullPath = Join-Path (Join-Path $PSScriptRoot "..") $path
    
    if (Test-Path $fullPath) {
        Write-Host "[OK] $name" -ForegroundColor Green
    } else {
        Write-Host "[OPTIONAL] $name not found" -ForegroundColor Yellow
        Write-Host "  Translation feature will not be available" -ForegroundColor Gray
    }
}

Write-Host ""

# 检查图标文件
if (-not (Test-Path "$PSScriptRoot\..\assets\icon.ico")) {
    Write-Host "[WARN] Application icon not found: assets/icon.ico" -ForegroundColor Yellow
    Write-Host "  Creating placeholder..." -ForegroundColor Gray
    New-Item -Path "$PSScriptRoot\..\assets" -ItemType Directory -Force | Out-Null
    Write-Host "  Please add icon.ico to assets/ directory" -ForegroundColor Yellow
    Write-Host ""
}

# 检查许可证文件
if (-not (Test-Path "$PSScriptRoot\..\LICENSE")) {
    Write-Host "[WARN] LICENSE file not found" -ForegroundColor Yellow
    Write-Host "  Creating placeholder..." -ForegroundColor Gray
    "MIT License`n`nCopyright (c) 2025 yuthelastleaf" | Out-File -FilePath "$PSScriptRoot\..\LICENSE" -Encoding UTF8
    Write-Host ""
}

# 显示结果
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($allGood) {
    Write-Host "[SUCCESS] All required files are ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now run:" -ForegroundColor Yellow
    Write-Host "  npm run package        - Build installer (NSIS) and ZIP" -ForegroundColor Cyan
    Write-Host "  npm run package:win    - Build for Windows x64" -ForegroundColor Cyan
    Write-Host "  npm run package:dir    - Build unpacked directory" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Output will be in: release/" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "[ERROR] Missing required files:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "  - $file" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Please build the project first:" -ForegroundColor Yellow
    Write-Host "  npm run build          - Build TypeScript" -ForegroundColor Cyan
    Write-Host "  npx electron-rebuild   - Build native modules" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# 显示包大小估算
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Package Size Estimation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Get-FolderSize {
    param([string]$Path)
    if (Test-Path $Path) {
        $size = (Get-ChildItem -Path $Path -Recurse -File -ErrorAction SilentlyContinue | 
                 Measure-Object -Property Length -Sum).Sum
        return [math]::Round($size / 1MB, 2)
    }
    return 0
}

$distSize = Get-FolderSize "$PSScriptRoot\..\dist"
$nativeSize = Get-FolderSize "$PSScriptRoot\..\native"
$buildSize = Get-FolderSize "$PSScriptRoot\..\build"

Write-Host "TypeScript Build:  $distSize MB" -ForegroundColor Gray
Write-Host "Native Modules:    $buildSize MB" -ForegroundColor Gray
Write-Host "Native Libraries:  $nativeSize MB" -ForegroundColor Gray
Write-Host ""
$totalSize = $distSize + $nativeSize + $buildSize
Write-Host "Estimated Total:   $totalSize MB" -ForegroundColor Cyan
Write-Host "(Actual installer will be compressed)" -ForegroundColor Gray
Write-Host ""
