# 翻译模型转换脚本
# 将 Hugging Face 模型转换为 CTranslate2 格式

param(
    [Parameter(Mandatory=$false)]
    [string]$ModelName = "Helsinki-NLP/opus-mt-ja-zh",
    
    [Parameter(Mandatory=$false)]
    [string]$OutputName = "opus-mt-ja-zh-ct2",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("float32", "float16", "int8", "int16")]
    [string]$Quantization = "float16"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  翻译模型转换脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "模型: $ModelName" -ForegroundColor Cyan
Write-Host "输出: $OutputName" -ForegroundColor Cyan
Write-Host "量化: $Quantization" -ForegroundColor Cyan
Write-Host ""

# 检查 Python
try {
    $pythonVersion = python --version
    Write-Host "✓ Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python 未安装或不在 PATH 中" -ForegroundColor Red
    Write-Host "  请安装 Python 3.8+: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# 检查/安装依赖
Write-Host ""
Write-Host "检查 Python 依赖..." -ForegroundColor Yellow

$packages = @("ctranslate2", "transformers", "sentencepiece", "protobuf")

foreach ($pkg in $packages) {
    $installed = python -m pip show $pkg 2>$null
    if ($installed) {
        Write-Host "✓ $pkg 已安装" -ForegroundColor Green
    } else {
        Write-Host "ℹ 安装 $pkg..." -ForegroundColor Yellow
        python -m pip install $pkg -i https://pypi.tuna.tsinghua.edu.cn/simple
        if ($LASTEXITCODE -ne 0) {
            Write-Host "✗ 安装 $pkg 失败" -ForegroundColor Red
            exit 1
        }
    }
}

# 创建输出目录
$OutputDir = "$PSScriptRoot\..\native\models\$OutputName"
if (-not (Test-Path "$PSScriptRoot\..\native\models")) {
    New-Item -Path "$PSScriptRoot\..\native\models" -ItemType Directory -Force | Out-Null
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  开始转换模型..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 转换模型
try {
    $convertCmd = "ct2-transformers-converter"
    $convertArgs = @(
        "--model", $ModelName,
        "--output_dir", $OutputDir,
        "--quantization", $Quantization,
        "--force"
    )
    
    Write-Host "执行: $convertCmd $($convertArgs -join ' ')" -ForegroundColor Cyan
    Write-Host ""
    
    & $convertCmd @convertArgs
    
    if ($LASTEXITCODE -ne 0) {
        throw "模型转换失败"
    }
    
} catch {
    Write-Host ""
    Write-Host "✗ 转换失败: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "如果是网络问题，可以尝试:" -ForegroundColor Yellow
    Write-Host "1. 设置 Hugging Face 镜像:" -ForegroundColor Yellow
    Write-Host "   `$env:HF_ENDPOINT = 'https://hf-mirror.com'" -ForegroundColor Yellow
    Write-Host "2. 或者手动下载模型后转换:" -ForegroundColor Yellow
    Write-Host "   git clone https://huggingface.co/$ModelName" -ForegroundColor Yellow
    Write-Host "   ct2-transformers-converter --model ./$($ModelName.Split('/')[-1]) --output_dir $OutputDir" -ForegroundColor Yellow
    exit 1
}

# 验证转换结果
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  验证转换结果..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$requiredFiles = @("model.bin", "config.json")
$allGood = $true

foreach ($file in $requiredFiles) {
    $filePath = Join-Path $OutputDir $file
    if (Test-Path $filePath) {
        $size = (Get-Item $filePath).Length / 1MB
        Write-Host "✓ $file ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
    } else {
        Write-Host "✗ $file 未找到" -ForegroundColor Red
        $allGood = $false
    }
}

# 检查词汇表
$vocabFiles = @("shared_vocabulary.json", "shared_vocabulary.txt", "source_vocabulary.json", "target_vocabulary.json")
$vocabFound = $false
foreach ($vocabFile in $vocabFiles) {
    if (Test-Path (Join-Path $OutputDir $vocabFile)) {
        Write-Host "✓ $vocabFile" -ForegroundColor Green
        $vocabFound = $true
        break
    }
}

if (-not $vocabFound) {
    Write-Host "⚠ 词汇表文件未找到（可能使用内嵌词汇表）" -ForegroundColor Yellow
}

Write-Host ""

if ($allGood) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✓ 模型转换成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "模型路径: $OutputDir" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "下一步:" -ForegroundColor Yellow
    Write-Host "1. 运行 npx electron-rebuild 重新编译 native 模块" -ForegroundColor Yellow
    Write-Host "2. 运行 npm start 启动应用" -ForegroundColor Yellow
    Write-Host "3. 在应用中测试翻译功能" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ✗ 模型转换有问题" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}

# 显示支持的其他模型
Write-Host "其他支持的翻译模型:" -ForegroundColor Cyan
Write-Host "  日译中: Helsinki-NLP/opus-mt-ja-zh" -ForegroundColor Gray
Write-Host "  英译中: Helsinki-NLP/opus-mt-en-zh" -ForegroundColor Gray
Write-Host "  韩译中: Helsinki-NLP/opus-mt-ko-zh" -ForegroundColor Gray
Write-Host "  日译英: Helsinki-NLP/opus-mt-ja-en" -ForegroundColor Gray
Write-Host ""
Write-Host "转换其他模型示例:" -ForegroundColor Cyan
Write-Host "  .\scripts\convert-translation-model.ps1 -ModelName 'Helsinki-NLP/opus-mt-en-zh' -OutputName 'opus-mt-en-zh-ct2'" -ForegroundColor Gray
Write-Host ""
