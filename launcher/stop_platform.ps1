param(
    [switch]$StatusOnly,
    [switch]$IncludeExternal,
    [switch]$Force,
    [switch]$NoPause
)

$ErrorActionPreference = "Continue"

$script:BaseDir = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$script:LauncherLogDir = Join-Path $script:BaseDir "logs\launcher"
$script:StatePath = Join-Path $script:LauncherLogDir "launcher-state.json"
$script:Results = @()

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

function Pause-IfNeeded {
    if (-not $NoPause) {
        Write-Host ""
        Read-Host "Press Enter to close shutdown console" | Out-Null
    }
}

function Add-Result {
    param(
        [string]$Target,
        [string]$Status,
        [string]$Detail
    )

    $script:Results += [pscustomobject]@{
        Target = $Target
        Status = $Status
        Detail = $Detail
    }
}

function Read-LauncherState {
    if (-not (Test-Path -LiteralPath $script:StatePath)) { return $null }

    try {
        return Get-Content -LiteralPath $script:StatePath -Raw | ConvertFrom-Json
    } catch {
        Add-Result -Target "State" -Status "WARN" -Detail "Could not parse launcher-state.json: $($_.Exception.Message)"
        return $null
    }
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

function Test-PidAlive {
    param([Nullable[int]]$ProcessId)
    if (-not $ProcessId) { return $false }
    return [bool](Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Invoke-HttpStatus {
    param([string]$Url)

    if ([string]::IsNullOrWhiteSpace($Url)) { return "n/a" }

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 -Method Get
        return "HTTP $($response.StatusCode)"
    } catch {
        if ($_.Exception.Response) {
            try { return "HTTP $([int]$_.Exception.Response.StatusCode)" } catch { return "unhealthy" }
        }
        return "offline"
    }
}

function Stop-ProcessTree {
    param(
        [int]$ProcessId,
        [string]$Name,
        [bool]$ForceKill = $false
    )

    if (-not (Test-PidAlive -ProcessId $ProcessId)) {
        Add-Result -Target $Name -Status "OK" -Detail "pid $ProcessId already stopped"
        return
    }

    cmd.exe /c "taskkill /T /PID $ProcessId >nul 2>&1"
    Start-Sleep -Seconds 2

    if ((Test-PidAlive -ProcessId $ProcessId) -or $ForceKill) {
        cmd.exe /c "taskkill /F /T /PID $ProcessId >nul 2>&1"
        Start-Sleep -Milliseconds 700
    }

    if (Test-PidAlive -ProcessId $ProcessId) {
        Add-Result -Target $Name -Status "WARN" -Detail "pid $ProcessId is still alive"
    } else {
        Add-Result -Target $Name -Status "STOPPED" -Detail "stopped pid tree $ProcessId"
    }
}

function Stop-StateProcesses {
    param($State)

    if (-not $State -or -not $State.services) {
        Add-Result -Target "State processes" -Status "SKIP" -Detail "No launcher state services recorded"
        return
    }

    foreach ($service in @($State.services)) {
        $started = [bool]$service.startedByLauncher
        $servicePid = $service.pid
        $kind = [string]$service.kind
        $name = [string]$service.name

        if (-not $started -or -not $servicePid) {
            Add-Result -Target $name -Status "PRESERVED" -Detail "not launched by this launcher"
            continue
        }

        if ($kind -eq "external" -and -not $IncludeExternal) {
            Add-Result -Target $name -Status "PRESERVED" -Detail "external service; use --include-external to stop"
            continue
        }

        Stop-ProcessTree -ProcessId ([int]$servicePid) -Name $name -ForceKill:([bool]$Force)
    }
}

function Stop-StateContainers {
    param($State)

    if (-not $State -or -not $State.containers) {
        Add-Result -Target "Containers" -Status "SKIP" -Detail "No launcher-started containers recorded"
        return
    }

    foreach ($container in @($State.containers)) {
        $name = [string]$container.name
        if ([string]::IsNullOrWhiteSpace($name)) { continue }

        if (-not [bool]$container.startedByLauncher) {
            Add-Result -Target $name -Status "PRESERVED" -Detail "container was already running"
            continue
        }

        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
            Add-Result -Target $name -Status "WARN" -Detail "Docker command not available"
            continue
        }

        docker stop $name 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Add-Result -Target $name -Status "STOPPED" -Detail "Docker container stopped"
        } else {
            Add-Result -Target $name -Status "OK" -Detail "container was not running or Docker was unavailable"
        }
    }
}

