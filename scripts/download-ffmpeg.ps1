# FFmpeg Auto Download Script for Windows
# Encoding: UTF-8 with BOM

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host "FFmpeg Auto Download Script" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Configuration
$downloadUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.1-latest-win64-lgpl-shared-7.1.zip"
$tempDir = Join-Path $env:TEMP "ffmpeg-download"
$projectRoot = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $projectRoot "native\ffmpeg"

Write-Host ""
Write-Host "Project: $projectRoot"
Write-Host "Target:  $targetDir"

# Check if already exists
if (Test-Path "$targetDir\bin\avcodec-61.dll") {
    Write-Host ""
    Write-Host "[INFO] FFmpeg already installed at: $targetDir" -ForegroundColor Green
    
    $response = Read-Host "Re-download? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Skipped." -ForegroundColor Yellow
        exit 0
    }
}

# Create temp directory
Write-Host ""
Write-Host "[Step 1] Preparing..." -ForegroundColor Cyan
if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
}
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
Write-Host "[OK] Temp directory created" -ForegroundColor Green

try {
    # Download FFmpeg
    Write-Host ""
    Write-Host "[Step 2] Downloading FFmpeg (~120MB)..." -ForegroundColor Cyan
    $zipFile = Join-Path $tempDir "ffmpeg.zip"
    
    Write-Host "URL: $downloadUrl"
    Write-Host "Downloading, please wait..."
    
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFile -UseBasicParsing
    $ProgressPreference = 'Continue'
    
    $sizeMB = (Get-Item $zipFile).Length / 1MB
    Write-Host ("[OK] Downloaded: {0:N2} MB" -f $sizeMB) -ForegroundColor Green

    # Extract
    Write-Host ""
    Write-Host "[Step 3] Extracting files..." -ForegroundColor Cyan
    Expand-Archive -Path $zipFile -DestinationPath $tempDir -Force
    Write-Host "[OK] Extraction completed" -ForegroundColor Green

    # Find extracted directory
    $extractedDir = Get-ChildItem -Path $tempDir -Directory | Where-Object { $_.Name -like "ffmpeg-*" } | Select-Object -First 1
    if (-not $extractedDir) {
        throw "Cannot find extracted FFmpeg directory"
    }

    Write-Host ""
    Write-Host "[Step 4] Copying files to project..." -ForegroundColor Cyan
    
    # Create target directories
    New-Item -ItemType Directory -Force -Path "$targetDir\bin" | Out-Null
    New-Item -ItemType Directory -Force -Path "$targetDir\include" | Out-Null
    New-Item -ItemType Directory -Force -Path "$targetDir\lib" | Out-Null

    # Copy bin (DLL files)
    Copy-Item -Path "$($extractedDir.FullName)\bin\*.dll" -Destination "$targetDir\bin\" -Force
    $dllCount = (Get-ChildItem "$targetDir\bin\*.dll").Count
    Write-Host "[OK] Copied $dllCount DLL files" -ForegroundColor Green

    # Copy include (header files)
    Copy-Item -Path "$($extractedDir.FullName)\include\*" -Destination "$targetDir\include\" -Recurse -Force
    $headerCount = (Get-ChildItem "$targetDir\include" -Recurse -File).Count
    Write-Host "[OK] Copied $headerCount header files" -ForegroundColor Green

    # Copy lib (link libraries)
    Copy-Item -Path "$($extractedDir.FullName)\lib\*.lib" -Destination "$targetDir\lib\" -Force
    $libCount = (Get-ChildItem "$targetDir\lib\*.lib").Count
    Write-Host "[OK] Copied $libCount library files" -ForegroundColor Green

    # Verify required files
    Write-Host ""
    Write-Host "[Step 5] Verifying installation..." -ForegroundColor Cyan
    $requiredDlls = @(
        "avcodec-61.dll",
        "avformat-61.dll",
        "avutil-59.dll",
        "swresample-5.dll"
    )

    $allExists = $true
    foreach ($dll in $requiredDlls) {
        $dllPath = Join-Path "$targetDir\bin" $dll
        if (Test-Path $dllPath) {
            $size = (Get-Item $dllPath).Length / 1MB
            $sizeStr = "{0:N2}" -f $size
            Write-Host "[OK] $dll ($sizeStr MB)" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] $dll not found" -ForegroundColor Red
            $allExists = $false
        }
    }

    if ($allExists) {
        Write-Host ""
        Write-Host "FFmpeg installation completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Installation location:"
        Write-Host "  - DLL files:  $targetDir\bin\"
        Write-Host "  - Headers:    $targetDir\include\"
        Write-Host "  - Libraries:  $targetDir\lib\"
        Write-Host ""
        Write-Host "Next steps:"
        Write-Host "  1. Run: npm run build:native"
        Write-Host "  2. Start using FFmpeg features"
    } else {
        throw "Some required files are missing"
    }

} catch {
    Write-Host ""
    Write-Host "[ERROR] $_" -ForegroundColor Red
    exit 1
} finally {
    # Cleanup
    Write-Host ""
    Write-Host "Cleaning up temporary files..." -ForegroundColor Cyan
    if (Test-Path $tempDir) {
        Remove-Item -Recurse -Force $tempDir
        Write-Host "[OK] Cleanup completed" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "All operations completed!" -ForegroundColor Green
