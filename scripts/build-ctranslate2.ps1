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
$SourceDir = "$PSScriptRoot\..\native\ctranslate2"

if (Test-Path "$SourceDir\CMakeLists.txt") {
    Write-Host "[OK] Found CTranslate2 source: native/ctranslate2" -ForegroundColor Green
} else {
    Write-Host "[ERROR] CTranslate2 source code not found!" -ForegroundColor Red
    Write-Host "  Expected location: native/ctranslate2/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Method 1: Use git clone" -ForegroundColor Cyan
    Write-Host "  git clone https://github.com/OpenNMT/CTranslate2.git native/ctranslate2" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Method 2: Download zip file" -ForegroundColor Cyan
    Write-Host "  https://github.com/OpenNMT/CTranslate2/archive/refs/heads/master.zip" -ForegroundColor Gray
    exit 1
}

$BuildDir = "$SourceDir\build"
$InstallDir = "$PSScriptRoot\..\native\ctranslate2-built"

Write-Host "[INFO] 源码目录: $SourceDir" -ForegroundColor Cyan
Write-Host "[INFO] 构建目录: $BuildDir" -ForegroundColor Cyan
Write-Host "[INFO] 安装目录: $InstallDir" -ForegroundColor Cyan
Write-Host ""

# Check if git submodules are initialized
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Checking Git submodules..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$spdlogPath = Join-Path $SourceDir "third_party\spdlog\CMakeLists.txt"
$cpuFeaturesPath = Join-Path $SourceDir "third_party\cpu_features\CMakeLists.txt"

if (-not (Test-Path $spdlogPath) -or -not (Test-Path $cpuFeaturesPath)) {
    Write-Host "[WARN] Git submodules not initialized, initializing..." -ForegroundColor Yellow
    
    Push-Location $SourceDir
    try {
        # Check if it's a git repository
        $isGitRepo = Test-Path ".git"
        
        if ($isGitRepo) {
            Write-Host "Running: git submodule update --init --recursive" -ForegroundColor Gray
            & git submodule update --init --recursive
            
            if ($LASTEXITCODE -ne 0) {
                throw "Git submodule initialization failed"
            }
            Write-Host "[OK] Git submodules initialized successfully" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Source directory is not a Git repository!" -ForegroundColor Red
            Write-Host ""
            Write-Host "Please use one of these methods to get complete source:" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Method 1: Use git clone (recommended)" -ForegroundColor Cyan
            Write-Host "  git clone --recursive https://github.com/OpenNMT/CTranslate2.git native/ctranslate2" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Method 2: Manually initialize submodules" -ForegroundColor Cyan
            Write-Host "  cd native/ctranslate2" -ForegroundColor Gray
            Write-Host "  git submodule update --init --recursive" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Method 3: Download prebuilt version (easiest)" -ForegroundColor Cyan
            Write-Host "  https://github.com/OpenNMT/CTranslate2/releases" -ForegroundColor Gray
            Write-Host "  Download ctranslate2-*-windows-x64.zip" -ForegroundColor Gray
            Write-Host ""
            Pop-Location
            exit 1
        }
    } catch {
        Write-Host "[ERROR] $_" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
} else {
    Write-Host "[OK] Git submodules already exist" -ForegroundColor Green
}

Write-Host ""

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
        "-DCMAKE_POLICY_DEFAULT_CMP0000=NEW",  # Fix cpu_features CMake version compatibility
        "-DWITH_CUDA=$cudaEnabled",
        "-DWITH_CUDNN=OFF",     # CuDNN requires separate download
        "-DWITH_MKL=OFF",       # Intel MKL requires separate install
        "-DWITH_DNNL=OFF",      # Don't use DNNL
        "-DWITH_OPENBLAS=OFF",  # Don't use OpenBLAS
        "-DOPENMP_RUNTIME=NONE", # Disable OpenMP (avoid libiomp5 not found)
        "-DBUILD_CLI=OFF",      # Don't need CLI tools
        "-DBUILD_TESTS=OFF",    # Don't compile tests
        "-DBUILD_SHARED_LIBS=ON", # Compile shared libraries
        "-DENABLE_CPU_DISPATCH=OFF" # Disable CPU dispatch (avoid dependency issues)
    )
    
    Write-Host "Running: cmake $($cmakeArgs -join ' ')" -ForegroundColor Cyan
    & cmake @cmakeArgs
    
    if ($LASTEXITCODE -ne 0) {
        throw "CMake configuration failed"
    }
    
    Write-Host ""
    Write-Host "[OK] CMake configuration complete" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Building..." -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Build
    & cmake --build . --config Release --parallel
    
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    
    Write-Host ""
    Write-Host "[OK] Build complete" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Installing..." -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Install
    & cmake --install . --config Release
    
    if ($LASTEXITCODE -ne 0) {
        throw "Install failed"
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
    Write-Host "1. Run: node test-translate.js (test translation module)" -ForegroundColor Yellow
    Write-Host "2. Download translation models" -ForegroundColor Yellow
    Write-Host "3. Run: npm run build (rebuild project)" -ForegroundColor Yellow
    Write-Host "4. Run: npm start (launch app)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Model download commands:" -ForegroundColor Cyan
    Write-Host "pip install ctranslate2 transformers" -ForegroundColor Gray
    Write-Host "ct2-transformers-converter --model Helsinki-NLP/opus-mt-ja-zh --output_dir native/models/opus-mt-ja-zh-ct2" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Build failed, check errors above" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues and solutions:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Git submodules not initialized" -ForegroundColor Cyan
    Write-Host "   Error: third_party/spdlog does not contain a CMakeLists.txt" -ForegroundColor Gray
    Write-Host "   Fix: cd native/ctranslate2 && git submodule update --init --recursive" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Intel OpenMP (libiomp5) not found" -ForegroundColor Cyan
    Write-Host "   Error: Intel OpenMP runtime libiomp5 not found" -ForegroundColor Gray
    Write-Host "   Fix: Already disabled in script, check CMake cache if still fails" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Visual Studio components missing" -ForegroundColor Cyan
    Write-Host "   Fix: Install 'Desktop development with C++' workload" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Too complex? Use prebuilt binaries!" -ForegroundColor Cyan
    Write-Host "   Run: .\scripts\install-ctranslate2.ps1" -ForegroundColor Green
    Write-Host "   This will download prebuilt DLLs, no compilation needed" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