function Stop-FallbackProjectProcesses {
    $escapedBase = [regex]::Escape($script:BaseDir)
    $patterns = @(
        "$escapedBase.*aast-ai-agent-main.*backend.*orchestrator",
        "$escapedBase.*aast-ai-agent-main.*frontend.*vite",
        "$escapedBase.*college-decision-system-backend.*uvicorn",
        "$escapedBase.*rag_system.*uvicorn",
        "$escapedBase.*phase3_retriever:app",
        "$escapedBase.*phase4_llm_answer_engine:app",
        "$escapedBase.*app\.main:app",
        "$escapedBase.*npm.*start:orchestrator",
        "$escapedBase.*npm.*dev:lowmem"
    )

    $names = @("cmd.exe", "node.exe", "npm.exe", "python.exe", "python3.exe", "py.exe", "uvicorn.exe")
    $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $names -contains $_.Name }

    $stopped = 0
    foreach ($process in $processes) {
        $commandLine = [string]$process.CommandLine
        if ([string]::IsNullOrWhiteSpace($commandLine)) { continue }

        $matched = $false
        foreach ($pattern in $patterns) {
            if ($commandLine -match $pattern) {
                $matched = $true
                break
            }
        }

        if (-not $matched) { continue }

        Stop-ProcessTree -ProcessId ([int]$process.ProcessId) -Name ("fallback:{0}" -f $process.Name) -ForceKill:([bool]$Force)
        $stopped += 1
    }

    if ($stopped -eq 0) {
        Add-Result -Target "Fallback scan" -Status "OK" -Detail "No unmanaged project service processes found"
    }
}

function Close-LegacyWindows {
    $windows = @(
        "RAG Retriever [Port 8001]",
        "Decision API [Port 8005]",
        "Decision System [Port 8005]",
        "Orchestrator Backend [Port 8004]",
        "Frontend [Port 5173]"
    )

    foreach ($window in $windows) {
        cmd.exe /c "taskkill /F /FI `"WINDOWTITLE eq $window`" /T >nul 2>&1"
    }

    Add-Result -Target "Legacy windows" -Status "OK" -Detail "legacy visible service windows were checked"
}

function Show-PortStatus {
    $ports = @(5173, 8004, 8005, 8001, 8002, 6333, 11434, 7687)
    foreach ($port in $ports) {
        $owner = Get-PortOwner -Port $port
        if ($owner) {
            Add-Result -Target "Port $port" -Status "LISTENING" -Detail ("pid {0} {1}" -f $owner.Pid, $owner.Name)
        } else {
            Add-Result -Target "Port $port" -Status "CLOSED" -Detail "no listener"
        }
    }
}

function Show-StateStatus {
    param($State)

    if (-not $State) {
        Add-Result -Target "State" -Status "WARN" -Detail "No launcher state file found"
        Show-PortStatus
        return
    }

    Add-Result -Target "State" -Status "OK" -Detail ("mode={0}; startedAt={1}" -f $State.mode, $State.startedAt)
    foreach ($service in @($State.services)) {
        $alive = Test-PidAlive -ProcessId $service.pid
        $portOwner = $null
        if ($service.port) { $portOwner = Get-PortOwner -Port ([int]$service.port) }
        $http = Invoke-HttpStatus -Url ([string]$service.healthUrl)
        $detail = "pid=$($service.pid) alive=$alive"
        if ($service.port) { $detail += "; port=$($service.port) listening=$([bool]$portOwner)" }
        if ($http -ne "n/a") { $detail += "; health=$http" }
        Add-Result -Target ([string]$service.name) -Status "STATUS" -Detail $detail
    }

    Show-PortStatus
}

function Show-Summary {
    Write-Host ""
    Write-Color "====================================================" "Cyan"
    if ($StatusOnly) {
        Write-Color "                  PLATFORM STATUS" "Cyan"
    } else {
        Write-Color "                 SHUTDOWN SUMMARY" "Cyan"
    }
    Write-Color "====================================================" "Cyan"

    if ($script:Results.Count -gt 0) {
        $script:Results |
            Select-Object Target, Status, Detail |
            Format-Table -AutoSize |
            Out-String |
            Write-Host
    }

    if (-not $StatusOnly) {
        Write-Host "Preserved data and caches:"
        Write-Host "  - Neo4j database/data files were not touched."
        Write-Host "  - Ollama models were not touched."
        Write-Host "  - Qdrant data was not deleted."
        Write-Host "  - Launcher logs remain under $script:LauncherLogDir."
    }
}

Write-Host ""
Write-Color "====================================================" "Cyan"
if ($StatusOnly) {
    Write-Color "        AAST AI AGENT PLATFORM - STATUS" "Cyan"
} else {
    Write-Color "        AAST AI AGENT PLATFORM - SHUTDOWN" "Cyan"
}
Write-Color "====================================================" "Cyan"

$state = Read-LauncherState

if ($StatusOnly) {
    Show-StateStatus -State $state
    Show-Summary
    Pause-IfNeeded
    exit 0
}

Stop-StateProcesses -State $state
Stop-StateContainers -State $state
Stop-FallbackProjectProcesses
Close-LegacyWindows
Start-Sleep -Seconds 1
Show-PortStatus
Show-Summary
Write-Color "Shutdown sequence complete." "Green"
Pause-IfNeeded
exit 0
