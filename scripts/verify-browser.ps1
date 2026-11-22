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
Push-Location $repository
try {
    # The Playwright web server runs the real API with --no-build. Only its
    # project dependency graph needs building in this isolated runner.
    dotnet restore $apiProject -p:RestoreUseStaticGraphEvaluation=true
    if ($LASTEXITCODE -ne 0) { throw 'Browser API restore failed.' }
    dotnet build $apiProject --no-restore --nologo -m:1
    if ($LASTEXITCODE -ne 0) { throw 'Browser API build failed.' }

    npm --prefix web ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Browser web dependency installation failed.' }

    Push-Location (Join-Path $repository 'web')
    try {
        if ($env:CI -eq 'true') {
            # Installs Linux system libraries even when Chromium is cached.
            npx playwright install --with-deps chromium
            if ($LASTEXITCODE -ne 0) { throw 'Chromium installation failed.' }
        }

        npx playwright test "--shard=$ShardIndex/$ShardTotal"
        if ($LASTEXITCODE -ne 0) { throw "Playwright shard $ShardIndex/$ShardTotal failed." }
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}
