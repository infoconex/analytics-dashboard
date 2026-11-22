$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $repo
try {
    npm --prefix web ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Web dependency installation failed.' }
    npm --prefix web run check
    if ($LASTEXITCODE -ne 0) { throw 'Frontend unit tests, types or build failed.' }
}
finally { Pop-Location }
