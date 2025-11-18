# Build SentencePiece library for Windows
# This script compiles SentencePiece from source

$ErrorActionPreference = "Stop"

$ROOT_DIR = $PSScriptRoot
$SENTENCEPIECE_DIR = Join-Path $ROOT_DIR "native\sentencepiece"
$BUILD_DIR = Join-Path $SENTENCEPIECE_DIR "build"
$INSTALL_DIR = Join-Path $ROOT_DIR "native\sentencepiece-install"

Write-Host "=== Building SentencePiece ===" -ForegroundColor Green
Write-Host ""

# Check if Git is available
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Git is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if CMake is available
if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
    Write-Host "Error: CMake is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Clone SentencePiece if not exists
if (-not (Test-Path $SENTENCEPIECE_DIR)) {
    Write-Host "Cloning SentencePiece repository (shallow clone for speed)..." -ForegroundColor Yellow
    git clone --depth 1 --branch v0.2.0 https://github.com/google/sentencepiece.git $SENTENCEPIECE_DIR
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to clone SentencePiece, trying without branch..." -ForegroundColor Yellow
        git clone --depth 1 https://github.com/google/sentencepiece.git $SENTENCEPIECE_DIR
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to clone SentencePiece" -ForegroundColor Red
            exit 1
        }
    }
} else {
    Write-Host "SentencePiece directory already exists, skipping clone" -ForegroundColor Cyan
}

# Create build directory
if (Test-Path $BUILD_DIR) {
    Write-Host "Removing existing build directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $BUILD_DIR
}
New-Item -ItemType Directory -Path $BUILD_DIR | Out-Null

# Configure with CMake
Write-Host ""
Write-Host "Configuring SentencePiece with CMake..." -ForegroundColor Yellow
Set-Location $BUILD_DIR

cmake .. `
    -G "Visual Studio 17 2022" `
    -A x64 `
    -DCMAKE_INSTALL_PREFIX="$INSTALL_DIR" `
    -DCMAKE_BUILD_TYPE=Release `
    -DSPM_ENABLE_SHARED=OFF `
    -DSPM_ENABLE_TCMALLOC=OFF `
    -DSPM_USE_BUILTIN_PROTOBUF=ON `
    -DCMAKE_MSVC_RUNTIME_LIBRARY="MultiThreaded"

if ($LASTEXITCODE -ne 0) {
    Write-Host "CMake configuration failed" -ForegroundColor Red
    Set-Location $ROOT_DIR
    exit 1
}

# Build
Write-Host ""
Write-Host "Building SentencePiece (this may take several minutes)..." -ForegroundColor Yellow
cmake --build . --config Release --parallel

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed" -ForegroundColor Red
    Set-Location $ROOT_DIR
    exit 1
}

# Install
Write-Host ""
Write-Host "Installing SentencePiece..." -ForegroundColor Yellow
cmake --install . --config Release

if ($LASTEXITCODE -ne 0) {
    Write-Host "Installation failed" -ForegroundColor Red
    Set-Location $ROOT_DIR
    exit 1
}

Set-Location $ROOT_DIR

Write-Host ""
Write-Host "=== SentencePiece built successfully ===" -ForegroundColor Green
Write-Host ""
Write-Host "Installation directory: $INSTALL_DIR" -ForegroundColor Cyan
Write-Host "  - Include: $INSTALL_DIR\include" -ForegroundColor Cyan
Write-Host "  - Library: $INSTALL_DIR\lib" -ForegroundColor Cyan
Write-Host "  - Binary:  $INSTALL_DIR\bin" -ForegroundColor Cyan
Write-Host ""
