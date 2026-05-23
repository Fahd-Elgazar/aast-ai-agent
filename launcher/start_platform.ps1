param(
    [ValidateSet("demo", "full", "quick")]
    [string]$Mode = "demo",

    [switch]$NoPause,
    [switch]$Strict,
    [switch]$SkipPrewarm,
    [switch]$RunGoldenCheck,
    [switch]$SkipGoldenCheck,
    [switch]$DiagnosticsOnly,
    [switch]$KeepOnFailure
)

$ErrorActionPreference = "Stop"

$script:BaseDir = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$script:RunStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$script:LauncherLogDir = Join-Path $script:BaseDir "logs\launcher"
$script:StatePath = Join-Path $script:LauncherLogDir "launcher-state.json"
$script:Results = @()
$script:CriticalFailure = $false
$script:PreflightFailure = $false

$script:FrontendPath = Join-Path $script:BaseDir "aast-ai-agent-main\frontend"
$script:BackendPath = Join-Path $script:BaseDir "aast-ai-agent-main\backend"
$script:DecisionPath = Join-Path $script:BaseDir "college-decision-system-backend"
$script:RagPath = Join-Path $script:BaseDir "aast-ai-agent-main\backend\rag_system"

New-Item -ItemType Directory -Path $script:LauncherLogDir -Force | Out-Null

$script:State = [ordered]@{
    schema = 2
    launcher = "AAST Phase 2"
    mode = $Mode
    baseDir = $script:BaseDir
    startedAt = (Get-Date).ToString("o")
    diagnosticsOnly = [bool]$DiagnosticsOnly
    services = @()
    containers = @()
    notes = @()
}

function Write-Color {
    param(
        [string]$Text,
        [string]$Color = "White",
        [switch]$NoNewline
    )

    if ($NoNewline) {
        Write-Host $Text -ForegroundColor $Color -NoNewline
    } else {
        Write-Host $Text -ForegroundColor $Color
    }
}

function Write-Banner {
    $modeLabel = $Mode.ToUpperInvariant()
    Write-Host ""
    Write-Color "====================================================" "Cyan"
    Write-Color "        AAST AI AGENT PLATFORM LAUNCHER" "Cyan"
    Write-Color "====================================================" "Cyan"
    Write-Host ("        Mode: {0}" -f $modeLabel)
    Write-Host ("        Root: {0}" -f $script:BaseDir)
    if ($DiagnosticsOnly) {
        Write-Color "        Diagnostics only: no services will be started" "DarkYellow"
    }
    Write-Host ""
}

function Pause-IfNeeded {
    if (-not $NoPause) {
        Write-Host ""
        Read-Host "Press Enter to close launcher" | Out-Null
    }
}

function Add-Result {
    param(
        [string]$Service,
        [string]$Status,
        [string]$Detail,
        [string]$ModeScope = $Mode,
        [string]$LogFile = ""
    )

    $script:Results += [pscustomobject]@{
        Service = $Service
        Status = $Status
        Mode = $ModeScope
        Detail = $Detail
        Log = $LogFile
    }
}

function Save-State {
    $script:State | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $script:StatePath -Encoding UTF8
}

function Add-StateService {
    param(
        [string]$Id,
        [string]$Name,
        [Nullable[int]]$Port = $null,
        [Nullable[int]]$ServicePid = $null,
        [string]$Kind = "process",
        [bool]$StartedByLauncher = $false,
        [string]$LogFile = "",
        [string]$HealthUrl = ""
    )

    $script:State.services += [ordered]@{
        id = $Id
        name = $Name
        port = $Port
        pid = $ServicePid
        kind = $Kind
        startedByLauncher = $StartedByLauncher
        logFile = $LogFile
        healthUrl = $HealthUrl
        recordedAt = (Get-Date).ToString("o")
    }
    Save-State
}

function Add-StateContainer {
    param(
        [string]$Name,
        [bool]$StartedByLauncher
    )

    $script:State.containers += [ordered]@{
        name = $Name
        startedByLauncher = $StartedByLauncher
        recordedAt = (Get-Date).ToString("o")
    }
    Save-State
}

