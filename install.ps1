param(
  [string]$Platform = $(if ($env:PAPERMENTOR_TARGET) { $env:PAPERMENTOR_TARGET } else { "codex" })
)

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

function Copy-PaperMentorSkill($Dest) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Dest) | Out-Null
  if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null

  Copy-Item -Recurse -Path (Join-Path $RootDir "skills\papermentor\*") -Destination $Dest
  Copy-Item -Recurse -Path (Join-Path $RootDir "prompts") -Destination (Join-Path $Dest "prompts")
  Copy-Item -Recurse -Path (Join-Path $RootDir "templates") -Destination (Join-Path $Dest "templates")
  Copy-Item -Recurse -Path (Join-Path $RootDir "examples") -Destination (Join-Path $Dest "examples")
  Copy-Item -Recurse -Path (Join-Path $RootDir "tests") -Destination (Join-Path $Dest "tests")
  Copy-Item -Recurse -Path (Join-Path $RootDir "scripts") -Destination (Join-Path $Dest "scripts")
}

function Install-Codex() {
  $CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
  $Dest = Join-Path $CodexHome "skills\papermentor"
  Copy-PaperMentorSkill $Dest
  Write-Host "PaperMentor installed for Codex: $Dest"
}

function Install-Claude() {
  $ClaudeHome = if ($env:CLAUDE_HOME) { $env:CLAUDE_HOME } else { Join-Path $HOME ".claude" }
  $Dest = Join-Path $ClaudeHome "skills\papermentor"
  Copy-PaperMentorSkill $Dest
  Write-Host "PaperMentor installed for Claude Code: $Dest"
}

switch ($Platform.ToLowerInvariant()) {
  "codex" { Install-Codex }
  "claude" { Install-Claude }
  "claude-code" { Install-Claude }
  "all" { Install-Codex; Install-Claude }
  "both" { Install-Codex; Install-Claude }
  default { throw "Usage: install.ps1 [codex|claude|all]" }
}

Write-Host 'Try: Use $papermentor on a paper URL, then open .papermentor/sessions/<paper>/index.html.'
