$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$keystorePath = Join-Path $repoRoot 'release\xiaoy-calendar-release.jks'
$apkOutput = Join-Path $repoRoot 'release\xiaoy-calendar-1.0-store.apk'
$aabOutput = Join-Path $repoRoot 'release\xiaoy-calendar-1.0-store.aab'

if (-not (Test-Path -LiteralPath $keystorePath)) {
    throw "Signing keystore was not found: $keystorePath"
}

$passwordPointer = [IntPtr]::Zero
$plainPassword = $null

try {
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $securePassword = Read-Host 'Enter the signing password (input is hidden)' -AsSecureString
        $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

        & keytool -list -keystore $keystorePath -storepass $plainPassword *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Host 'Password verified. Starting the signed release build...' -ForegroundColor Green
            break
        }

        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
        $passwordPointer = [IntPtr]::Zero
        $plainPassword = $null
        Write-Host "Incorrect password. Please try again ($attempt/3)." -ForegroundColor Red

        if ($attempt -eq 3) {
            throw 'The signing password was incorrect three times.'
        }
    }

    $env:XIAOY_STORE_FILE = $keystorePath
    $env:XIAOY_STORE_PASSWORD = $plainPassword
    $env:XIAOY_KEY_ALIAS = 'xiaoy-calendar'
    $env:XIAOY_KEY_PASSWORD = $plainPassword

    Push-Location $repoRoot
    try {
        & npm.cmd run android:release
        if ($LASTEXITCODE -ne 0) {
            throw "Android release build failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }

    $builtApk = Join-Path $repoRoot 'android\app\build\outputs\apk\release\app-release.apk'
    $builtAab = Join-Path $repoRoot 'android\app\build\outputs\bundle\release\app-release.aab'
    if (-not (Test-Path -LiteralPath $builtApk)) { throw "Signed APK was not generated: $builtApk" }
    if (-not (Test-Path -LiteralPath $builtAab)) { throw "Signed AAB was not generated: $builtAab" }

    Copy-Item -LiteralPath $builtApk -Destination $apkOutput -Force
    Copy-Item -LiteralPath $builtAab -Destination $aabOutput -Force

    $buildTools = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Android\Sdk\build-tools') -Directory |
        Sort-Object Name -Descending |
        Select-Object -First 1
    $apkSigner = Join-Path $buildTools.FullName 'apksigner.bat'

    Write-Host ''
    Write-Host 'Verifying signed APK...'
    & $apkSigner verify --verbose --print-certs $apkOutput
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }

    Write-Host ''
    Write-Host 'Verifying signed AAB...'
    & jarsigner -verify $aabOutput
    if ($LASTEXITCODE -ne 0) { throw 'AAB signature verification failed.' }

    Write-Host ''
    Write-Host 'STORE PACKAGES READY:' -ForegroundColor Green
    Write-Host $apkOutput
    Write-Host $aabOutput
    Write-Host ''
    Write-Host 'Keep the JKS file and password permanently. Future updates must use the same signing key.' -ForegroundColor Yellow
}
finally {
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    $plainPassword = $null
    Remove-Item Env:XIAOY_STORE_FILE -ErrorAction SilentlyContinue
    Remove-Item Env:XIAOY_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:XIAOY_KEY_ALIAS -ErrorAction SilentlyContinue
    Remove-Item Env:XIAOY_KEY_PASSWORD -ErrorAction SilentlyContinue
}
