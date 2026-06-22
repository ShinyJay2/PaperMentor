$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$Dest = Join-Path $CodexHome "skills\papermentor"

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Dest) | Out-Null
if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
New-Item -ItemType Directory -Force -Path $Dest | Out-Null

# Install the canonical Codex Skill entrypoint plus bundled production resources.
Copy-Item -Recurse -Path (Join-Path $RootDir "skills\papermentor\*") -Destination $Dest
Copy-Item -Recurse -Path (Join-Path $RootDir "prompts") -Destination (Join-Path $Dest "prompts")
Copy-Item -Recurse -Path (Join-Path $RootDir "templates") -Destination (Join-Path $Dest "templates")
Copy-Item -Recurse -Path (Join-Path $RootDir "examples") -Destination (Join-Path $Dest "examples")
Copy-Item -Recurse -Path (Join-Path $RootDir "tests") -Destination (Join-Path $Dest "tests")

Write-Host "PaperMentor installed to $Dest"
Write-Host "Installed bundled resources: prompts, templates, examples, tests."
Write-Host 'Try: Use $papermentor to explain Equation (1) atomically.'
