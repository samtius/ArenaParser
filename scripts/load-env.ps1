param([Parameter(Mandatory = $true)][string]$Path)

if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing .env file. Copy .env.example to .env and configure it for this computer."
}

foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $separator = $trimmed.IndexOf("=")
    if ($separator -lt 1) { continue }
    $name = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim().Trim('"').Trim("'")
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
}

$postgresHost = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "127.0.0.1" }
$postgresPort = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "15432" }
$postgresDatabase = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "arenaparser" }
[Environment]::SetEnvironmentVariable("SPRING_DATASOURCE_URL", "jdbc:postgresql://${postgresHost}:${postgresPort}/${postgresDatabase}", "Process")
[Environment]::SetEnvironmentVariable("SPRING_DATASOURCE_USERNAME", $env:POSTGRES_USER, "Process")
[Environment]::SetEnvironmentVariable("SPRING_DATASOURCE_PASSWORD", $env:POSTGRES_PASSWORD, "Process")
