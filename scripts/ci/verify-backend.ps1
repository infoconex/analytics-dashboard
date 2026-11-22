$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $repo
try {
    dotnet restore AnalyticsDashboard.slnx -p:RestoreUseStaticGraphEvaluation=true
    if ($LASTEXITCODE -ne 0) { throw 'Solution restore failed.' }
    dotnet test AnalyticsDashboard.slnx --no-restore --nologo -m:1 --filter 'TestCategory!=ProviderIntegration'
    if ($LASTEXITCODE -ne 0) { throw 'Backend test suite failed.' }
}
finally { Pop-Location }
