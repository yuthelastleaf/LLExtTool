# Whisper.cpp Auto Setup Script for Windows
# Encoding: UTF-8 with BOM

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host "Whisper.cpp Auto Setup Script" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
$whisperDir = Join-Path $projectRoot "native\whisper.cpp"
$modelDir = Join-Path $projectRoot "models\whisper"

Write-Host ""
Write-Host "Project: $projectRoot"
Write-Host "Whisper: $whisperDir"

# Check dependencies
Write-Host ""
Write-Host "[Step 1] Checking dependencies..." -ForegroundColor Cyan

# Check Git
try {
    $gitVersion = git --version 2>$null
    Write-Host "[OK] Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Git not found" -ForegroundColor Red
    Write-Host "Please install Git from: https://git-scm.com/download/win"
    exit 1
}

# Check CMake
try {
    $cmakeVersion = cmake --version 2>$null | Select-Object -First 1
    Write-Host "[OK] CMake: $cmakeVersion" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] CMake not found" -ForegroundColor Red
    Write-Host "Please install CMake from: https://cmake.org/download/"
    Write-Host "Or run: choco install cmake"
    exit 1
}

# Check Visual Studio
$vsPath = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" `
    -latest -property installationPath 2>$null

if (-not $vsPath) {
    Write-Host "[WARN] Visual Studio not found" -ForegroundColor Yellow
    Write-Host "You need Visual Studio 2019 or later with C++ development tools"
    $response = Read-Host "Continue anyway? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        exit 1
    }
} else {
    Write-Host "[OK] Visual Studio: $vsPath" -ForegroundColor Green
}

try {
    # Clone or update whisper.cpp
    if (Test-Path $whisperDir) {
        Write-Host ""
        Write-Host "[Step 2] Updating whisper.cpp..." -ForegroundColor Cyan
        Push-Location $whisperDir
        git pull origin master
        Pop-Location
        Write-Host "[OK] Update completed" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "[Step 2] Cloning whisper.cpp..." -ForegroundColor Cyan
        New-Item -ItemType Directory -Force -Path (Split-Path $whisperDir) | Out-Null
        git clone https://github.com/ggerganov/whisper.cpp.git $whisperDir
        Write-Host "[OK] Clone completed" -ForegroundColor Green
    }

    # Build whisper.cpp
    Write-Host ""
    Write-Host "[Step 3] Building whisper.cpp..." -ForegroundColor Cyan
    $buildDir = Join-Path $whisperDir "build"
    
    Write-Host "Configuring CMake..."
    Push-Location $whisperDir
    
    cmake -B build -G "Visual Studio 17 2022" -A x64 `
        -DBUILD_SHARED_LIBS=ON `
        -DWHISPER_BUILD_EXAMPLES=OFF `
        -DWHISPER_BUILD_TESTS=OFF 2>&1 | Out-Null
    
    Write-Host "Building (this may take a few minutes)..."
    cmake --build build --config Release 2>&1 | Out-Null
    
    Pop-Location
    Write-Host "[OK] Build completed" -ForegroundColor Green

    # Verify output
    Write-Host ""
    Write-Host "[Step 4] Verifying build..." -ForegroundColor Cyan
    $whisperDll = Join-Path $buildDir "bin\Release\whisper.dll"
    
    if (Test-Path $whisperDll) {
        $size = (Get-Item $whisperDll).Length / 1MB
        $sizeStr = "{0:N2}" -f $size
        Write-Host "[OK] whisper.dll ($sizeStr MB)" -ForegroundColor Green
    } else {
        throw "whisper.dll not generated"
    }

    # Download model
    Write-Host ""
    Write-Host "[Step 5] Download Whisper model..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $modelDir | Out-Null
    
    $models = @(
        @{ Name = "tiny"; Size = "75 MB"; File = "ggml-tiny.bin" },
        @{ Name = "base"; Size = "142 MB"; File = "ggml-base.bin" }
    )

    Write-Host ""
    Write-Host "Available models:"
    Write-Host "  [1] tiny (75 MB)  - Fastest, less accurate"
    Write-Host "  [2] base (142 MB) - Balanced (Recommended)"
    Write-Host "  [3] Skip download"

    $choice = Read-Host "Choose model to download (1-3)"
    
    if ($choice -eq "1" -or $choice -eq "2") {
        $selectedModel = $models[$choice - 1]
        $modelFile = Join-Path $modelDir $selectedModel.File
        
        if (Test-Path $modelFile) {
            Write-Host "[OK] Model already exists: $($selectedModel.File)" -ForegroundColor Green
        } else {
            Write-Host "Downloading $($selectedModel.Name) model..."
            
            # Download using download-ggml-model script
            $downloadScript = Join-Path $whisperDir "models\download-ggml-model.cmd"
            if (Test-Path $downloadScript) {
                Push-Location (Join-Path $whisperDir "models")
                & cmd.exe /c "download-ggml-model.cmd $($selectedModel.Name)"
                Pop-Location
                
                # Copy to project models directory
                $downloadedModel = Join-Path $whisperDir "models\$($selectedModel.File)"
                if (Test-Path $downloadedModel) {
                    Copy-Item $downloadedModel $modelFile
                    Write-Host "[OK] Model downloaded: $modelFile" -ForegroundColor Green
                } else {
                    Write-Host "[WARN] Model download may have failed" -ForegroundColor Yellow
                }
            } else {
                Write-Host "[WARN] Download script not found, please download manually" -ForegroundColor Yellow
                Write-Host "Download from: https://huggingface.co/ggerganov/whisper.cpp"
            }
        }
    } else {
        Write-Host "Skipped model download" -ForegroundColor Yellow
        Write-Host "You can download models later from: https://huggingface.co/ggerganov/whisper.cpp"
    }

    Write-Host ""
    Write-Host "Whisper.cpp setup completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Installation location:"
    Write-Host "  - Source:  $whisperDir"
    Write-Host "  - DLL:     $whisperDll"
    Write-Host "  - Models:  $modelDir"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Run: npm run build:native"
    Write-Host "  2. Start using Whisper features"

} catch {
    Write-Host ""
    Write-Host "[ERROR] $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "All operations completed!" -ForegroundColor Green
