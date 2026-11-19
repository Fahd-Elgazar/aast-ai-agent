[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvFile = Join-Path $PSScriptRoot ".env.appliance.local"
$ComposeFile = Join-Path $Root "docker-compose.appliance.yml"

if (-not (Test-Path -LiteralPath $EnvFile)) {
    throw "Appliance configuration does not exist: $EnvFile"
}

Push-Location $Root
try {
    & docker compose --env-file $EnvFile -f $ComposeFile down
    if ($LASTEXITCODE -ne 0) { throw "Failed to stop the appliance." }
}
finally {
    Pop-Location
}

