param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runDirectory = Join-Path $projectRoot ".run"
. (Join-Path $PSScriptRoot "load-env.ps1") -Path (Join-Path $projectRoot ".env")

$backendHost = if ($env:BACKEND_HOST) { $env:BACKEND_HOST } else { "127.0.0.1" }
$backendPort = if ($env:BACKEND_PORT) { [int]$env:BACKEND_PORT } else { 8080 }
$frontendHost = if ($env:FRONTEND_HOST) { $env:FRONTEND_HOST } else { "127.0.0.1" }
$frontendPort = if ($env:FRONTEND_PORT) { [int]$env:FRONTEND_PORT } else { 5173 }
$backendUrl = "http://${backendHost}:${backendPort}/api/health"
$frontendUrl = "http://${frontendHost}:${frontendPort}"

New-Item -ItemType Directory -Force -Path $runDirectory | Out-Null

function Test-Url {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    }
    catch {
        return $false
    }
}

function Wait-ForUrl {
    param(
        [string]$Url,
        [string]$ServiceName,
        [int]$Attempts = 60
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        if (Test-Url -Url $Url) {
            Write-Host "$ServiceName is ready." -ForegroundColor Green
            return
        }
        Start-Sleep -Milliseconds 500
    }

    throw "$ServiceName did not become ready. Check the logs in $runDirectory."
}

function Save-ListeningProcessId {
    param(
        [int]$Port,
        [string]$PidFile
    )

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($connection) {
        Set-Content -LiteralPath $PidFile -Value $connection.OwningProcess
    }
}

Push-Location $projectRoot
try {
    Write-Host "Starting PostgreSQL..." -ForegroundColor Cyan
    & docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        throw "Could not start PostgreSQL. Make sure Docker Desktop is running."
    }

    if (Test-Url -Url $backendUrl) {
        Write-Host "Restarting the existing backend..." -ForegroundColor Cyan
        $connection = Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if (-not $connection) {
            throw "The backend is reachable, but its process could not be identified. Stop it manually and try again."
        }
        $existingBackendId = $connection.OwningProcess
        Stop-Process -Id $existingBackendId -Force
        try {
            Wait-Process -Id $existingBackendId -Timeout 10 -ErrorAction Stop
        }
        catch {
            throw "The existing backend process did not stop."
        }
    }

    Write-Host "Building backend..." -ForegroundColor Cyan
    & (Join-Path $projectRoot "mvnw.cmd") package "-DskipTests"
    if ($LASTEXITCODE -ne 0) {
        throw "The backend build failed."
    }

    Write-Host "Starting backend..." -ForegroundColor Cyan
    $backendProcess = Start-Process `
        -FilePath "java" `
        -ArgumentList @(
            "-jar",
            "target\arenaparser-0.0.1-SNAPSHOT.jar",
            "--spring.profiles.active=local"
        ) `
        -WorkingDirectory $projectRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $runDirectory "backend.out.log") `
        -RedirectStandardError (Join-Path $runDirectory "backend.err.log") `
        -PassThru

    Set-Content -LiteralPath (Join-Path $runDirectory "backend.pid") -Value $backendProcess.Id

    Wait-ForUrl -Url $backendUrl -ServiceName "Backend"

    if (-not (Test-Url -Url $frontendUrl)) {
        $vitePath = Join-Path $projectRoot "frontend\node_modules\vite\bin\vite.js"
        if (-not (Test-Path -LiteralPath $vitePath)) {
            Write-Host "Installing frontend packages..." -ForegroundColor Cyan
            Push-Location (Join-Path $projectRoot "frontend")
            try { & corepack pnpm install --frozen-lockfile }
            finally { Pop-Location }
            if ($LASTEXITCODE -ne 0) { throw "Frontend package installation failed." }
        }

        Write-Host "Starting frontend..." -ForegroundColor Cyan
        $frontendProcess = Start-Process `
            -FilePath "node" `
            -ArgumentList @("node_modules\vite\bin\vite.js", "--host", $frontendHost, "--port", "$frontendPort") `
            -WorkingDirectory (Join-Path $projectRoot "frontend") `
            -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $runDirectory "frontend.out.log") `
            -RedirectStandardError (Join-Path $runDirectory "frontend.err.log") `
            -PassThru

        Set-Content -LiteralPath (Join-Path $runDirectory "frontend.pid") -Value $frontendProcess.Id
    }
    else {
        Write-Host "Frontend is already running." -ForegroundColor Yellow
        Save-ListeningProcessId -Port $frontendPort -PidFile (Join-Path $runDirectory "frontend.pid")
    }

    Wait-ForUrl -Url $frontendUrl -ServiceName "Frontend"

    if (-not $NoBrowser) {
        Write-Host "Opening ArenaParser in your default browser..." -ForegroundColor Cyan
        Start-Process $frontendUrl
    }
    Write-Host "ArenaParser is running. Use .\stop.cmd to stop it." -ForegroundColor Green
}
finally {
    Pop-Location
}
