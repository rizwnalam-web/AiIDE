$version  = "winCodeSign-2.6.0"
$url      = "https://github.com/electron-userland/electron-builder-binaries/releases/download/$version/$version.7z"
$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
$zipPath  = "$cacheDir\download.7z"
$outDir   = "$cacheDir\$version"
$7za      = Join-Path $PSScriptRoot "..\node_modules\7zip-bin\win\x64\7za.exe"

if (Test-Path $outDir) {
    Write-Host "Cache already exists - skipping." -ForegroundColor Green
    exit 0
}

New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
New-Item -ItemType Directory -Force -Path $outDir   | Out-Null

Write-Host "Downloading $version..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
Write-Host "Download complete." -ForegroundColor Green

Write-Host "Extracting archive (symlink errors are expected and handled)..." -ForegroundColor Cyan
& $7za x $zipPath "-o$outDir" -y 2>&1 | Out-Null
$exitCode = $LASTEXITCODE

# Exit code 2 means some items failed (the 2 darwin dylib symlinks).
# Everything else extracts fine. We create dummy files for the missing ones.
if ($exitCode -eq 0 -or $exitCode -eq 2) {
    $symlinks = @(
        "darwin\10.12\lib\libcrypto.dylib",
        "darwin\10.12\lib\libssl.dylib"
    )
    foreach ($rel in $symlinks) {
        $full = Join-Path $outDir $rel
        $dir  = Split-Path $full
        if (-not (Test-Path $dir))  { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        if (-not (Test-Path $full)) { [System.IO.File]::WriteAllText($full, "") }
    }
    Write-Host "Done. Cache ready at: $outDir" -ForegroundColor Green
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    exit 0
} else {
    Write-Host "Extraction failed with unexpected exit code: $exitCode" -ForegroundColor Red
    exit 1
}
