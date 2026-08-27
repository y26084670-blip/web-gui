[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Install', 'Configure', 'ConfigureFirewall', 'Start', 'InstallRootCertificate')]
    [string] $Action,

    [string] $CertificatePath,

    [string] $ExpectedSha256
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $PSCommandPath
$projectRoot = (Resolve-Path (Join-Path $scriptDirectory '..\..')).Path
$deployDirectory = Join-Path $projectRoot 'deploy\caddy'
$caddyFile = Join-Path $deployDirectory 'Caddyfile'
$settingsFile = Join-Path $deployDirectory 'settings.local.json'
$pidFile = Join-Path $deployDirectory 'caddy.local.pid'
$exportedRootCertificate = Join-Path $deployDirectory 'root.crt'
$firewallRuleName = 'Clark Web GUI - Caddy HTTPS'
$adminAddress = '127.0.0.1:2021'
$caddyVersion = '2.11.4'

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path,

        [Parameter(Mandatory = $true)]
        [string] $Content
    )

    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-ElevatedAction {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ElevatedAction,

        [string] $ElevatedCertificatePath,

        [string] $ElevatedExpectedSha256
    )

    Write-Host 'Administrator access is required. Confirm the Windows UAC prompt.'
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Action $ElevatedAction"
    if (-not [string]::IsNullOrWhiteSpace($ElevatedCertificatePath)) {
        $arguments += " -CertificatePath `"$ElevatedCertificatePath`""
    }
    if (-not [string]::IsNullOrWhiteSpace($ElevatedExpectedSha256)) {
        $arguments += " -ExpectedSha256 `"$ElevatedExpectedSha256`""
    }

    $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs -Wait -PassThru
    return $process.ExitCode
}

function Get-CaddyExecutable {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\caddy.exe'),
        (Join-Path $env:ProgramFiles 'Caddy\caddy.exe')
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    $command = Get-Command 'caddy.exe' -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    throw 'Caddy is not installed. Run scripts\caddy\install.cmd first.'
}

