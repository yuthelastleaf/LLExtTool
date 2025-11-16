# Whisper Model Downloader
param(
    [string]$ModelSize = "tiny"
)

$ModelsDir = "models\whisper"
$BaseUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main"

# Model files and sizes
$Models = @{
    "tiny" = @{
        "file" = "ggml-tiny.bin"
        "size" = "75 MB"
    }
    "base" = @{
        "file" = "ggml-base.bin"
        "size" = "142 MB"
    }
    "small" = @{
        "file" = "ggml-small.bin"
        "size" = "466 MB"
    }
}

if (-not $Models.ContainsKey($ModelSize)) {
    Write-Host "Invalid model size. Available: tiny, base, small" -ForegroundColor Red
    exit 1
}

$ModelFile = $Models[$ModelSize].file
$ModelUrl = "$BaseUrl/$ModelFile"
$OutputPath = "$ModelsDir\$ModelFile"

Write-Host "Whisper Model Downloader" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Model: $ModelSize ($($Models[$ModelSize].size))" -ForegroundColor Yellow
Write-Host "URL: $ModelUrl" -ForegroundColor Gray
Write-Host ""

# Create models directory
if (-not (Test-Path $ModelsDir)) {
    Write-Host "Creating models directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $ModelsDir -Force | Out-Null
}

# Check if model already exists
if (Test-Path $OutputPath) {
    $FileSize = (Get-Item $OutputPath).Length
    $FileSizeMB = [math]::Round($FileSize / 1MB, 2)
    Write-Host "Model already exists ($FileSizeMB MB)" -ForegroundColor Green
    Write-Host "Path: $OutputPath" -ForegroundColor Gray
    Write-Host ""
    
    $Response = Read-Host "Download again? (y/n)"
    if ($Response -ne "y") {
        Write-Host "Using existing model." -ForegroundColor Green
        exit 0
    }
}

# Download model
try {
    Write-Host "Downloading model..." -ForegroundColor Yellow
    Write-Host "This may take a few minutes depending on your connection." -ForegroundColor Gray
    Write-Host ""
    
    $ProgressPreference = 'Continue'
    Invoke-WebRequest -Uri $ModelUrl -OutFile $OutputPath -UseBasicParsing
    
    $FileSize = (Get-Item $OutputPath).Length
    $FileSizeMB = [math]::Round($FileSize / 1MB, 2)
    
    Write-Host ""
    Write-Host "✓ Download complete! ($FileSizeMB MB)" -ForegroundColor Green
    Write-Host "Model saved to: $OutputPath" -ForegroundColor Gray
} catch {
    Write-Host ""
    Write-Host "✗ Download failed: $_" -ForegroundColor Red
    exit 1
}
