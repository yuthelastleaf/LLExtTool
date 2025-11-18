# 编译测试程序

$CTRANSLATE2_DIR = "f:\GitProject\LLExtTool\native\ctranslate2"
$SOURCE = "f:\GitProject\LLExtTool\native\test_ctranslate2.cpp"
$OUTPUT = "f:\GitProject\LLExtTool\native\test_ctranslate2.exe"

Write-Host "Compiling CTranslate2 test program..."

# 使用 cl.exe 编译
cl.exe /EHsc /std:c++17 `
    /I"$CTRANSLATE2_DIR\include" `
    /I"$CTRANSLATE2_DIR\third_party" `
    "$SOURCE" `
    /link `
    /LIBPATH:"$CTRANSLATE2_DIR\lib" `
    ctranslate2.lib `
    /OUT:"$OUTPUT"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nCompilation successful!" -ForegroundColor Green
    Write-Host "`nRunning test program..."
    
    # 复制 DLL 到输出目录
    Copy-Item "$CTRANSLATE2_DIR\bin\ctranslate2.dll" "f:\GitProject\LLExtTool\native\" -Force
    
    # 运行测试
    & $OUTPUT
} else {
    Write-Host "`nCompilation failed!" -ForegroundColor Red
}
