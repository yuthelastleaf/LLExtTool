# CTranslate2 Build Script
# Similar to whisper.cpp build approach

param(
    [switch]$CUDA = $false,
    [switch]$Clean = $false
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CTranslate2 Build Script (Windows)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check source directory
$SourceDir = "$PSScriptRoot\..\native\ctranslate2-source"
$BuildDir = "$PSScriptRoot\..\native\ctranslate2-source\build"
$InstallDir = "$PSScriptRoot\..\native\ctranslate2"

if (-not (Test-Path $SourceDir)) {
    Write-Host "[ERROR] CTranslate2 source not found!" -ForegroundColor Red
    Write-Host "  Please clone first:" -ForegroundColor Yellow
    Write-Host "  git clone git@github.com:OpenNMT/CTranslate2.git native/ctranslate2-source" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Source directory: $SourceDir" -ForegroundColor Green

# Clean build directory
if ($Clean -and (Test-Path $BuildDir)) {
    Write-Host "Cleaning build directory..." -ForegroundColor Yellow
    Remove-Item -Path $BuildDir -Recurse -Force
}

# Create build directory
if (-not (Test-Path $BuildDir)) {
    New-Item -Path $BuildDir -ItemType Directory -Force | Out-Null
}

# Create install directory
if (-not (Test-Path $InstallDir)) {
    New-Item -Path $InstallDir -ItemType Directory -Force | Out-Null
}

# Check CMake
try {
    $cmakeVersion = cmake --version | Select-Object -First 1
    Write-Host "[OK] CMake: $cmakeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] CMake not found in PATH" -ForegroundColor Red
    Write-Host "  Install from: https://cmake.org/download/" -ForegroundColor Yellow
    exit 1
}

# Check Visual Studio
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vsWhere) {
    $vsPath = & $vsWhere -latest -property installationPath
    Write-Host "[OK] Visual Studio: $vsPath" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Visual Studio not found" -ForegroundColor Red
    exit 1
}

# Check CUDA (if enabled)
if ($CUDA) {
    if ($env:CUDA_PATH) {
        Write-Host "[OK] CUDA: $env:CUDA_PATH" -ForegroundColor Green
        $cudaEnabled = "ON"
    } else {
        Write-Host "[WARN] CUDA_PATH not set, building CPU version" -ForegroundColor Yellow
        $cudaEnabled = "OFF"
    }
} else {
    Write-Host "[INFO] Building CPU version (use -CUDA for GPU)" -ForegroundColor Cyan
    $cudaEnabled = "OFF"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuring CMake..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# CMake 配置
Push-Location $BuildDir

try {
    $cmakeArgs = @(
        "..",
        "-G", "Visual Studio 17 2022",
        "-A", "x64",
        "-DCMAKE_INSTALL_PREFIX=$InstallDir",
        "-DCMAKE_BUILD_TYPE=Release",
        "-DWITH_CUDA=$cudaEnabled",
        "-DWITH_CUDNN=OFF",  # CuDNN 需要单独下载
        "-DWITH_MKL=OFF",    # Intel MKL 需要单独安装
        "-DBUILD_CLI=OFF",   # 不需要命令行工具
        "-DBUILD_TESTS=OFF", # 不编译测试
        "-DBUILD_SHARED_LIBS=ON"  # 编译动态库
    )
    
    Write-Host "执行: cmake $($cmakeArgs -join ' ')" -ForegroundColor Cyan
    & cmake @cmakeArgs
    
    if ($LASTEXITCODE -ne 0) {
        throw "CMake 配置失败"
    }
    
    Write-Host ""
    Write-Host "[OK] CMake configuration complete" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Building..." -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # 编译
    & cmake --build . --config Release --parallel
    
    if ($LASTEXITCODE -ne 0) {
        throw "编译失败"
    }
    
    Write-Host ""
    Write-Host "[OK] Build complete" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Installing..." -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # 安装
    & cmake --install . --config Release
    
    if ($LASTEXITCODE -ne 0) {
        throw "安装失败"
    }
    
    Write-Host ""
    Write-Host "[OK] Install complete" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "[ERROR] Build failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

# Verify build
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verifying build..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$libPath = "$InstallDir\lib\ctranslate2.lib"
$dllPath = "$InstallDir\bin\ctranslate2.dll"
$includePath = "$InstallDir\include\ctranslate2"

$allGood = $true

if (Test-Path $libPath) {
    Write-Host "[OK] Library: $libPath" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Library not found: $libPath" -ForegroundColor Red
    $allGood = $false
}

if (Test-Path $dllPath) {
    Write-Host "[OK] DLL: $dllPath" -ForegroundColor Green
} else {
    Write-Host "[ERROR] DLL not found: $dllPath" -ForegroundColor Red
    $allGood = $false
}

if (Test-Path $includePath) {
    Write-Host "[OK] Headers: $includePath" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Headers not found: $includePath" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""

if ($allGood) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  CTranslate2 Build Success!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Install directory: $InstallDir" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Run scripts/convert-translation-model.ps1 to convert models" -ForegroundColor Yellow
    Write-Host "2. Run npx electron-rebuild to rebuild native modules" -ForegroundColor Yellow
    Write-Host "3. Run npm start to launch the app" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Build failed, check errors above" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}