function Test-SiteHost {
    param(
        [Parameter(Mandatory = $true)]
        [string] $SiteHost
    )

    if ([string]::IsNullOrWhiteSpace($SiteHost) -or $SiteHost.Contains('://')) {
        return $false
    }

    if ([Uri]::CheckHostName($SiteHost) -ne [UriHostNameType]::IPv4) {
        return $false
    }

    $ipAddress = [Net.IPAddress]::Parse($SiteHost)
    if ([Net.IPAddress]::IsLoopback($ipAddress) -or
        $ipAddress.Equals([Net.IPAddress]::Any) -or
        $SiteHost.StartsWith('169.254.')) {
        return $false
    }

    $localAddress = Get-NetIPAddress `
        -AddressFamily IPv4 `
        -IPAddress $SiteHost `
        -ErrorAction SilentlyContinue |
        Where-Object { $_.AddressState -eq 'Preferred' } |
        Select-Object -First 1
    return $null -ne $localAddress
}

function Set-CaddyEnvironment {
    param(
        [Parameter(Mandatory = $true)]
        [string] $SiteHost
    )

    $env:CLARK_GUI_HOST = $SiteHost
    $env:CLARK_GUI_ROOT = $projectRoot.Replace('\', '/')
}

function Test-CaddyConfiguration {
    param(
        [Parameter(Mandatory = $true)]
        [string] $CaddyExecutable
    )

    & $CaddyExecutable validate --config $caddyFile --adapter caddyfile
    if ($LASTEXITCODE -ne 0) {
        throw 'Caddy configuration validation failed.'
    }
}

function Read-CaddySettings {
    if (-not (Test-Path -LiteralPath $settingsFile)) {
        throw 'LAN settings are missing. Run scripts\caddy\configure.cmd first.'
    }

    $settings = Get-Content -LiteralPath $settingsFile -Raw | ConvertFrom-Json
    $siteHost = [string] $settings.host
    if (-not (Test-SiteHost -SiteHost $siteHost)) {
        throw 'The host in settings.local.json is invalid. Run configure.cmd again.'
    }

    return $siteHost
}

function Export-CaddyRootCertificate {
    $relativeCertificatePath = 'pki\authorities\local\root.crt'
    $candidates = New-Object System.Collections.Generic.List[string]
    Remove-Item -LiteralPath $exportedRootCertificate -Force -ErrorAction SilentlyContinue

    if (-not [string]::IsNullOrWhiteSpace($env:XDG_DATA_HOME)) {
        $candidates.Add((Join-Path (Join-Path $env:XDG_DATA_HOME 'caddy') $relativeCertificatePath))
    }
    if (-not [string]::IsNullOrWhiteSpace($env:APPDATA)) {
        $candidates.Add((Join-Path (Join-Path $env:APPDATA 'Caddy') $relativeCertificatePath))
    }
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $candidates.Add((Join-Path (Join-Path $env:USERPROFILE '.local\share\caddy') $relativeCertificatePath))
    }

    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        foreach ($candidate in $candidates) {
            if (Test-Path -LiteralPath $candidate) {
                Copy-Item -LiteralPath $candidate -Destination $exportedRootCertificate -Force
                Write-Host "Public root certificate exported to: $exportedRootCertificate"
                $certificateHash = (Get-FileHash -LiteralPath $exportedRootCertificate -Algorithm SHA256).Hash
                Write-Host "Root certificate SHA-256: $certificateHash"
                return
            }
        }

        Start-Sleep -Seconds 1
    }

    Write-Warning 'Caddy is running, but its root certificate was not found yet. Run start.cmd again after a few seconds.'
}

function Install-Caddy {
    $installedCaddy = $null
    try {
        $installedCaddy = Get-CaddyExecutable
    }
    catch {
        $installedCaddy = $null
    }

    if ($null -ne $installedCaddy) {
        $installedVersionText = (& $installedCaddy version 2>&1 | Out-String).Trim()
        if ($LASTEXITCODE -eq 0 -and $installedVersionText -match '^v?(\d+\.\d+\.\d+)') {
            $installedVersion = [Version] $Matches[1]
            if ($installedVersion -ge [Version] $caddyVersion) {
                Write-Host "Caddy $installedVersion is already installed: $installedCaddy"
                return
            }
        }
    }

    $winget = Get-Command 'winget.exe' -ErrorAction SilentlyContinue
    if ($null -eq $winget) {
        throw 'Windows Package Manager (winget) is not installed.'
    }

    & $winget.Source install --exact --id CaddyServer.Caddy --version $caddyVersion --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "winget failed with exit code $LASTEXITCODE."
    }

    $caddyExecutable = Get-CaddyExecutable
    $installedVersionText = (& $caddyExecutable version 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $installedVersionText -notmatch '^v?(\d+\.\d+\.\d+)') {
        throw 'Caddy was installed, but its version could not be verified.'
    }
    $verifiedVersion = [Version] $Matches[1]
    if ($verifiedVersion -lt [Version] $caddyVersion) {
        throw "Caddy $verifiedVersion is older than required version $caddyVersion."
    }
}

function Configure-Caddy {
    $caddyExecutable = Get-CaddyExecutable

    do {
        $siteHost = (Read-Host 'Stable LAN IPv4 address, without https://').Trim()
        if (-not (Test-SiteHost -SiteHost $siteHost)) {
            Write-Warning 'Enter a stable, active IPv4 address assigned to this computer, for example 192.168.1.50.'
        }
    } until (Test-SiteHost -SiteHost $siteHost)

    if (-not (Test-Path -LiteralPath $deployDirectory)) {
        New-Item -ItemType Directory -Path $deployDirectory | Out-Null
    }

    $settingsJson = [ordered]@{ host = $siteHost } | ConvertTo-Json
    Write-Utf8NoBom -Path $settingsFile -Content ($settingsJson + [Environment]::NewLine)

    Set-CaddyEnvironment -SiteHost $siteHost
    Test-CaddyConfiguration -CaddyExecutable $caddyExecutable

    if (Test-Administrator) {
        Configure-CaddyFirewall
    }
    else {
        $firewallExitCode = Invoke-ElevatedAction -ElevatedAction 'ConfigureFirewall'
        if ($firewallExitCode -ne 0) {
            throw "The Windows Firewall rule was not created (exit code $firewallExitCode)."
        }
    }

    Write-Host "Caddy is configured for https://$siteHost/"
    Write-Host 'The firewall rule is active only while the Windows network profile is Private.'
}

function Configure-CaddyFirewall {
    if (-not (Test-Administrator)) {
        throw 'Administrator access is required to configure Windows Firewall.'
    }

    Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue |
        Remove-NetFirewallRule -ErrorAction SilentlyContinue
    New-NetFirewallRule `
        -DisplayName $firewallRuleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort 443 `
        -Profile Private | Out-Null
}

function Start-Caddy {
    $caddyExecutable = Get-CaddyExecutable
    $siteHost = Read-CaddySettings
    $distIndex = Join-Path $projectRoot 'dist\index.html'

    if (-not (Test-Path -LiteralPath $distIndex)) {
        throw 'dist\index.html is missing. Run scripts\release-lan.cmd first.'
    }

    Set-CaddyEnvironment -SiteHost $siteHost
    Test-CaddyConfiguration -CaddyExecutable $caddyExecutable

    $firewallRule = Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue |
        Where-Object { $_.Enabled -eq 'True' } |
        Select-Object -First 1
    if ($null -eq $firewallRule) {
        Write-Host 'The Windows Firewall rule is missing or disabled.'
        if (Test-Administrator) {
            Configure-CaddyFirewall
        }
        else {
            $firewallExitCode = Invoke-ElevatedAction -ElevatedAction 'ConfigureFirewall'
            if ($firewallExitCode -ne 0) {
                throw "The Windows Firewall rule was not created (exit code $firewallExitCode)."
            }
        }
    }

    $existingProcess = $null
    if (Test-Path -LiteralPath $pidFile) {
        $storedPid = 0
        $pidText = ([string] (Get-Content -LiteralPath $pidFile -Raw)).Trim()
        if ([int]::TryParse($pidText, [ref] $storedPid)) {
            $processInfo = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $storedPid" -ErrorAction SilentlyContinue
            if ($null -ne $processInfo -and
                $processInfo.Name -eq 'caddy.exe' -and
                $processInfo.CommandLine -like '*deploy/caddy/Caddyfile*') {
                $existingProcess = Get-Process -Id $storedPid -ErrorAction SilentlyContinue
            }
        }
    }

    if ($null -ne $existingProcess) {
        & $caddyExecutable reload --address $adminAddress --config $caddyFile --adapter caddyfile
        if ($LASTEXITCODE -ne 0) {
            throw 'The existing Caddy process could not reload the configuration.'
        }
        Write-Host "Caddy configuration reloaded for https://$siteHost/"
    }
    else {
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
        $arguments = @(
            'run',
            '--config', 'deploy/caddy/Caddyfile',
            '--adapter', 'caddyfile',
            '--pidfile', 'deploy/caddy/caddy.local.pid'
        )
        $process = Start-Process `
            -FilePath $caddyExecutable `
            -ArgumentList $arguments `
            -WorkingDirectory $projectRoot `
            -WindowStyle Normal `
            -PassThru

        Start-Sleep -Seconds 2
        $process.Refresh()
        if ($process.HasExited) {
            throw "Caddy exited immediately with code $($process.ExitCode). Check whether TCP port 443 is already in use."
        }

        Write-Host "Caddy started in a separate window for https://$siteHost/"
    }

    Export-CaddyRootCertificate
    if (Test-Path -LiteralPath $exportedRootCertificate) {
        $rootCertificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2($exportedRootCertificate)
        $isTrusted = @(
            Get-ChildItem -Path 'Cert:\CurrentUser\Root' -ErrorAction SilentlyContinue
            Get-ChildItem -Path 'Cert:\LocalMachine\Root' -ErrorAction SilentlyContinue
        ) | Where-Object { $_.Thumbprint -eq $rootCertificate.Thumbprint } | Select-Object -First 1

        if ($null -ne $isTrusted) {
            Start-Process -FilePath "https://$siteHost/"
        }
        else {
            $certificateHash = (Get-FileHash -LiteralPath $exportedRootCertificate -Algorithm SHA256).Hash
            Write-Warning 'The Caddy root CA is not trusted on this computer, so the browser was not opened.'
            Write-Host "Run: scripts\caddy\install-root-ca.cmd `"$exportedRootCertificate`" $certificateHash"
            Write-Host 'Then run scripts\caddy\start.cmd again.'
        }
    }

    Write-Host 'To stop Caddy, close its window or press Ctrl+C in that window.'
    Write-Host 'On each client, pass the copied root.crt path and the server-displayed SHA-256 to install-root-ca.cmd.'
}

function Install-RootCertificate {
    $certificateFile = $exportedRootCertificate
    if (-not [string]::IsNullOrWhiteSpace($CertificatePath)) {
        $certificateFile = [System.IO.Path]::GetFullPath($CertificatePath)
    }

    if (-not (Test-Path -LiteralPath $certificateFile)) {
        throw "Root certificate not found: $certificateFile"
    }

    if (-not (Test-Administrator)) {
        $elevatedExitCode = Invoke-ElevatedAction `
            -ElevatedAction 'InstallRootCertificate' `
            -ElevatedCertificatePath $certificateFile `
            -ElevatedExpectedSha256 $ExpectedSha256
        exit $elevatedExitCode
    }

    $normalizedExpectedHash = ''
    if (-not [string]::IsNullOrWhiteSpace($ExpectedSha256)) {
        $normalizedExpectedHash = ($ExpectedSha256 -replace '\s', '').ToUpperInvariant()
    }
    if ([string]::IsNullOrWhiteSpace($normalizedExpectedHash)) {
        $normalizedExpectedHash = ((Read-Host 'Expected SHA-256 shown by the Caddy server') -replace '\s', '').ToUpperInvariant()
    }
    if ($normalizedExpectedHash -notmatch '^[0-9A-F]{64}$') {
        throw 'Expected SHA-256 must contain exactly 64 hexadecimal characters.'
    }

    $actualHash = (Get-FileHash -LiteralPath $certificateFile -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($actualHash -cne $normalizedExpectedHash) {
        throw "SHA-256 mismatch. Expected $normalizedExpectedHash, got $actualHash."
    }

    $certificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2($certificateFile)
    if ($certificate.HasPrivateKey) {
        throw 'The file unexpectedly contains a private key.'
    }
    if ($certificate.Subject -cne $certificate.Issuer) {
        throw 'The certificate is not self-issued.'
    }

    $basicConstraintsExtension = $certificate.Extensions |
        Where-Object { $_.Oid.Value -eq '2.5.29.19' } |
        Select-Object -First 1
    if ($null -eq $basicConstraintsExtension) {
        throw 'The certificate has no Basic Constraints extension.'
    }
    $basicConstraints = New-Object Security.Cryptography.X509Certificates.X509BasicConstraintsExtension
    $basicConstraints.CopyFrom($basicConstraintsExtension)
    if (-not $basicConstraints.CertificateAuthority) {
        throw 'The selected certificate is not a CA certificate.'
    }

    $keyUsageExtension = $certificate.Extensions |
        Where-Object { $_.Oid.Value -eq '2.5.29.15' } |
        Select-Object -First 1
    if ($null -eq $keyUsageExtension) {
        throw 'The certificate has no Key Usage extension.'
    }
    $keyUsage = New-Object Security.Cryptography.X509Certificates.X509KeyUsageExtension
    $keyUsage.CopyFrom($keyUsageExtension)
    if (($keyUsage.KeyUsages -band [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign) -eq 0) {
        throw 'The certificate is not allowed to sign certificates.'
    }

    Write-Host "Subject: $($certificate.Subject)"
    Write-Host "Issuer:  $($certificate.Issuer)"
    Write-Host "SHA-256: $actualHash"
    $confirmation = Read-Host 'Type TRUST to install this CA into LocalMachine\Root'
    if ($confirmation -cne 'TRUST') {
        throw 'Certificate installation was cancelled.'
    }

    $imported = Import-Certificate `
        -FilePath $certificateFile `
        -CertStoreLocation 'Cert:\LocalMachine\Root'

    Write-Host "Caddy root certificate installed. Thumbprint: $($imported.Thumbprint)"
}

try {
    switch ($Action) {
        'Install' { Install-Caddy }
        'Configure' { Configure-Caddy }
        'ConfigureFirewall' { Configure-CaddyFirewall }
        'Start' { Start-Caddy }
        'InstallRootCertificate' { Install-RootCertificate }
    }
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
