[CmdletBinding()]
param(
    [switch]$BuildOnly,
    [switch]$SkipBuild,
    [int]$HealthTimeoutSeconds = 900
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvFile = Join-Path $PSScriptRoot ".env.appliance.local"
$CredentialsFile = Join-Path $PSScriptRoot "demo-credentials.local"
$ComposeFile = Join-Path $Root "docker-compose.appliance.yml"
$LegacyComposeFile = Join-Path $Root "docker-compose.yml"

function New-RandomText([int]$Bytes = 36) {
    $buffer = New-Object byte[] $Bytes
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($buffer)
    }
    finally {
        $generator.Dispose()
    }
    return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Get-ContainerEnvironmentValue([string]$Container, [string]$Key) {
    $exists = & docker ps -a --filter "name=^/$Container$" --format "{{.Names}}" 2>$null
    if (-not $exists) { return $null }
    $lines = & docker inspect $Container --format "{{range .Config.Env}}{{println .}}{{end}}" 2>$null
    $match = $lines | Where-Object { $_ -like "$Key=*" } | Select-Object -First 1
    if (-not $match) { return $null }
    return ($match -split '=', 2)[1]
}

function New-AuthUserJson(
    [string]$StudentId,
    [string]$Password,
    [string]$Role,
    [string]$Name,
    [string]$Major
) {
    $previous = $env:AUTH_PASSWORD
    try {
        $env:AUTH_PASSWORD = $Password
        $output = & node "scripts/generateAuthUser.js" `
            --student-id $StudentId `
            --role $Role `
            --name $Name `
            --major $Major
        if ($LASTEXITCODE -ne 0) { throw "Failed to generate $Role demo account" }
        return ($output | ConvertFrom-Json)[0]
    }
    finally {
        $env:AUTH_PASSWORD = $previous
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI is not installed or not available in PATH."
}

if ($BuildOnly -and $SkipBuild) {
    throw "BuildOnly and SkipBuild cannot be used together."
}
& docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker Desktop is not running." }

if (-not (Test-Path -LiteralPath $EnvFile)) {
    $internalSecret = Get-ContainerEnvironmentValue "aast-ai-agent-backend-1" "INTERNAL_SECRET_KEY"
    if (-not $internalSecret) { $internalSecret = New-RandomText 48 }

    $neo4jUser = "neo4j"
    $neo4jPassword = $null
    $legacyNeo4jAuth = Get-ContainerEnvironmentValue "aast-ai-agent-neo4j-1" "NEO4J_AUTH"
    if ($legacyNeo4jAuth -and $legacyNeo4jAuth.Contains('/')) {
        $neo4jUser, $neo4jPassword = $legacyNeo4jAuth.Split('/', 2)
    }
    if (-not $neo4jPassword) { $neo4jPassword = New-RandomText 24 }

    $jwtSecret = New-RandomText 48
    $adminPassword = New-RandomText 18
    $studentPassword = New-RandomText 18

    Push-Location (Join-Path $Root "aast-ai-agent-main/backend")
    try {
        $admin = New-AuthUserJson "ADMIN-DEMO" $adminPassword "admin" "Demo Administrator" "Administration"
        $student = New-AuthUserJson "STUDENT-DEMO" $studentPassword "student" "Demo Student" "Artificial Intelligence"
    }
    finally {
        Pop-Location
    }

    $usersJson = @($admin, $student) | ConvertTo-Json -Compress -Depth 8
    $envLines = @(
        "INTERNAL_SECRET_KEY=$internalSecret",
        "AUTH_JWT_SECRET=$jwtSecret",
        "AUTH_USERS_JSON='$usersJson'",
        "AUTH_GUEST_ENABLED=true",
        "NEO4J_USER=$neo4jUser",
        "NEO4J_PASSWORD=$neo4jPassword",
        "NEO4J_DATABASE=neo4j",
        "OLLAMA_BASE_URL=http://host.docker.internal:11434",
        "PRIMARY_MODEL=gemma4:e2b",
        "KG_EMBED_MODEL=nomic-embed-text"
    )
    [IO.File]::WriteAllLines($EnvFile, $envLines, [Text.UTF8Encoding]::new($false))

    $credentialLines = @(
        "AAST AI Agent single-container demo credentials",
        "Generated: $([DateTime]::UtcNow.ToString('u')) UTC",
        "",
        "Administrator ID: ADMIN-DEMO",
        "Administrator password: $adminPassword",
        "",
        "Student ID: STUDENT-DEMO",
        "Student password: $studentPassword",
        "",
        "Keep this file private. It is ignored by Git."
    )
    [IO.File]::WriteAllLines($CredentialsFile, $credentialLines, [Text.UTF8Encoding]::new($false))
    Write-Host "Created private appliance configuration and demo credentials."
}

Push-Location $Root
try {
    & docker compose --env-file $EnvFile -f $ComposeFile config --quiet
    if ($LASTEXITCODE -ne 0) { throw "Appliance Compose validation failed." }

    if (-not $BuildOnly) {
        & docker compose --env-file $EnvFile -f $LegacyComposeFile down --remove-orphans
        if ($LASTEXITCODE -ne 0) { throw "Could not stop the legacy project containers safely." }
    }

    if (-not $SkipBuild) {
        $previousBuildkit = $env:DOCKER_BUILDKIT
        try {
            # Docker Desktop's BuildKit worker is unstable on disk-constrained demo
            # laptops because it builds the large Python and frontend stages in
            # parallel. The serial builder is slower but materially more reliable.
            $env:DOCKER_BUILDKIT = "0"
            & docker build `
                --build-arg "VITE_API_BASE=/api" `
                --file "appliance/Dockerfile" `
                --tag "aast-ai-agent/appliance:local" `
                "."
            if ($LASTEXITCODE -ne 0) { throw "Appliance image build failed." }
        }
        finally {
            $env:DOCKER_BUILDKIT = $previousBuildkit
        }
    }

    if ($BuildOnly) {
        Write-Host "Appliance image built successfully."
        exit 0
    }

    & docker compose --env-file $EnvFile -f $ComposeFile up -d --remove-orphans
    if ($LASTEXITCODE -ne 0) { throw "Appliance container failed to start." }

    $deadline = [DateTime]::UtcNow.AddSeconds($HealthTimeoutSeconds)
    do {
        $status = & docker inspect aast-ai-agent-appliance --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" 2>$null
        if ($status -eq "healthy") { break }
        $running = & docker inspect aast-ai-agent-appliance --format "{{.State.Running}}" 2>$null
        if ($running -ne "true") {
            & docker logs --tail 200 aast-ai-agent-appliance
            throw "Appliance container stopped before becoming healthy."
        }
        Start-Sleep -Seconds 5
    } while ([DateTime]::UtcNow -lt $deadline)

    if ($status -ne "healthy") {
        & docker logs --tail 200 aast-ai-agent-appliance
        throw "Appliance did not become healthy within $HealthTimeoutSeconds seconds."
    }

    Write-Host "AAST AI Agent appliance is healthy at http://127.0.0.1:5173"
    if (Test-Path -LiteralPath $CredentialsFile) {
        Write-Host "Private demo credentials: $CredentialsFile"
    }
}
finally {
    Pop-Location
}
