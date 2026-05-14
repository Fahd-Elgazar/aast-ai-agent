# start_platform.ps1
$ErrorActionPreference = "Continue"

function Write-Color {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

Write-Color "====================================================" "Cyan"
Write-Color "      AAST AI AGENT PLATFORM - LAUNCHER" "Cyan"
Write-Color "====================================================" "Cyan"
Write-Host ""

# Dynamic Paths based on the script location
$baseDir = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$frontendPath = Join-Path $baseDir "aast-ai-agent-main\frontend"
$backendPath = Join-Path $baseDir "aast-ai-agent-main\backend"
$decisionPath = Join-Path $baseDir "college-decision-system-backend"
$ragPath = Join-Path $baseDir "aast-ai-agent-main\backend\rag_system"

function Check-Port {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($connection) { return $true }
    return $false
}

# 1. Qdrant (Docker)
Write-Host "[1/7] " -NoNewline; Write-Color "Checking Qdrant (Docker)..." "Yellow"
$qdrantRunning = docker ps --filter "name=qdrant_prod" --format "{{.Names}}"
if ($qdrantRunning -match "qdrant_prod") {
    Write-Color "  [✅] Qdrant is already running." "Green"
} else {
    Write-Color "  [*] Starting Qdrant container..." "DarkGray"
    docker start qdrant_prod | Out-Null
    Start-Sleep -Seconds 2
    if ($LASTEXITCODE -eq 0) {
        Write-Color "  [✅] Qdrant started successfully." "Green"
    } else {
        Write-Color "  [⚠] Failed to start Qdrant. Is Docker Desktop running?" "Red"
    }
}

# 2. Neo4j
Write-Host "[2/7] " -NoNewline; Write-Color "Checking Neo4j (Port 7687)..." "Yellow"
if (Check-Port 7687) {
    Write-Color "  [✅] Neo4j is running." "Green"
} else {
    Write-Color "  [⚠] Neo4j is not running on 7687. (Ensure Neo4j Desktop is on)" "DarkYellow"
}

# 3. Ollama
Write-Host "[3/7] " -NoNewline; Write-Color "Checking Ollama (Port 11434)..." "Yellow"
if (Check-Port 11434) {
    Write-Color "  [✅] Ollama is running." "Green"
} else {
    Write-Color "  [⚠] Ollama is not running on 11434. Please start Ollama." "DarkYellow"
}

# 4. RAG Retriever
Write-Host "[4/7] " -NoNewline; Write-Color "Starting RAG Retriever (Port 8001)..." "Yellow"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-WindowStyle", "Normal", "-Command", "`$Host.UI.RawUI.WindowTitle = 'RAG Retriever [Port 8001]'; cd '$ragPath'; uvicorn phase3_retriever:app --port 8001"
Write-Color "  [✅] RAG Retriever launched." "Green"

# 5. Decision System
Write-Host "[5/7] " -NoNewline; Write-Color "Starting Decision System (Port 8005)..." "Yellow"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-WindowStyle", "Normal", "-Command", "`$Host.UI.RawUI.WindowTitle = 'Decision System [Port 8005]'; cd '$decisionPath'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8005 --reload"
Write-Color "  [✅] Decision System launched." "Green"

# 6. Orchestrator Backend
Write-Host "[6/7] " -NoNewline; Write-Color "Starting Orchestrator Backend (Port 8004)..." "Yellow"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-WindowStyle", "Normal", "-Command", "`$Host.UI.RawUI.WindowTitle = 'Orchestrator Backend [Port 8004]'; cd '$backendPath'; node orchestrator.js"
Write-Color "  [✅] Orchestrator Backend launched." "Green"

# 7. Frontend
Write-Host "[7/7] " -NoNewline; Write-Color "Starting Frontend (Port 5173)..." "Yellow"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-WindowStyle", "Normal", "-Command", "`$Host.UI.RawUI.WindowTitle = 'Frontend [Port 5173]'; cd '$frontendPath'; npm run dev"
Write-Color "  [✅] Frontend launched." "Green"

Write-Host ""
Write-Color "====================================================" "Cyan"
Write-Color "      ALL SERVICES INSTRUCTED TO START" "Green"
Write-Color "====================================================" "Cyan"
Write-Host "Monitor the opened terminal windows for logs."
Write-Host ""
Write-Host "Dashboard:"
Write-Color "  - Frontend:      http://localhost:5173" "White"
Write-Color "  - Orchestrator:  http://localhost:8004" "White"
Write-Color "  - Decision:      http://localhost:8005" "White"
Write-Color "  - Retriever:     http://localhost:8001" "White"
Write-Color "  - Ollama:        http://localhost:11434" "White"
Write-Color "  - Qdrant:        http://localhost:6333" "White"
Write-Host ""
Read-Host "Press Enter to exit this launcher..."