function Set-LauncherEnv {
    param([string]$Name, [string]$Value)
    [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
}

function Get-DotEnvValue {
    param([string]$EnvPath, [string]$Name)

    if (-not (Test-Path -LiteralPath $EnvPath)) { return $null }

    $pattern = "^\s*{0}\s*=" -f [regex]::Escape($Name)
    $line = Get-Content -LiteralPath $EnvPath -ErrorAction SilentlyContinue |
        Where-Object { $_ -match $pattern } |
        Select-Object -Last 1

    if ([string]::IsNullOrWhiteSpace($line)) { return $null }

    $value = ($line -split "=", 2)[1].Trim()
    return $value.Trim('"').Trim("'")
}

function Get-PrimaryModel {
    $backendEnv = Join-Path $script:BackendPath ".env"
    $model = $env:PRIMARY_MODEL
    if ([string]::IsNullOrWhiteSpace($model)) {
        $model = Get-DotEnvValue -EnvPath $backendEnv -Name "PRIMARY_MODEL"
    }
    if ([string]::IsNullOrWhiteSpace($model)) {
        $model = Get-DotEnvValue -EnvPath $backendEnv -Name "OLLAMA_MODEL"
    }
    if ([string]::IsNullOrWhiteSpace($model)) {
        $model = "gemma4:e2b"
    }
    return $model
}

function Test-CommandAvailable {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Require-Path {
    param(
        [string]$Label,
        [string]$Path
    )

    if (Test-Path -LiteralPath $Path) {
        Add-Result -Service $Label -Status "OK" -Detail "Found $Path"
        return $true
    }

    Add-Result -Service $Label -Status "FAIL" -Detail "Missing $Path"
    $script:PreflightFailure = $true
    return $false
}

function Require-Command {
    param(
        [string]$Label,
        [string]$Command,
        [bool]$Required = $true
    )

    if (Test-CommandAvailable $Command) {
        $cmd = Get-Command $Command -ErrorAction SilentlyContinue | Select-Object -First 1
        Add-Result -Service $Label -Status "OK" -Detail ("{0} available" -f $cmd.Source)
        return $true
    }

    $status = if ($Required) { "FAIL" } else { "WARN" }
    Add-Result -Service $Label -Status $status -Detail "$Command is not available on PATH"
    if ($Required) { $script:PreflightFailure = $true }
    return $false
}

function Test-NodeApp {
    param(
        [string]$Label,
        [string]$Path
    )

    $ok = $true
    $packageJson = Join-Path $Path "package.json"
    $nodeModules = Join-Path $Path "node_modules"

    if (-not (Test-Path -LiteralPath $packageJson)) {
        Add-Result -Service $Label -Status "FAIL" -Detail "Missing package.json"
        $script:PreflightFailure = $true
        $ok = $false
    }

    if (-not (Test-Path -LiteralPath $nodeModules)) {
        Add-Result -Service $Label -Status "FAIL" -Detail "Missing node_modules. Run npm install in $Path"
        $script:PreflightFailure = $true
        $ok = $false
    }

    if ($ok) {
        Add-Result -Service $Label -Status "OK" -Detail "Node package is installed"
    }

    return $ok
}

function Test-PythonModules {
    param(
        [string]$Label,
        [string[]]$Modules,
        [bool]$Required = $true
    )

    if (-not (Test-CommandAvailable "python")) {
        $status = if ($Required) { "FAIL" } else { "WARN" }
        Add-Result -Service $Label -Status $status -Detail "Python command not available"
        if ($Required) { $script:PreflightFailure = $true }
        return $false
    }

    $code = "import importlib.util, sys; missing=[m for m in sys.argv[1:] if importlib.util.find_spec(m) is None]; print(','.join(missing)); sys.exit(1 if missing else 0)"
    $output = & python -c $code @Modules 2>&1
    if ($LASTEXITCODE -eq 0) {
        Add-Result -Service $Label -Status "OK" -Detail ("Python modules available: {0}" -f ($Modules -join ", "))
        return $true
    }

    $status = if ($Required) { "FAIL" } else { "WARN" }
    $missing = [string]$output
    if ([string]::IsNullOrWhiteSpace($missing)) { $missing = "unknown module failure" }
    Add-Result -Service $Label -Status $status -Detail "Missing Python module(s): $missing"
    if ($Required) { $script:PreflightFailure = $true }
    return $false
}

function Get-PortOwner {
    param([int]$Port)

    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if (-not $conn) { return $null }

    $processId = [int]$conn.OwningProcess
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue

    return [pscustomobject]@{
        Port = $Port
        Pid = $processId
        Name = $proc.Name
        CommandLine = $proc.CommandLine
    }
}

function Test-TcpPort {
    param([int]$Port)
    return [bool](Get-PortOwner -Port $Port)
}

function Wait-TcpReady {
    param(
        [string]$Name,
        [int]$Port,
        [int]$TimeoutSeconds = 30,
        [int]$IntervalMilliseconds = 1000
    )

    $started = Get-Date
    while (((Get-Date) - $started).TotalSeconds -lt $TimeoutSeconds) {
        if (Test-TcpPort -Port $Port) { return $true }
        Start-Sleep -Milliseconds $IntervalMilliseconds
    }

    return (Test-TcpPort -Port $Port)
}

function Invoke-HttpProbe {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 3,
        [string[]]$AcceptedJsonStatuses = @("ok", "healthy", "ready"),
        [switch]$AcceptAny2xx
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $result = [ordered]@{
        ok = $false
        reachable = $false
        statusCode = $null
        jsonStatus = $null
        latencyMs = $null
        error = $null
    }

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSeconds -Method Get
        $sw.Stop()
        $result.reachable = $true
        $result.statusCode = [int]$response.StatusCode
        $result.latencyMs = [int]$sw.ElapsedMilliseconds

        $json = $null
        try { $json = $response.Content | ConvertFrom-Json } catch { $json = $null }

        if ($null -ne $json) {
            if ($null -ne $json.status) {
                $result.jsonStatus = [string]$json.status
                $result.ok = $AcceptedJsonStatuses -contains ([string]$json.status).ToLowerInvariant()
            } elseif ($null -ne $json.ok) {
                $result.ok = [bool]$json.ok
            } else {
                $result.ok = $AcceptAny2xx -and $result.statusCode -ge 200 -and $result.statusCode -lt 300
            }
        } else {
            $result.ok = $AcceptAny2xx -and $result.statusCode -ge 200 -and $result.statusCode -lt 300
        }
    } catch {
        $sw.Stop()
        $result.latencyMs = [int]$sw.ElapsedMilliseconds
        $result.error = $_.Exception.Message
        if ($_.Exception.Response) {
            try {
                $result.statusCode = [int]$_.Exception.Response.StatusCode
                $result.reachable = $true
            } catch {
                $result.statusCode = $null
            }
        }
    }

    return [pscustomobject]$result
}

function Wait-HttpReady {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSeconds = 45,
        [int]$IntervalSeconds = 2,
        [string[]]$AcceptedJsonStatuses = @("ok", "healthy", "ready"),
        [switch]$AcceptAny2xx
    )

    Write-Host ("  Waiting for {0}: {1}" -f $Name, $Url)
    $started = Get-Date
    $last = $null

    while (((Get-Date) - $started).TotalSeconds -lt $TimeoutSeconds) {
        $last = Invoke-HttpProbe -Url $Url -TimeoutSeconds 3 -AcceptedJsonStatuses $AcceptedJsonStatuses -AcceptAny2xx:$AcceptAny2xx
        if ($last.ok) {
            Write-Color ("  [OK] {0} ready in {1}ms" -f $Name, $last.latencyMs) "Green"
            return $last
        }
        Start-Sleep -Seconds $IntervalSeconds
    }

    if (-not $last) {
        $last = Invoke-HttpProbe -Url $Url -TimeoutSeconds 3 -AcceptedJsonStatuses $AcceptedJsonStatuses -AcceptAny2xx:$AcceptAny2xx
    }
    return $last
}

