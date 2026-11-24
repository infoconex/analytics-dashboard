param(
    [ValidateRange(1, 64)]
    [int]$ShardIndex = 1,
    [ValidateRange(1, 64)]
    [int]$ShardTotal = 1
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($ShardIndex -gt $ShardTotal) {
    throw "Shard index $ShardIndex cannot exceed shard total $ShardTotal."
}

$repository = Split-Path -Parent $PSScriptRoot
$apiProject = Join-Path $repository 'src/AnalyticsDashboard.Api/AnalyticsDashboard.Api.csproj'
$hostedCi = $env:CI -eq 'true' -and $env:GITHUB_ACTIONS -eq 'true' -and $env:RUNNER_OS -eq 'Linux'
$timings = [System.Collections.Generic.List[object]]::new()
$reportDir = Join-Path $repository 'web/test-results'

function Measure-Phase([string]$Name, [scriptblock]$Action) {
    $start = [DateTimeOffset]::UtcNow
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    $passed = $false
    try {
        & $Action
        $passed = $true
    }
    finally {
        $timer.Stop()
        if ($hostedCi) {
            $entry = [ordered]@{
                phase = $Name
                startedUtc = $start.ToString('o')
                elapsedMs = $timer.ElapsedMilliseconds
                succeeded = $passed
            }
            $timings.Add($entry)
            Write-Host ("CI browser timing: " + ($entry | ConvertTo-Json -Compress))
        }
    }
}

Push-Location $repository
try {
    # The Playwright web server runs the real API with --no-build. Only its
    # project dependency graph needs building in this isolated runner.
    Measure-Phase 'api-restore' {
        dotnet restore $apiProject -p:RestoreUseStaticGraphEvaluation=true
        if ($LASTEXITCODE -ne 0) { throw 'Browser API restore failed.' }
    }
    Measure-Phase 'api-build' {
        dotnet build $apiProject --no-restore --nologo -m:1
        if ($LASTEXITCODE -ne 0) { throw 'Browser API build failed.' }
    }
    Measure-Phase 'npm-ci' {
        npm --prefix web ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Browser web dependency installation failed.' }
    }

    Push-Location (Join-Path $repository 'web')
    try {
        if ($hostedCi) {
            # Same locked Playwright dependency installer as --with-deps,
            # measured separately from the browser binary preparation.
            Measure-Phase 'linux-dependencies' {
                npx playwright install-deps chromium
                if ($LASTEXITCODE -ne 0) { throw 'Chromium system dependency installation failed.' }
            }
            Measure-Phase 'chromium-prepare' {
                npx playwright install chromium
                if ($LASTEXITCODE -ne 0) { throw 'Chromium installation failed.' }
            }
        }
        elseif ($env:CI -eq 'true') {
            npx playwright install --with-deps chromium
            if ($LASTEXITCODE -ne 0) { throw 'Chromium installation failed.' }
        }

        Measure-Phase 'playwright-including-server-startup' {
            if ($hostedCi) {
                $env:PLAYWRIGHT_JSON_OUTPUT_FILE = Join-Path $reportDir 'ci-playwright-report.json'
                npx playwright test "--shard=$ShardIndex/$ShardTotal" --reporter=dot,json
            }
            else {
                npx playwright test "--shard=$ShardIndex/$ShardTotal"
            }
            if ($LASTEXITCODE -ne 0) { throw "Playwright shard $ShardIndex/$ShardTotal failed." }
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
    if ($hostedCi) {
        # Playwright clears its output directory at startup. Write phase
        # timings afterwards, including completed phases on failed runs.
        New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
        $report = [ordered]@{
            schemaVersion = 1
            shardIndex = $ShardIndex
            shardTotal = $ShardTotal
            phases = $timings.ToArray()
        }
        $report | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $reportDir 'ci-browser-phases.json')
    }
}
