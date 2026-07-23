@echo off
chcp 65001 >nul
echo Building AI Chat APK...
set JAVA_HOME=C:\tools\jdk17\jdk17.0.20_8
set ANDROID_HOME=C:\tools\android-sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bump-version.ps1"

echo [1/2] Generating JS bundle...
call npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res

echo [2/2] Compiling APK...
cd /d "%~dp0android"
call gradlew.bat assembleDebug

if %errorlevel%==0 (
    copy /Y app\build\outputs\apk\debug\app-debug.apk "%~dp0AIChat.apk" >nul
    echo.
    echo ==============================
    echo BUILD SUCCESS!
    echo APK: %~dp0AIChat.apk
    echo ==============================
) else (
    echo BUILD FAILED!
)
pause
