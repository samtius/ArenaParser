$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runDirectory = Join-Path $projectRoot ".run"

function Stop-TrackedProcess {
    param(
        [string]$PidFile,
        [string]$ServiceName,
        [int]$Port,
        [string]$VerificationUrl
    )

    if (-not (Test-Path -LiteralPath $PidFile)) {
        try {
            $response = Invoke-WebRequest -Uri $VerificationUrl -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
                    Select-Object -First 1
                if ($connection) {
                    Set-Content -LiteralPath $PidFile -Value $connection.OwningProcess
                }
            }
        }
        catch {
            # The service is not reachable, so there is nothing to stop.
        }
    }

    if (-not (Test-Path -LiteralPath $PidFile)) {
        Write-Host "$ServiceName is already stopped." -ForegroundColor Yellow
        return
    }

    $processId = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue
    if ($processId -and (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $processId -Force
        Wait-Process -Id $processId -Timeout 10 -ErrorAction SilentlyContinue
        Write-Host "$ServiceName stopped." -ForegroundColor Green
    }
    else {
        Write-Host "$ServiceName is already stopped." -ForegroundColor Yellow
    }

    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

Stop-TrackedProcess `
    -PidFile (Join-Path $runDirectory "frontend.pid") `
    -ServiceName "Frontend" `
    -Port 5173 `
    -VerificationUrl "http://127.0.0.1:5173"

Stop-TrackedProcess `
    -PidFile (Join-Path $runDirectory "backend.pid") `
    -ServiceName "Backend" `
    -Port 8080 `
    -VerificationUrl "http://localhost:8080/api/health"

Push-Location $projectRoot
try {
    & docker compose stop
    if ($LASTEXITCODE -ne 0) {
        throw "Could not stop PostgreSQL."
    }
    Write-Host "PostgreSQL stopped. Database data is preserved." -ForegroundColor Green
}
finally {
    Pop-Location
}
