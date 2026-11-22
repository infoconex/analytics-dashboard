param(
    [switch]$IncludeBrowserTests
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Local aggregate entry point. CI invokes the same focused scripts in parallel.
& (Join-Path $PSScriptRoot 'ci/verify-backend.ps1')
& (Join-Path $PSScriptRoot 'ci/verify-frontend.ps1')
& (Join-Path $PSScriptRoot 'ci/verify-lab.ps1')

if ($IncludeBrowserTests) {
    & (Join-Path $PSScriptRoot 'verify-browser.ps1')
}
