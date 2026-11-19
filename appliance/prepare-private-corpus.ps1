[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string]$CorpusPath,
    [int]$QdrantReadyTimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RagDirectory = Join-Path $Root "aast-ai-agent-main\backend\rag_system"
$TemporaryQdrant = "aast-ai-agent-corpus-qdrant"
$QdrantVolume = "aast-ai-agent_qdrant_data"
$ComposeProject = "aast-private-corpus-preparation"
$PreviousCorpusPath = $env:RAG_PRIVATE_CORPUS_PATH
$StartedQdrant = $false
$OperationSucceeded = $false

function Invoke-Docker([string[]]$Arguments, [string]$FailureMessage) {
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
}

function Assert-QdrantVolumeUnused {
    $VolumeUsers = @(& docker ps --filter "volume=$QdrantVolume" --format "{{.Names}}") `
        | Where-Object { $_ -and $_.Trim() }
    if ($LASTEXITCODE -ne 0) {
        throw "Could not verify whether Qdrant volume '$QdrantVolume' is in use."
    }
    if ($VolumeUsers.Count -gt 0) {
        $Names = $VolumeUsers -join ", "
        throw "Qdrant volume '$QdrantVolume' is mounted by running container(s): $Names. Stop those containers before private corpus ingestion."
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI is not installed or not available in PATH."
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker Desktop is not running." }

$ExistingContainer = & docker ps -a --filter "name=^/$TemporaryQdrant$" --format "{{.Names}}"
if ($ExistingContainer) {
    throw "Container '$TemporaryQdrant' already exists. Inspect and remove it before retrying."
}
Assert-QdrantVolumeUnused

try {
    $env:RAG_PRIVATE_CORPUS_PATH = (Resolve-Path -LiteralPath $CorpusPath).Path

    Push-Location $RagDirectory
    try {
        Invoke-Docker @(
            "compose", "--project-name", $ComposeProject,
            "-f", "compose.private-corpus.yml", "run", "--rm", "rag-corpus-preflight"
        ) "Private corpus preflight failed; Qdrant was not modified."
    }
    finally {
        Pop-Location
    }

    # Recheck immediately before mounting the volume. Qdrant storage must
    # never be opened by two servers concurrently.
    Assert-QdrantVolumeUnused
    Invoke-Docker @(
        "run", "--detach", "--rm",
        "--name", $TemporaryQdrant,
        "--publish", "127.0.0.1:6333:6333",
        "--volume", "${QdrantVolume}:/qdrant/storage",
        "qdrant/qdrant:v1.12.5"
    ) "Could not start the isolated Qdrant ingestion container. Ensure port 6333 is free."
    $StartedQdrant = $true

    $Deadline = [DateTime]::UtcNow.AddSeconds($QdrantReadyTimeoutSeconds)
    $QdrantReady = $false
    do {
        try {
            $Response = Invoke-WebRequest -Uri "http://127.0.0.1:6333/" -TimeoutSec 3 -UseBasicParsing
            $QdrantReady = $Response.StatusCode -eq 200
        }
        catch {
            Start-Sleep -Seconds 1
        }
    } while (-not $QdrantReady -and [DateTime]::UtcNow -lt $Deadline)

    if (-not $QdrantReady) {
        throw "Qdrant did not become ready within $QdrantReadyTimeoutSeconds seconds."
    }

    Push-Location $RagDirectory
    try {
        Invoke-Docker @(
            "compose", "--project-name", $ComposeProject,
            "-f", "compose.private-corpus.yml", "run", "--rm", "rag-corpus-ingest"
        ) "Private corpus ingestion failed. Existing collections are never overwritten implicitly."
    }
    finally {
        Pop-Location
    }

    Write-Host "Private RAG corpus validated and ingested into volume '$QdrantVolume'."
    $OperationSucceeded = $true
}
finally {
    $QdrantCleanupFailed = $false
    if ($StartedQdrant) {
        $PreviousErrorAction = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & docker stop --time 30 $TemporaryQdrant *> $null
        $StopExitCode = $LASTEXITCODE
        $RemainingTemporaryContainer = @(
            & docker ps -a --filter "name=^/$TemporaryQdrant$" --format "{{.Names}}"
        ) | Where-Object { $_ -and $_.Trim() }
        $InspectExitCode = $LASTEXITCODE
        $ErrorActionPreference = $PreviousErrorAction
        $QdrantCleanupFailed = $StopExitCode -ne 0 -or $InspectExitCode -ne 0 -or $RemainingTemporaryContainer.Count -gt 0
        if ($QdrantCleanupFailed) {
            Write-Warning "Temporary Qdrant '$TemporaryQdrant' did not stop cleanly; inspect it before using volume '$QdrantVolume'."
        }
    }

    Push-Location $RagDirectory
    try {
        $PreviousErrorAction = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & docker compose --project-name $ComposeProject `
            --profile preflight --profile ingest `
            -f compose.private-corpus.yml down --remove-orphans *> $null
        $CleanupExitCode = $LASTEXITCODE
        $ErrorActionPreference = $PreviousErrorAction
        if ($CleanupExitCode -ne 0) {
            Write-Warning "Could not remove the temporary private-corpus Compose network."
        }
    }
    finally {
        $ErrorActionPreference = "Stop"
        Pop-Location
    }

    if ($null -eq $PreviousCorpusPath) {
        Remove-Item Env:RAG_PRIVATE_CORPUS_PATH -ErrorAction SilentlyContinue
    }
    else {
        $env:RAG_PRIVATE_CORPUS_PATH = $PreviousCorpusPath
    }

    if ($OperationSucceeded -and $QdrantCleanupFailed) {
        throw "Private corpus ingestion completed, but temporary Qdrant cleanup failed."
    }
}
