# 快速安装 CTranslate2 预编译版本
# 这是最简单的方法，无需编译

param(
    [string]$Version = "4.5.0"  # 默认版本
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== CTranslate2 快速安装 (预编译版本) ===`n" -ForegroundColor Cyan

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$InstallDir = Join-Path $ProjectRoot "native\ctranslate2"
$TempDir = Join-Path $env:TEMP "ctranslate2-download"

Write-Host "安装目录: $InstallDir" -ForegroundColor Gray
Write-Host "版本: $Version`n" -ForegroundColor Gray

# 创建目录
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

if (-not (Test-Path $TempDir)) {
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
}

# 下载 URL
$downloadUrl = "https://github.com/OpenNMT/CTranslate2/releases/download/v$Version/ctranslate2-$Version-windows-x64.zip"
$zipFile = Join-Path $TempDir "ctranslate2.zip"

Write-Host "正在下载 CTranslate2 v$Version..." -ForegroundColor Yellow
Write-Host "URL: $downloadUrl" -ForegroundColor Gray
Write-Host ""

try {
    # 使用 .NET WebClient 下载（支持进度显示）
    $webClient = New-Object System.Net.WebClient
    
    # 注册进度事件
    $downloadComplete = $false
    Register-ObjectEvent -InputObject $webClient -EventName DownloadProgressChanged -SourceIdentifier WebClient.DownloadProgressChanged -Action {
        $percent = $EventArgs.ProgressPercentage
        Write-Progress -Activity "下载 CTranslate2" -Status "$percent% 完成" -PercentComplete $percent
    } | Out-Null
    
    Register-ObjectEvent -InputObject $webClient -EventName DownloadFileCompleted -SourceIdentifier WebClient.DownloadFileCompleted -Action {
        $script:downloadComplete = $true
    } | Out-Null
    
    # 开始下载
    $webClient.DownloadFileAsync((New-Object System.Uri($downloadUrl)), $zipFile)
    
    # 等待下载完成
    while (-not $downloadComplete) {
        Start-Sleep -Milliseconds 100
    }
    
    # 清理事件
    Unregister-Event -SourceIdentifier WebClient.DownloadProgressChanged
    Unregister-Event -SourceIdentifier WebClient.DownloadFileCompleted
    $webClient.Dispose()
    
    Write-Progress -Activity "下载 CTranslate2" -Completed
    Write-Host "✓ 下载完成`n" -ForegroundColor Green
    
} catch {
    Write-Host "✗ 下载失败: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "请手动下载:" -ForegroundColor Yellow
    Write-Host "1. 访问: https://github.com/OpenNMT/CTranslate2/releases" -ForegroundColor Gray
    Write-Host "2. 下载: ctranslate2-$Version-windows-x64.zip" -ForegroundColor Gray
    Write-Host "3. 解压到: $InstallDir" -ForegroundColor Gray
    exit 1
}

# 解压
Write-Host "正在解压..." -ForegroundColor Yellow

try {
    Expand-Archive -Path $zipFile -DestinationPath $TempDir -Force
    Write-Host "✓ 解压完成`n" -ForegroundColor Green
} catch {
    Write-Host "✗ 解压失败: $_" -ForegroundColor Red
    exit 1
}

# 查找解压后的目录
$extractedDir = Get-ChildItem -Path $TempDir -Directory | Where-Object { $_.Name -like "ctranslate2-*" } | Select-Object -First 1

if (-not $extractedDir) {
    Write-Host "✗ 未找到解压的文件" -ForegroundColor Red
    exit 1
}

Write-Host "正在安装到项目目录..." -ForegroundColor Yellow

# 复制文件
try {
    # 复制所有内容
    Copy-Item -Path "$($extractedDir.FullName)\*" -Destination $InstallDir -Recurse -Force
    Write-Host "✓ 安装完成`n" -ForegroundColor Green
} catch {
    Write-Host "✗ 安装失败: $_" -ForegroundColor Red
    exit 1
}

# 清理临时文件
Write-Host "清理临时文件..." -ForegroundColor Gray
Remove-Item -Path $TempDir -Recurse -Force

# 验证安装
Write-Host "`n=== 验证安装 ===`n" -ForegroundColor Cyan

$requiredFiles = @{
    "ctranslate2.dll" = Join-Path $InstallDir "bin\ctranslate2.dll"
    "ctranslate2.lib" = Join-Path $InstallDir "lib\ctranslate2.lib"
    "translator.h" = Join-Path $InstallDir "include\ctranslate2\translator.h"
}

$allExists = $true
foreach ($file in $requiredFiles.GetEnumerator()) {
    if (Test-Path $file.Value) {
        Write-Host "✓ $($file.Key)" -ForegroundColor Green
    } else {
        Write-Host "✗ $($file.Key) 缺失" -ForegroundColor Red
        $allExists = $false
    }
}

Write-Host ""

if ($allExists) {
    Write-Host "=== 安装成功！===" -ForegroundColor Green
    Write-Host ""
    Write-Host "CTranslate2 已安装到:" -ForegroundColor Cyan
    Write-Host "  $InstallDir" -ForegroundColor White
    Write-Host ""
    Write-Host "下一步:" -ForegroundColor Yellow
    Write-Host "  1. 运行: node test-translate.js (测试翻译模块)" -ForegroundColor Gray
    Write-Host "  2. 下载翻译模型" -ForegroundColor Gray
    Write-Host "  3. 运行: npm run build (重新编译项目)" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "=== 安装失败 ===" -ForegroundColor Red
    Write-Host "请检查上述缺失的文件" -ForegroundColor Gray
    exit 1
}
