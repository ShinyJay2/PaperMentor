$ErrorActionPreference = "Stop"

$RepoUrl = if ($env:PAPERMENTOR_REPO_URL) { $env:PAPERMENTOR_REPO_URL } else { "https://github.com/ShinyJay2/PaperMentor.git" }
$CacheDir = if ($env:PAPERMENTOR_HOME) { Join-Path $env:PAPERMENTOR_HOME "repo" } else { Join-Path $HOME ".papermentor\repo" }
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path (Join-Path $RootDir "skills\papermentor"))) {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "PaperMentor install requires git for one-line remote installation."
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $CacheDir) | Out-Null
  if (Test-Path (Join-Path $CacheDir ".git")) {
    git -C $CacheDir pull --ff-only | Out-Null
  } else {
    if (Test-Path $CacheDir) { Remove-Item -Recurse -Force $CacheDir }
    git clone --depth 1 $RepoUrl $CacheDir | Out-Null
  }
  $RootDir = $CacheDir
}

$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$Dest = Join-Path $CodexHome "skills\papermentor"

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Dest) | Out-Null
if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
New-Item -ItemType Directory -Force -Path $Dest | Out-Null

Copy-Item -Recurse -Path (Join-Path $RootDir "skills\papermentor\*") -Destination $Dest
Copy-Item -Recurse -Path (Join-Path $RootDir "prompts") -Destination (Join-Path $Dest "prompts")
Copy-Item -Recurse -Path (Join-Path $RootDir "templates") -Destination (Join-Path $Dest "templates")
Copy-Item -Recurse -Path (Join-Path $RootDir "examples") -Destination (Join-Path $Dest "examples")
Copy-Item -Recurse -Path (Join-Path $RootDir "tests") -Destination (Join-Path $Dest "tests")

Write-Host "PaperMentor installed to $Dest"
Write-Host 'Try: Use $papermentor to scan this paper.'
