<#
  Starts the three logged-in Chrome sessions the scheduler drives.

  Safe to run any time: it checks each debug port first and only launches the
  profiles that are not already up, so double-clicking twice does nothing bad.

  Each platform gets its OWN profile directory, so the sessions never collide
  with each other or with your everyday Chrome.
#>

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

$Chrome = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $Chrome) {
  Write-Host "Chrome not found in the usual locations." -ForegroundColor Red
  Read-Host "Press Enter to close"; exit 1
}

$Sessions = @(
  @{ Name = 'LinkedIn';  Port = 9222; Dir = 'chrome-linkedin-profile'; Url = 'https://www.linkedin.com/feed/' },
  @{ Name = 'X';         Port = 9223; Dir = 'chrome-x-profile';        Url = 'https://x.com/home' },
  @{ Name = 'Instagram'; Port = 9224; Dir = 'chrome-ig-profile';       Url = 'https://business.facebook.com/latest/home' },
  @{ Name = 'TikTok';    Port = 9225; Dir = 'chrome-tiktok-profile';   Url = 'https://www.tiktok.com/tiktokstudio/upload' }
)

function Test-Port($Port) {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 3 -UseBasicParsing
    return $r.StatusCode -eq 200
  } catch { return $false }
}

Write-Host ""
Write-Host "  Social scheduler - session launcher" -ForegroundColor Cyan
Write-Host "  ----------------------------------" -ForegroundColor Cyan

foreach ($s in $Sessions) {
  if (Test-Port $s.Port) {
    Write-Host ("  [already up] {0,-10} port {1}" -f $s.Name, $s.Port) -ForegroundColor DarkGray
    continue
  }
  $profileDir = Join-Path $Root $s.Dir
  if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Path $profileDir -Force | Out-Null }

  Start-Process -FilePath $Chrome -ArgumentList @(
    "--remote-debugging-port=$($s.Port)",
    "--user-data-dir=`"$profileDir`"",
    '--no-first-run',
    '--no-default-browser-check',
    '--restore-last-session',
    $s.Url
  )
  Write-Host ("  [launched]   {0,-10} port {1}" -f $s.Name, $s.Port) -ForegroundColor Green
  Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "  Verifying..." -ForegroundColor Cyan
Start-Sleep -Seconds 4

$down = @()
foreach ($s in $Sessions) {
  if (Test-Port $s.Port) {
    Write-Host ("    OK    {0,-10} http://127.0.0.1:{1}" -f $s.Name, $s.Port) -ForegroundColor Green
  } else {
    Write-Host ("    DOWN  {0,-10} port {1}" -f $s.Name, $s.Port) -ForegroundColor Red
    $down += $s.Name
  }
}

Write-Host ""
if ($down.Count -eq 0) {
  Write-Host "  All three sessions are up." -ForegroundColor Green
  Write-Host "  If a window shows a login page, log in once - it persists after that."
} else {
  Write-Host ("  Not up: {0}. Try running this again." -f ($down -join ', ')) -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Then schedule with:" -ForegroundColor Cyan
Write-Host "    node schedule.cjs --list"
Write-Host "    node schedule.cjs --id <post-id> --dry-run"
Write-Host ""
Read-Host "Press Enter to close"
