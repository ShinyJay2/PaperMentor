param(
  [string]$Platform = $(if ($env:PAPERMENTOR_TARGET) { $env:PAPERMENTOR_TARGET } else { "codex" }),
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ExtraArgs
)

$ErrorActionPreference = "Stop"

$RepoUrl = if ($env:PAPERMENTOR_REPO_URL) { $env:PAPERMENTOR_REPO_URL } else { "https://github.com/ShinyJay2/PaperMentor.git" }
$CacheDir = if ($env:PAPERMENTOR_HOME) { Join-Path $env:PAPERMENTOR_HOME "repo" } else { Join-Path $HOME ".papermentor\repo" }
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path (Join-Path $RootDir "scripts\install.mjs")) -or -not (Test-Path (Join-Path $RootDir "papermentor.manifest.json"))) {
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

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "PaperMentor install requires Node.js 18+ on PATH."
}

& node (Join-Path $RootDir "scripts\install.mjs") $Platform @ExtraArgs
