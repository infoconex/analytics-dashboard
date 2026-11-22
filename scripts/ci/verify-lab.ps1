$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $repo
try {
    npm --prefix web ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Web dependency installation failed.' }
    npm --prefix web run test:lab
    if ($LASTEXITCODE -ne 0) { throw 'Fictional lab fixture and admission tests failed.' }
}
finally { Pop-Location }
