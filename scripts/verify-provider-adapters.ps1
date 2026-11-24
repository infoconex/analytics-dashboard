$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$required = @(
    'ANALYTICS_TEST_SQLSERVER_ADMIN', 'ANALYTICS_TEST_POSTGRES_ADMIN',
    'ANALYTICS_TEST_SQLSERVER_READER', 'ANALYTICS_TEST_POSTGRES_READER',
    'ANALYTICS_TEST_MYSQL_ADMIN', 'ANALYTICS_TEST_MYSQL_READER'
)
foreach ($variable in $required) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($variable))) {
        throw "Provider test environment variable $variable is missing."
    }
}

$repository = Split-Path -Parent $PSScriptRoot
Push-Location $repository
try {
    dotnet test tests/AnalyticsDashboard.Tests/AnalyticsDashboard.Tests.csproj --nologo `
        --filter 'TestCategory=ProviderIntegration'
    if ($LASTEXITCODE -ne 0) { throw 'Real-provider conformance tests failed.' }
}
finally {
    Pop-Location
}