function Start-ManagedCommand {
    param(
        [string]$Id,
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Command,
        [Nullable[int]]$Port = $null,
        [string]$HealthUrl = "",
        [string]$Kind = "process"
    )

    $logFile = Join-Path $script:LauncherLogDir ("{0}-{1}.log" -f $Id, $script:RunStamp)
    $title = "AAST $Name"
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $cmdLine = "title $title && cd /d `"$WorkingDirectory`" && echo [$timestamp] Starting $Name in $Mode mode > `"$logFile`" && $Command >> `"$logFile`" 2>&1"

    $proc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList @("/d", "/s", "/c", $cmdLine) `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -PassThru

    Add-StateService -Id $Id -Name $Name -Port $Port -ServicePid $proc.Id -Kind $Kind -StartedByLauncher $true -LogFile $logFile -HealthUrl $HealthUrl
    return [pscustomobject]@{
        Pid = $proc.Id
        LogFile = $logFile
    }
}

function Start-HttpService {
    param(
        [string]$Id,
        [string]$Name,
        [int]$Port,
        [string]$HealthUrl,
        [string]$WorkingDirectory,
        [string]$Command,
        [int]$TimeoutSeconds = 45,
        [bool]$Required = $true,
        [string[]]$AcceptedJsonStatuses = @("ok", "healthy", "ready"),
        [switch]$AcceptAny2xx
    )

    Write-Host ""
    Write-Color ("[{0}] {1}" -f $Id, $Name) "Yellow"

    $owner = Get-PortOwner -Port $Port
    if ($owner) {
        $probe = Wait-HttpReady -Name $Name -Url $HealthUrl -TimeoutSeconds 8 -IntervalSeconds 2 -AcceptedJsonStatuses $AcceptedJsonStatuses -AcceptAny2xx:$AcceptAny2xx
        if ($probe.ok) {
            Add-Result -Service $Name -Status "READY" -Detail ("Reused existing listener on port {0} (pid {1})" -f $Port, $owner.Pid)
            Add-StateService -Id $Id -Name $Name -Port $Port -ServicePid $owner.Pid -Kind "process" -StartedByLauncher $false -HealthUrl $HealthUrl
            return $true
        }

        $status = if ($Required -or $Strict) { "FAIL" } else { "WARN" }
        Add-Result -Service $Name -Status $status -Detail ("Port {0} is busy but health did not pass. pid={1}; error={2}" -f $Port, $owner.Pid, $probe.error)
        if ($Required -or $Strict) { $script:CriticalFailure = $true }
        return $false
    }

    if ($DiagnosticsOnly) {
        Add-Result -Service $Name -Status "SKIP" -Detail ("Would start on port {0}: {1}" -f $Port, $Command)
        return $true
    }

    $started = Start-ManagedCommand -Id $Id -Name $Name -WorkingDirectory $WorkingDirectory -Command $Command -Port $Port -HealthUrl $HealthUrl
    $probe = Wait-HttpReady -Name $Name -Url $HealthUrl -TimeoutSeconds $TimeoutSeconds -IntervalSeconds 2 -AcceptedJsonStatuses $AcceptedJsonStatuses -AcceptAny2xx:$AcceptAny2xx

    if ($probe.ok) {
        Add-Result -Service $Name -Status "READY" -Detail ("Started on port {0} (launcher pid {1})" -f $Port, $started.Pid) -LogFile $started.LogFile
        return $true
    }

    $status = if ($Required -or $Strict) { "FAIL" } else { "WARN" }
    $detail = "Timed out waiting for $HealthUrl"
    if ($probe.error) { $detail = "$detail; last error: $($probe.error)" }
    Add-Result -Service $Name -Status $status -Detail $detail -LogFile $started.LogFile
    if ($Required -or $Strict) { $script:CriticalFailure = $true }
    return $false
}

function Start-TcpServiceCheck {
    param(
        [string]$Id,
        [string]$Name,
        [int]$Port,
        [int]$TimeoutSeconds = 10,
        [bool]$Required = $true
    )

    Write-Host ""
    Write-Color ("[{0}] {1}" -f $Id, $Name) "Yellow"

    $ready = Wait-TcpReady -Name $Name -Port $Port -TimeoutSeconds $TimeoutSeconds
    if ($ready) {
        $owner = Get-PortOwner -Port $Port
        Add-Result -Service $Name -Status "READY" -Detail ("Port {0} listening (pid {1})" -f $Port, $owner.Pid)
        Add-StateService -Id $Id -Name $Name -Port $Port -ServicePid $owner.Pid -Kind "external" -StartedByLauncher $false
        return $true
    }

    $status = if ($Required -or $Strict) { "FAIL" } else { "WARN" }
    Add-Result -Service $Name -Status $status -Detail "Port $Port is not listening. Start Neo4j Desktop/database before demo or full mode."
    if ($Required -or $Strict) { $script:CriticalFailure = $true }
    return $false
}

function Start-QdrantIfAvailable {
    Write-Host ""
    Write-Color "[qdrant] Qdrant vector service" "Yellow"

    if (Test-TcpPort -Port 6333) {
        Add-Result -Service "Qdrant" -Status "READY" -Detail "Reused existing listener on port 6333"
        Add-StateService -Id "qdrant" -Name "Qdrant" -Port 6333 -Kind "container" -StartedByLauncher $false -HealthUrl "http://127.0.0.1:6333"
        return $true
    }

    if (-not (Test-CommandAvailable "docker")) {
        Add-Result -Service "Qdrant" -Status "WARN" -Detail "Docker not found. Full RAG starts degraded without Qdrant."
        return $false
    }

    if ($DiagnosticsOnly) {
        Add-Result -Service "Qdrant" -Status "SKIP" -Detail "Would start docker container qdrant_prod if present"
        return $true
    }

    $running = & docker ps --filter "name=qdrant_prod" --format "{{.Names}}" 2>$null
    if ($running -match "^qdrant_prod$") {
        if (Wait-TcpReady -Name "Qdrant" -Port 6333 -TimeoutSeconds 15) {
            Add-Result -Service "Qdrant" -Status "READY" -Detail "Container qdrant_prod already running"
            Add-StateContainer -Name "qdrant_prod" -StartedByLauncher $false
            return $true
        }
    }

    $exists = & docker ps -a --filter "name=qdrant_prod" --format "{{.Names}}" 2>$null
    if ($exists -match "^qdrant_prod$") {
        & docker start qdrant_prod | Out-Null
        if ($LASTEXITCODE -eq 0 -and (Wait-TcpReady -Name "Qdrant" -Port 6333 -TimeoutSeconds 25)) {
            Add-Result -Service "Qdrant" -Status "READY" -Detail "Started container qdrant_prod"
            Add-StateContainer -Name "qdrant_prod" -StartedByLauncher $true
            return $true
        }

        Add-Result -Service "Qdrant" -Status "WARN" -Detail "Docker container qdrant_prod did not become ready"
        return $false
    }

    Add-Result -Service "Qdrant" -Status "WARN" -Detail "qdrant_prod container not found. RAG services will be skipped/degraded."
    return $false
}

function Start-Ollama {
    $ollamaBase = $env:OLLAMA_BASE_URL
    if ([string]::IsNullOrWhiteSpace($ollamaBase)) { $ollamaBase = "http://localhost:11434" }
    $ollamaBase = $ollamaBase.TrimEnd("/")

    Write-Host ""
    Write-Color "[ollama] Ollama runtime" "Yellow"

    if (-not (Test-TcpPort -Port 11434)) {
        if (-not (Test-CommandAvailable "ollama")) {
            Add-Result -Service "Ollama" -Status "FAIL" -Detail "ollama command not found. Install Ollama or add it to PATH."
            $script:CriticalFailure = $true
            return $false
        }

        if ($DiagnosticsOnly) {
            Add-Result -Service "Ollama" -Status "SKIP" -Detail "Would start: ollama serve"
            return $true
        }

        $started = Start-ManagedCommand -Id "ollama" -Name "Ollama" -WorkingDirectory $script:BaseDir -Command "ollama serve" -Port 11434 -HealthUrl "$ollamaBase/api/tags" -Kind "external"
        $probe = Wait-HttpReady -Name "Ollama" -Url "$ollamaBase/api/tags" -TimeoutSeconds 55 -IntervalSeconds 2 -AcceptAny2xx
        if ($probe.ok) {
            Add-Result -Service "Ollama" -Status "READY" -Detail ("Started Ollama (launcher pid {0})" -f $started.Pid) -LogFile $started.LogFile
            return $true
        }

        Add-Result -Service "Ollama" -Status "FAIL" -Detail "Ollama did not answer /api/tags in time" -LogFile $started.LogFile
        $script:CriticalFailure = $true
        return $false
    }

    $owner = Get-PortOwner -Port 11434
    $probeExisting = Wait-HttpReady -Name "Ollama" -Url "$ollamaBase/api/tags" -TimeoutSeconds 15 -IntervalSeconds 2 -AcceptAny2xx
    if ($probeExisting.ok) {
        Add-Result -Service "Ollama" -Status "READY" -Detail ("Reused existing Ollama on port 11434 (pid {0})" -f $owner.Pid)
        Add-StateService -Id "ollama" -Name "Ollama" -Port 11434 -ServicePid $owner.Pid -Kind "external" -StartedByLauncher $false -HealthUrl "$ollamaBase/api/tags"
        return $true
    }

    Add-Result -Service "Ollama" -Status "FAIL" -Detail "Port 11434 is listening but /api/tags is not healthy"
    $script:CriticalFailure = $true
    return $false
}

function Test-OllamaModel {
    param([string]$Model)

    $ollamaBase = $env:OLLAMA_BASE_URL
    if ([string]::IsNullOrWhiteSpace($ollamaBase)) { $ollamaBase = "http://localhost:11434" }
    $ollamaBase = $ollamaBase.TrimEnd("/")

    try {
        $tags = Invoke-RestMethod -Uri "$ollamaBase/api/tags" -TimeoutSec 5
        $models = @($tags.models | ForEach-Object { $_.name })
        if ($models -contains $Model) {
            Add-Result -Service "Ollama model" -Status "OK" -Detail "Primary model is installed: $Model"
            return $true
        }

        Add-Result -Service "Ollama model" -Status "WARN" -Detail "Model $Model was not listed. Suggested fix: ollama pull $Model"
        return $false
    } catch {
        Add-Result -Service "Ollama model" -Status "WARN" -Detail "Could not list Ollama models: $($_.Exception.Message)"
        return $false
    }
}

function Invoke-OllamaPrewarm {
    param([string]$Model)

    if ($SkipPrewarm -or $DiagnosticsOnly) {
        Add-Result -Service "LLM prewarm" -Status "SKIP" -Detail "Prewarm skipped"
        return
    }

    $ollamaBase = $env:OLLAMA_BASE_URL
    if ([string]::IsNullOrWhiteSpace($ollamaBase)) { $ollamaBase = "http://localhost:11434" }
    $ollamaBase = $ollamaBase.TrimEnd("/")

    Write-Host ""
    Write-Color "[prewarm] Loading primary LLM into memory" "Yellow"

    $body = @{
        model = $Model
        prompt = "."
        stream = $false
        keep_alive = $env:OLLAMA_KEEP_ALIVE
        options = @{
            temperature = 0
            top_p = 0.1
            num_predict = 1
            num_ctx = 512
        }
    } | ConvertTo-Json -Depth 5

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        Invoke-RestMethod -Uri "$ollamaBase/api/generate" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 45 | Out-Null
        $sw.Stop()
        Add-Result -Service "LLM prewarm" -Status "READY" -Detail ("Model {0} warmed in {1}ms" -f $Model, [int]$sw.ElapsedMilliseconds)
    } catch {
        $sw.Stop()
        $status = if ($Strict) { "FAIL" } else { "WARN" }
        Add-Result -Service "LLM prewarm" -Status $status -Detail ("Prewarm failed after {0}ms: {1}" -f [int]$sw.ElapsedMilliseconds, $_.Exception.Message)
        if ($Strict) { $script:CriticalFailure = $true }
    }
}

function Invoke-RagRetrieverWarmup {
    if ($SkipPrewarm -or $DiagnosticsOnly) {
        Add-Result -Service "RAG retriever warmup" -Status "SKIP" -Detail "Warmup skipped"
        return
    }

    Write-Host ""
    Write-Color "[prewarm] Loading RAG embedding model" "Yellow"

    $body = @{
        query = $env:RAG_WARMUP_QUERY
        top_k = 1
    } | ConvertTo-Json

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:8001/warmup" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 120
        $sw.Stop()
        Add-Result -Service "RAG retriever warmup" -Status "READY" -Detail ("Embedding warmed in {0}ms; loaded={1}" -f [int]$sw.ElapsedMilliseconds, $response.embedding.loaded)
    } catch {
        $sw.Stop()
        $status = if ($Strict) { "FAIL" } else { "WARN" }
        Add-Result -Service "RAG retriever warmup" -Status $status -Detail ("Warmup failed after {0}ms: {1}" -f [int]$sw.ElapsedMilliseconds, $_.Exception.Message)
        if ($Strict) { $script:CriticalFailure = $true }
    }
}

function Invoke-GoldenCheck {
    if ($DiagnosticsOnly) {
        Add-Result -Service "Golden query" -Status "SKIP" -Detail "Diagnostics mode"
        return
    }

    Write-Host ""
    Write-Color "[golden] Demo golden KG query" "Yellow"

    $query = "Who is the dean of the computing faculty?"
    $benchmarkPath = Join-Path $script:BackendPath "testing\benchmarkQueries.json"
    if (Test-Path -LiteralPath $benchmarkPath) {
        try {
            $queries = Get-Content -LiteralPath $benchmarkPath -Raw | ConvertFrom-Json
            $kg = @($queries | Where-Object { $_.query_id -eq "Q_KG_01" } | Select-Object -First 1)
            if ($kg.Count -gt 0 -and $kg[0].query) { $query = [string]$kg[0].query }
        } catch {
            $query = "Who is the dean of the computing faculty?"
        }
    }

    $body = @{
        query = $query
        cid = "launcher-demo-golden"
    } | ConvertTo-Json

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:8004/api/chatbot/query" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 20
        $sw.Stop()
        $route = [string]($response.route)
        if ([string]::IsNullOrWhiteSpace($route)) { $route = [string]($response.source) }
        if ([string]::IsNullOrWhiteSpace($route)) { $route = "unknown" }

        $latency = [int]$sw.ElapsedMilliseconds
        if ($route -match "KG" -and $latency -le 3000) {
            Add-Result -Service "Golden query" -Status "PASS" -Detail ("{0}ms route={1}" -f $latency, $route)
        } elseif ($route -match "KG") {
            Add-Result -Service "Golden query" -Status "WARN" -Detail ("KG route OK but above 3000ms target: {0}ms" -f $latency)
        } else {
            Add-Result -Service "Golden query" -Status "WARN" -Detail ("Unexpected route={0}, latency={1}ms" -f $route, $latency)
        }
    } catch {
        $sw.Stop()
        $status = if ($Strict) { "FAIL" } else { "WARN" }
        Add-Result -Service "Golden query" -Status $status -Detail ("Golden query failed after {0}ms: {1}" -f [int]$sw.ElapsedMilliseconds, $_.Exception.Message)
        if ($Strict) { $script:CriticalFailure = $true }
    }
}

function Apply-ModeEnvironment {
    $primaryModel = Get-PrimaryModel

    Set-LauncherEnv "AAST_LAUNCHER_MODE" $Mode
    Set-LauncherEnv "DECISION_API_URL" "http://127.0.0.1:8005"
    Set-LauncherEnv "OLLAMA_BASE_URL" "http://localhost:11434"
    Set-LauncherEnv "PRIMARY_MODEL" $primaryModel
    Set-LauncherEnv "RAG_BASE_URL" "http://127.0.0.1:8001"
    Set-LauncherEnv "RAG_RETRIEVER_URL" "http://127.0.0.1:8001"
    Set-LauncherEnv "RAG_ANSWER_URL" "http://127.0.0.1:8002"
    Set-LauncherEnv "TOKENIZERS_PARALLELISM" "false"
    Set-LauncherEnv "OMP_NUM_THREADS" "1"
    Set-LauncherEnv "MKL_NUM_THREADS" "1"

    switch ($Mode) {
        "quick" {
            Set-LauncherEnv "OLLAMA_STARTUP_WAIT_ENABLED" "false"
            Set-LauncherEnv "STARTUP_PRELOAD_ENABLED" "false"
            Set-LauncherEnv "PERIODIC_HEALTH_ENABLED" "false"
            Set-LauncherEnv "GEMMA_WARM_POOL_ENABLED" "false"
            Set-LauncherEnv "DECISION_API_TIMEOUT_MS" "1200"
            Set-LauncherEnv "RAG_HEALTH_TIMEOUT_MS" "800"
            Set-LauncherEnv "NODE_OPTIONS" "--max-old-space-size=3072"
        }
        "demo" {
            Set-LauncherEnv "VOICE_ENABLED" "false"
            Set-LauncherEnv "OLLAMA_KEEP_ALIVE" "15m"
            Set-LauncherEnv "OLLAMA_STARTUP_WAIT_ENABLED" "true"
            Set-LauncherEnv "OLLAMA_STARTUP_WAIT_TIMEOUT_MS" "45000"
            Set-LauncherEnv "OLLAMA_STARTUP_WAIT_INTERVAL_MS" "1500"
            Set-LauncherEnv "STARTUP_PRELOAD_ENABLED" "true"
            Set-LauncherEnv "PERIODIC_HEALTH_ENABLED" "true"
            Set-LauncherEnv "PRIMARY_RETRY_LIMIT" "1"
            Set-LauncherEnv "BACKUP_RETRY_LIMIT" "0"
            Set-LauncherEnv "OLLAMA_TIMEOUT_MS" "20000"
            Set-LauncherEnv "PRIMARY_TIMEOUT_MS" "20000"
            Set-LauncherEnv "BACKUP_TIMEOUT_MS" "7000"
            Set-LauncherEnv "PRIMARY_COLD_START_TIMEOUT_MS" "22000"
            Set-LauncherEnv "MODEL_PRELOAD_TIMEOUT_MS" "10000"
            Set-LauncherEnv "LLM_REQUEST_DEADLINE_MS" "20000"
            Set-LauncherEnv "SYNTHESIS_TIMEOUT_MS" "20000"
            Set-LauncherEnv "SYNTHESIS_DEADLINE_MS" "20000"
            Set-LauncherEnv "INTENT_TIMEOUT_MS" "20000"
            Set-LauncherEnv "INTENT_DEADLINE_MS" "20000"
            Set-LauncherEnv "INTENT_RETRY_LIMIT" "0"
            Set-LauncherEnv "FALLBACK_LLM_TIMEOUT_MS" "20000"
            Set-LauncherEnv "FALLBACK_LLM_DEADLINE_MS" "20000"
            Set-LauncherEnv "RAG_HEALTH_TIMEOUT_MS" "800"
            Set-LauncherEnv "RAG_TIMEOUT_MS" "20000"
            Set-LauncherEnv "RAG_ROUTE_TIMEOUT_MS" "20000"
            Set-LauncherEnv "HYBRID_ROUTE_TIMEOUT_MS" "20000"
            Set-LauncherEnv "RAG_MAX_RETRIES" "0"
            Set-LauncherEnv "GEMMA_QUEUE_TIMEOUT_MS" "10000"
            Set-LauncherEnv "GEMMA_QUEUE_MAX_DEPTH" "8"
            Set-LauncherEnv "GEMMA_WARM_POOL_ENABLED" "true"
            Set-LauncherEnv "GEMMA_WARM_POOL_INITIAL_DELAY_MS" "5000"
            Set-LauncherEnv "GEMMA_WARM_POOL_INTERVAL_MS" "300000"
            Set-LauncherEnv "GEMMA_WARM_POOL_TIMEOUT_MS" "7000"
            Set-LauncherEnv "MAX_CONCURRENT_LLM" "2"
            Set-LauncherEnv "MAX_CONCURRENT_NEO4J" "6"
            Set-LauncherEnv "MAX_CONCURRENT_RAG" "2"
            Set-LauncherEnv "NODE_OPTIONS" "--max-old-space-size=3072"
        }
        "full" {
            Set-LauncherEnv "VOICE_ENABLED" "true"
            Set-LauncherEnv "OLLAMA_KEEP_ALIVE" "10m"
            Set-LauncherEnv "OLLAMA_STARTUP_WAIT_ENABLED" "true"
            Set-LauncherEnv "STARTUP_PRELOAD_ENABLED" "true"
            Set-LauncherEnv "PERIODIC_HEALTH_ENABLED" "true"
            Set-LauncherEnv "RAG_EMBEDDING_INIT_MODE" "eager"
            Set-LauncherEnv "RAG_HEALTH_REQUIRES_EMBEDDING" "true"
            Set-LauncherEnv "RAG_WARMUP_QUERY" "admission requirements academic policies"
            Set-LauncherEnv "RAG_TORCH_NUM_THREADS" "1"
            Set-LauncherEnv "RAG_EMBED_BATCH_SIZE" "4"
            Set-LauncherEnv "OLLAMA_TIMEOUT_MS" "20000"
            Set-LauncherEnv "PRIMARY_TIMEOUT_MS" "20000"
            Set-LauncherEnv "LLM_REQUEST_DEADLINE_MS" "20000"
            Set-LauncherEnv "SYNTHESIS_TIMEOUT_MS" "20000"
            Set-LauncherEnv "SYNTHESIS_DEADLINE_MS" "20000"
            Set-LauncherEnv "INTENT_TIMEOUT_MS" "20000"
            Set-LauncherEnv "INTENT_DEADLINE_MS" "20000"
            Set-LauncherEnv "FALLBACK_LLM_TIMEOUT_MS" "20000"
            Set-LauncherEnv "FALLBACK_LLM_DEADLINE_MS" "20000"
            Set-LauncherEnv "RAG_TIMEOUT_MS" "20000"
            Set-LauncherEnv "RAG_COLD_START_TIMEOUT_MS" "30000"
            Set-LauncherEnv "RAG_HEALTH_TIMEOUT_MS" "5000"
            Set-LauncherEnv "RAG_ROUTE_TIMEOUT_MS" "20000"
            Set-LauncherEnv "HYBRID_ROUTE_TIMEOUT_MS" "20000"
            Set-LauncherEnv "RAG_ANSWER_MODEL" $primaryModel
            Set-LauncherEnv "RAG_RETRIEVER_TIMEOUT_SECONDS" "45"
            Set-LauncherEnv "RAG_ANSWER_HEALTH_TIMEOUT_SECONDS" "8"
            Set-LauncherEnv "RAG_MAX_RETRIES" "1"
            Set-LauncherEnv "RAG_CB_FAILURE_THRESHOLD" "5"
            Set-LauncherEnv "RAG_CB_COOLDOWN_MS" "15000"
            Set-LauncherEnv "NODE_OPTIONS" "--max-old-space-size=4096"
        }
    }

    return $primaryModel
}

function Invoke-Preflight {
    Write-Color "[preflight] Validating paths, commands, and local dependencies" "Yellow"

    Require-Path -Label "Backend path" -Path $script:BackendPath | Out-Null
    Require-Path -Label "Frontend path" -Path $script:FrontendPath | Out-Null

    if ($Mode -ne "quick") {
        Require-Path -Label "Decision API path" -Path $script:DecisionPath | Out-Null
    }

    if ($Mode -eq "full") {
        Require-Path -Label "RAG path" -Path $script:RagPath | Out-Null
    }

    Require-Command -Label "Node.js" -Command "node" -Required $true | Out-Null
    Require-Command -Label "npm" -Command "npm" -Required $true | Out-Null
    Test-NodeApp -Label "Backend package" -Path $script:BackendPath | Out-Null
    Test-NodeApp -Label "Frontend package" -Path $script:FrontendPath | Out-Null

    if ($Mode -ne "quick") {
        Require-Command -Label "Python" -Command "python" -Required $true | Out-Null
        Test-PythonModules -Label "Decision API modules" -Modules @("fastapi", "uvicorn", "pydantic_settings") -Required $true | Out-Null
        Require-Command -Label "Ollama CLI" -Command "ollama" -Required $false | Out-Null

        $backendSecret = $env:INTERNAL_SECRET_KEY
        if ([string]::IsNullOrWhiteSpace($backendSecret)) {
            $backendSecret = Get-DotEnvValue -EnvPath (Join-Path $script:BackendPath ".env") -Name "INTERNAL_SECRET_KEY"
        }
        if ([string]::IsNullOrWhiteSpace($backendSecret)) {
            Add-Result -Service "Backend env" -Status "FAIL" -Detail "INTERNAL_SECRET_KEY missing in process env or backend .env"
            $script:PreflightFailure = $true
        } else {
            Add-Result -Service "Backend env" -Status "OK" -Detail "Internal secret is configured"
        }
    }

    if ($Mode -eq "quick") {
        $backendSecretQuick = $env:INTERNAL_SECRET_KEY
        if ([string]::IsNullOrWhiteSpace($backendSecretQuick)) {
            $backendSecretQuick = Get-DotEnvValue -EnvPath (Join-Path $script:BackendPath ".env") -Name "INTERNAL_SECRET_KEY"
        }
        if ([string]::IsNullOrWhiteSpace($backendSecretQuick)) {
            Add-Result -Service "Backend env" -Status "FAIL" -Detail "INTERNAL_SECRET_KEY missing in process env or backend .env"
            $script:PreflightFailure = $true
        } else {
            Add-Result -Service "Backend env" -Status "OK" -Detail "Internal secret is configured"
        }
    }

    if ($Mode -eq "full") {
        Test-PythonModules -Label "RAG modules" -Modules @("fastapi", "uvicorn", "qdrant_client", "sentence_transformers") -Required:$Strict | Out-Null
        Require-Command -Label "Docker" -Command "docker" -Required:$Strict | Out-Null
    }
}

function Show-Summary {
    Write-Host ""
    Write-Color "====================================================" "Cyan"
    Write-Color "                 LAUNCH SUMMARY" "Cyan"
    Write-Color "====================================================" "Cyan"

    if ($script:Results.Count -gt 0) {
        $script:Results |
            Select-Object Service, Status, Detail |
            Format-Table -AutoSize |
            Out-String |
            Write-Host
    }

    $failed = @($script:Results | Where-Object { $_.Status -eq "FAIL" })
    if ($failed.Count -gt 0) {
        Write-Color "Suggested fixes:" "Yellow"
        foreach ($item in $failed) {
            switch -Wildcard ($item.Service) {
                "*Neo4j*" { Write-Host "  - Start Neo4j Desktop/database and confirm Bolt is listening on 127.0.0.1:7687." }
                "*Ollama*" { Write-Host "  - Start Ollama, then run: ollama list. Pull the configured primary model if missing." }
                "*Decision*" { Write-Host "  - From college-decision-system-backend, verify: python -m uvicorn app.main:app --host 127.0.0.1 --port 8005." }
                "*Backend*" { Write-Host "  - From aast-ai-agent-main\backend, verify npm install and npm run start:orchestrator." }
                "*Frontend*" { Write-Host "  - From aast-ai-agent-main\frontend, verify npm install and npm run dev:lowmem." }
                "*RAG*" { Write-Host "  - Start Docker Desktop and qdrant_prod, or use demo mode to skip heavy RAG services." }
                default { Write-Host ("  - Review: {0} -> {1}" -f $item.Service, $item.Detail) }
            }
        }
    }

    Write-Host ""
    Write-Host "Service URLs:"
    Write-Host "  Frontend:     http://127.0.0.1:5173"
    Write-Host "  Backend:      http://127.0.0.1:8004/health"
    Write-Host "  Decision API: http://127.0.0.1:8005/health"
    if ($Mode -eq "full") {
        Write-Host "  RAG Retriever: http://127.0.0.1:8001/health"
        Write-Host "  RAG Answer:    http://127.0.0.1:8002/health"
        Write-Host "  Qdrant:        http://127.0.0.1:6333"
    }
    Write-Host "  Ollama:       http://localhost:11434/api/tags"
    Write-Host ""
    Write-Host ("State file: {0}" -f $script:StatePath)
    Write-Host ("Logs:       {0}" -f $script:LauncherLogDir)
}

function Stop-LaunchedOnFailure {
    if ($KeepOnFailure -or $DiagnosticsOnly) { return }

    $launched = @($script:State.services | Where-Object { $_.startedByLauncher -eq $true -and $_.pid })
    if ($launched.Count -eq 0) { return }

    Write-Host ""
    Write-Color "A required service failed. Cleaning up services launched during this attempt." "DarkYellow"
    foreach ($svc in $launched) {
        cmd.exe /c "taskkill /T /F /PID $($svc.pid) >nul 2>&1"
    }
}

Write-Banner
$primaryModel = Apply-ModeEnvironment
Invoke-Preflight

if ($script:PreflightFailure) {
    $script:CriticalFailure = $true
    Show-Summary
    Pause-IfNeeded
    exit 2
}

if ($Mode -ne "quick") {
    Start-TcpServiceCheck -Id "neo4j" -Name "Neo4j Bolt" -Port 7687 -TimeoutSeconds 8 -Required $true | Out-Null
}

if ($Mode -eq "full") {
    $qdrantReady = Start-QdrantIfAvailable
}

if ($Mode -ne "quick") {
    $ollamaReady = Start-Ollama
    if ($ollamaReady) {
        Test-OllamaModel -Model $primaryModel | Out-Null
        Invoke-OllamaPrewarm -Model $primaryModel
    }
}

if ($Mode -eq "full") {
    if ($qdrantReady -or $Strict) {
        $ragRetrieverReady = Start-HttpService `
            -Id "rag-retriever" `
            -Name "RAG Retriever" `
            -Port 8001 `
            -HealthUrl "http://127.0.0.1:8001/health" `
            -WorkingDirectory $script:RagPath `
            -Command "python -m uvicorn phase3_retriever:app --host 127.0.0.1 --port 8001" `
            -TimeoutSeconds 180 `
            -Required:$Strict `
            -AcceptedJsonStatuses @("healthy")

        if ($ragRetrieverReady) {
            Invoke-RagRetrieverWarmup
        }

        Start-HttpService `
            -Id "rag-answer" `
            -Name "RAG Answer Engine" `
            -Port 8002 `
            -HealthUrl "http://127.0.0.1:8002/health" `
            -WorkingDirectory $script:RagPath `
            -Command "python -m uvicorn phase4_llm_answer_engine:app --host 127.0.0.1 --port 8002" `
            -TimeoutSeconds 90 `
            -Required:$Strict `
            -AcceptedJsonStatuses @("healthy") | Out-Null
    } else {
        Add-Result -Service "RAG services" -Status "WARN" -Detail "Skipped because Qdrant is not ready"
    }
}

if ($Mode -ne "quick") {
    Start-HttpService `
        -Id "decision-api" `
        -Name "Decision API" `
        -Port 8005 `
        -HealthUrl "http://127.0.0.1:8005/health" `
        -WorkingDirectory $script:DecisionPath `
        -Command "python -m uvicorn app.main:app --host 127.0.0.1 --port 8005" `
        -TimeoutSeconds 50 `
        -Required $true `
        -AcceptedJsonStatuses @("ok") | Out-Null
}

