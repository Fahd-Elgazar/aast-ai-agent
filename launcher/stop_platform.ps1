# stop_platform.ps1
$ErrorActionPreference = "Continue"

function Write-Color {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

Write-Color "====================================================" "Cyan"
Write-Color "      AAST AI AGENT PLATFORM - SHUTDOWN" "Cyan"
Write-Color "====================================================" "Cyan"
Write-Host ""

Write-Host "[1/4] " -NoNewline; Write-Color "Stopping targeted Node.js processes..." "Yellow"
$nodeProcs = Get-WmiObject Win32_Process -Filter "Name = 'node.exe'"
foreach ($p in $nodeProcs) {
    if ($p.CommandLine -match "orchestrator.js" -or $p.CommandLine -match "vite" -or $p.CommandLine -match "frontend" -or $p.CommandLine -match "backend") {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
Write-Color "  [✅] Node processes stopped." "Green"

Write-Host "[2/4] " -NoNewline; Write-Color "Stopping targeted Python processes..." "Yellow"
$pyProcs = Get-WmiObject Win32_Process -Filter "Name = 'python.exe' OR Name = 'uvicorn.exe'"
foreach ($p in $pyProcs) {
    if ($p.CommandLine -match "uvicorn" -or $p.CommandLine -match "phase3_retriever" -or $p.CommandLine -match "app.main:app") {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
Write-Color "  [✅] Python processes stopped." "Green"

Write-Host "[3/4] " -NoNewline; Write-Color "Stopping Qdrant Docker container..." "Yellow"
docker stop qdrant_prod 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Color "  [✅] Qdrant container stopped." "Green"
} else {
    Write-Color "  [-] Qdrant container was not running or Docker is off." "DarkGray"
}

Write-Host "[4/4] " -NoNewline; Write-Color "Cleaning up terminal windows..." "Yellow"
$windows = @(
    "RAG Retriever [Port 8001]",
    "Decision System [Port 8005]",
    "Orchestrator Backend [Port 8004]",
    "Frontend [Port 5173]"
)

foreach ($win in $windows) {
    cmd.exe /c "taskkill /F /FI `"WINDOWTITLE eq $win`" /T >nul 2>&1"
}
Write-Color "  [✅] Terminal windows closed." "Green"

Write-Host ""
Write-Color "====================================================" "Cyan"
Write-Color "      SHUTDOWN COMPLETE" "Green"
Write-Color "====================================================" "Cyan"
Start-Sleep -Seconds 3
