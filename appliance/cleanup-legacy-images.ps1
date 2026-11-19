[CmdletBinding()]
param([switch]$Execute)

$ErrorActionPreference = "Stop"
$keep = "aast-ai-agent/appliance:local"
$patterns = @(
    "^aast-ai-agent/(backend|frontend|decision-api|rag-retriever|rag-answer):",
    "^aast-ai-agent-recovery/"
)

$candidates = @()
foreach ($image in (& docker images --format "{{.Repository}}:{{.Tag}}")) {
    if ($image -eq $keep) { continue }
    foreach ($pattern in $patterns) {
        if ($image -match $pattern) {
            $candidates += $image
            break
        }
    }
}

if (-not $candidates) {
    Write-Host "No legacy AAST project images are eligible for cleanup."
    exit 0
}

Write-Host "Legacy AAST image tags:"
$candidates | ForEach-Object { Write-Host "  $_" }

if (-not $Execute) {
    Write-Host "Preview only. Re-run with -Execute after the appliance is healthy."
    exit 0
}

foreach ($image in $candidates) {
    & docker image rm $image
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Docker retained $image because another container or tag still references it."
    }
}
