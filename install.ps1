$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$Dest = Join-Path $CodexHome "skills\papermentor"

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Dest) | Out-Null
if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
Copy-Item -Recurse -Path (Join-Path $RootDir "skills\papermentor") -Destination $Dest

Write-Host "PaperMentor installed to $Dest"
Write-Host 'Try: Use $papermentor to explain Equation (1) atomically.'
