@echo off
REM Check DLL dependencies using dumpbin (Visual Studio tool)
REM Run this in Visual Studio Developer Command Prompt

echo Checking llvideo.node dependencies...
echo.

REM Try to find dumpbin in common Visual Studio paths
set DUMPBIN="C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\dumpbin.exe"

if exist %DUMPBIN% (
    echo Found dumpbin: %DUMPBIN%
    echo.
    echo === llvideo.node dependencies ===
    %DUMPBIN% /dependents build\bin\Release\llvideo.node
    echo.
    echo === llwhisper.node dependencies ===
    %DUMPBIN% /dependents build\bin\Release\llwhisper.node
) else (
    echo ERROR: dumpbin not found at expected location
    echo Please run this from Visual Studio Developer Command Prompt
    echo Or install Visual Studio with C++ tools
)

pause
