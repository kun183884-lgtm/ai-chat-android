$file = "C:\tools\AIChat\android\app\build.gradle"
$lines = Get-Content $file

for ($i = 0; $i -lt $lines.Count; $i++) {
  $line = $lines[$i]
  if ($line -match 'versionCode\s+(\d+)') {
    $num = [int]$Matches[1]
    $lines[$i] = $line -replace $Matches[1], ($num + 1)
  }
  if ($line -match 'versionName "(\d+\.\d+)"') {
    $ver = [double]$Matches[1]
    $newVer = [Math]::Round($ver + 0.01, 2)
    $lines[$i] = '        versionName "{0:F2}"' -f $newVer
  }
}

$lines | Set-Content $file
Write-Host "Version bumped!"
