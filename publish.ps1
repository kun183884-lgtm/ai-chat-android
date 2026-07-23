$ErrorActionPreference = "Stop"

# Try loading config file first (gitignored, safe)
$configPath = Join-Path $PSScriptRoot "publish-config.ps1"
if (Test-Path $configPath) { . $configPath }

if (-not $env:GH_TOKEN) { throw "GH_TOKEN not set! Create publish-config.ps1 or set env var." }
$token = $env:GH_TOKEN
$headers = @{ Authorization = "Bearer $token"; Accept = "application/vnd.github.v3+json" }
$root = "C:\tools\AIChat"

Set-Location -LiteralPath $root

# 1. Bump version
Write-Host "[1/7] Bumping version..."
& "$root\bump-version.ps1"

# 2. Read new version
$gradle = Get-Content "$root\android\app\build.gradle"
$versionCode = [regex]::Match($gradle, 'versionCode\s+(\d+)').Groups[1].Value
$versionName = [regex]::Match($gradle, 'versionName "(\d+\.\d+)"').Groups[1].Value
Write-Host "  → v$versionName (code $versionCode)"

# 3. Build APK
Write-Host "[2/7] Building APK (this takes ~3 min)..."
$env:JAVA_HOME = "C:\tools\jdk17\jdk17.0.20_8"
$env:ANDROID_HOME = "C:\tools\android-sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

Write-Host "  → Generating JS bundle..."
npx.cmd react-native bundle --platform android --dev false --entry-file index.js --bundle-output "$root\android\app\src\main\assets\index.android.bundle" --assets-dest "$root\android\app\src\main\res" 2>&1
if ($LASTEXITCODE -ne 0) { throw "Bundle failed" }

Write-Host "  → Compiling APK..."
Set-Location -LiteralPath "$root\android"
.\gradlew.bat assembleDebug 2>&1
if ($LASTEXITCODE -ne 0) { throw "Compile failed" }
Copy-Item "$root\android\app\build\outputs\apk\debug\app-debug.apk" "$root\AIChat.apk" -Force
Set-Location -LiteralPath $root

# 4. Update App.tsx version constants
Write-Host "[3/7] Updating App.tsx version..."
$tsx = Get-Content "$root\App.tsx" -Raw
$tsx = $tsx -replace 'const APP_VERSION_CODE = \d+;', "const APP_VERSION_CODE = $versionCode;"
$tsx = $tsx -replace 'const APP_VERSION_NAME = ''[\d.]+'';', "const APP_VERSION_NAME = '$versionName';"
Set-Content "$root\App.tsx" -Value $tsx

# 5. Copy APK and update latest.json
Write-Host "[4/7] Copying APK and updating latest.json..."
Copy-Item "$root\AIChat.apk" "$root\AIChat-v$versionName.apk" -Force
$apkUrl = "https://github.com/kun183884-lgtm/ai-chat-android/releases/download/v$versionName/AIChat-v$versionName.apk"
$latestJson = @{
  versionCode = [int]$versionCode
  versionName = $versionName
  url = $apkUrl
  note = "自动发布 v$versionName"
} | ConvertTo-Json
Set-Content "$root\latest.json" -Value $latestJson

# 6. Git commit and push
Write-Host "[5/7] Pushing to GitHub..."
git add -A 2>&1
git commit -m "Release v$versionName" 2>&1
git push 2>&1
if ($LASTEXITCODE -ne 0) {
  git push -u origin main --force 2>&1
}

# 7. Delete existing release/tag if present (for re-publish)
Write-Host "[6/7] Creating GitHub Release v$versionName..."
try {
  $existing = Invoke-RestMethod -Uri "https://api.github.com/repos/kun183884-lgtm/ai-chat-android/releases/tags/v$versionName" -Headers $headers
  Invoke-RestMethod -Uri "https://api.github.com/repos/kun183884-lgtm/ai-chat-android/releases/$($existing.id)" -Method Delete -Headers $headers | Out-Null
  Write-Host "  → Deleted old release"
} catch {}
try {
  Invoke-RestMethod -Uri "https://api.github.com/repos/kun183884-lgtm/ai-chat-android/git/refs/tags/v$versionName" -Method Delete -Headers $headers | Out-Null
} catch {}

$releaseBody = @{
  tag_name = "v$versionName"
  target_commitish = "main"
  name = "v$versionName"
  body = "版本 $versionName (code $versionCode)`n`n自动发布"
  draft = $false
  prerelease = $false
} | ConvertTo-Json

$release = Invoke-RestMethod -Uri "https://api.github.com/repos/kun183884-lgtm/ai-chat-android/releases" -Method Post -Headers $headers -Body $releaseBody -ContentType "application/json"
Write-Host "  → Release ID: $($release.id)"

Write-Host "[7/7] Uploading APK to Release..."
$uploadUrl = "https://uploads.github.com/repos/kun183884-lgtm/ai-chat-android/releases/$($release.id)/assets?name=AIChat-v$versionName.apk"
$apkPath = "$root\AIChat.apk"
$result = curl.exe -s -L -X POST $uploadUrl -H "Authorization: Bearer $token" -H "Accept: application/vnd.github.v3+json" -H "Content-Type: application/vnd.android.package-archive" --data-binary "@$apkPath" 2>&1 | Out-String
try {
  $dlUrl = $result | ConvertFrom-Json | Select-Object -ExpandProperty browser_download_url
  Write-Host "  → APK uploaded: $dlUrl"
} catch {
  Write-Host "  → Upload response: $result"
}

Write-Host "`n=== PUBLISH COMPLETE: v$versionName ==="
