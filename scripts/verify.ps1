param(
    [switch]$IncludeBrowserTests
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repository = Split-Path -Parent $PSScriptRoot
Push-Location $repository
try {
    dotnet restore AnalyticsDashboard.slnx -p:RestoreUseStaticGraphEvaluation=true
    if ($LASTEXITCODE -ne 0) { throw 'Solution restore failed.' }

    dotnet test AnalyticsDashboard.slnx --no-restore --nologo -m:1
    if ($LASTEXITCODE -ne 0) { throw '.NET tests failed.' }

    npm --prefix web ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Web dependency installation failed.' }

    npm --prefix web run check
    if ($LASTEXITCODE -ne 0) { throw 'Web tests or build failed.' }

    if ($IncludeBrowserTests) {
        Push-Location (Join-Path $repository 'web')
        try {
            if ($env:CI -eq 'true') {
                npx playwright install --with-deps chromium
                if ($LASTEXITCODE -ne 0) { throw 'Browser installation failed.' }
            }

            npm run test:e2e
            if ($LASTEXITCODE -ne 0) { throw 'Browser integration tests failed.' }
        }
        finally {
            Pop-Location
        }
    }
}
finally {
    Pop-Location
}