$backendHealthUrl = if ($Mode -eq "quick") { "http://127.0.0.1:8004/health/metrics" } else { "http://127.0.0.1:8004/health" }
Start-HttpService `
    -Id "backend" `
    -Name "Orchestrator Backend" `
    -Port 8004 `
    -HealthUrl $backendHealthUrl `
    -WorkingDirectory $script:BackendPath `
    -Command "npm run start:orchestrator" `
    -TimeoutSeconds 85 `
    -Required $true `
    -AcceptAny2xx | Out-Null

Start-HttpService `
    -Id "frontend" `
    -Name "Frontend" `
    -Port 5173 `
    -HealthUrl "http://127.0.0.1:5173" `
    -WorkingDirectory $script:FrontendPath `
    -Command "npm run dev:lowmem" `
    -TimeoutSeconds 55 `
    -Required $true `
    -AcceptAny2xx | Out-Null

if (($Mode -eq "demo" -and -not $SkipGoldenCheck) -or $RunGoldenCheck) {
    Invoke-GoldenCheck
}

Show-Summary

if ($script:CriticalFailure) {
    Stop-LaunchedOnFailure
    Write-Color "Launcher completed with required failures." "Red"
    Pause-IfNeeded
    exit 1
}

if ($DiagnosticsOnly) {
    Write-Color "Diagnostics completed." "Green"
} else {
    Write-Color "Startup sequence complete." "Green"
}

Pause-IfNeeded
exit 0
