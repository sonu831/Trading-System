param(
    [string]$RulesPath = "C:\learning\tradingview-mcp\rules.json",
    [string]$OutputDir = "$env:USERPROFILE\.tradingview-mcp\sessions",
    [string]$NodeExe = "C:\nvm4w\nodejs\node.exe",
    [string]$TvCli = "C:\learning\tradingview-mcp\src\cli\index.js"
)

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$outFile = Join-Path $OutputDir "$timestamp.json"

# Validate CDP is reachable
try {
    $cdp = Invoke-RestMethod -Uri "http://localhost:9222/json/version" -UseBasicParsing -TimeoutSec 5
} catch {
    $error | ConvertTo-Json | Set-Content -Path $outFile -Encoding UTF8
    Write-Host "CDP not reachable - snapshot saved with error"
    exit 1
}

# Read rules
if (-not (Test-Path $RulesPath)) {
    @{ "error" = "rules.json not found at $RulesPath"; "timestamp" = $timestamp } |
        ConvertTo-Json -Depth 5 | Set-Content -Path $outFile -Encoding UTF8
    exit 1
}
$rules = Get-Content $RulesPath -Raw | ConvertFrom-Json

$results = @()
$rules.watchlist | ForEach-Object {
    $symbol = $_
    Write-Host "Processing $symbol"
    $symbolData = @{ symbol = $symbol; timeframes = @() }
    & $NodeExe $TvCli symbol $symbol 2>$null | Out-Null
    Start-Sleep -Seconds 2
    foreach ($tf in $rules.timeframes) {
        $res = switch ($tf) { '1W' { 'W' } '1D' { 'D' } '4H' { '240' } default { $tf } }
        & $NodeExe $TvCli timeframe $res 2>$null | Out-Null
        Start-Sleep -Seconds 2
        $ohclvData = & $NodeExe $TvCli ohlcv --count 20 2>$null
        $symbolData.timeframes += @{
            timeframe = $tf
            ohlcv = ($ohclvData | ConvertFrom-Json -ErrorAction SilentlyContinue)
        }
    }
    $results += $symbolData
}

$output = @{
    timestamp = $timestamp
    status = "snapshot"
    data = $results
}

$output | ConvertTo-Json -Depth 10 | Set-Content -Path $outFile -Encoding UTF8
Write-Host "Snapshot saved to $outFile"
