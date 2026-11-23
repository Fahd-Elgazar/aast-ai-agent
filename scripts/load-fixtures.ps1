param(
    [string]$DataDir,
    [switch]$Reingest
)
$ErrorActionPreference = 'Stop'
$arguments = @()
if ($DataDir) { $arguments += @('--data-dir', $DataDir) }
if ($Reingest) { $arguments += '--reingest' }
& node (Join-Path $PSScriptRoot 'conference-stack.mjs') @arguments
exit $LASTEXITCODE
