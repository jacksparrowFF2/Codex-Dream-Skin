[CmdletBinding()]
param(
  [int]$Port = 9335,
  [switch]$NoRelaunch,
  [Parameter(DontShow = $true)][switch]$DeployApproved,
  [Parameter(DontShow = $true)][string]$ApprovalToken
)

$ErrorActionPreference = 'Stop'
$PortExplicit = $PSBoundParameters.ContainsKey('Port')
$SkillRoot = Split-Path -Parent $PSScriptRoot
$Injector = Join-Path $PSScriptRoot 'injector.mjs'
. (Join-Path $PSScriptRoot 'common-windows.ps1')
. (Join-Path $PSScriptRoot 'theme-windows.ps1')

function Write-DreamSkinDeploymentLog {
  param([Parameter(Mandatory = $true)][string]$Message)
  $logPath = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin\deploy-update.log'
  try {
    Write-DreamSkinUtf8FileAtomically -Path $logPath -Content ("[{0:u}] {1}`r`n" -f (Get-Date), $Message)
  } catch {}
}

function Start-DreamSkinInstalledRuntime {
  param([int]$RuntimePort)
  $stateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
  $engine = Get-DreamSkinRuntimeEnginePaths -StateRoot $stateRoot
  if (-not (Test-Path -LiteralPath $engine.Start -PathType Leaf)) {
    throw 'The installed Dream Skin start script is missing after deployment.'
  }
  $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
  $arguments = @(
    '-NoProfile', '-ExecutionPolicy', 'RemoteSigned',
    '-File', $engine.Start, '-Port', "$RuntimePort"
  )
  $argumentLine = ConvertTo-DreamSkinArgumentLine -Arguments $arguments
  Start-Process -FilePath $powershell -ArgumentList $argumentLine -WindowStyle Hidden | Out-Null
}

function Invoke-DreamSkinApprovedDeployment {
  param([int]$RuntimePort, [switch]$SkipRelaunch)
  $stateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
  $paths = Get-DreamSkinThemePaths -StateRoot $stateRoot
  $state = Read-DreamSkinState -Path $paths.State
  $codex = Get-DreamSkinCodexInstallFromState -State $state
  if ($null -eq $codex) { $codex = Get-DreamSkinCodexInstall }

  try {
    Stop-DreamSkinTrayProcess
    $trayDeadline = (Get-Date).AddSeconds(5)
    while ((Test-DreamSkinTrayActive) -and (Get-Date) -lt $trayDeadline) {
      Start-Sleep -Milliseconds 200
    }
    if (Test-DreamSkinTrayActive) {
      throw 'The Dream Skin tray did not exit; deployment was cancelled before replacing the runtime.'
    }

    if ($null -ne $state -and -not (Stop-DreamSkinRecordedInjector -State $state)) {
      throw 'The recorded Dream Skin injector could not be stopped safely.'
    }
    Stop-DreamSkinCodex -Codex $codex -AllowForce

    $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
    $installer = Join-Path $PSScriptRoot 'install-dream-skin.ps1'
    $installResult = Invoke-DreamSkinNative -FilePath $powershell -ArgumentList @(
      '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', $installer, '-Port', "$RuntimePort"
    )
    if ($installResult.ExitCode -ne 0) {
      throw "Dream Skin installation failed:`n$($installResult.Output -join "`n")"
    }

    Write-DreamSkinDeploymentLog -Message 'Preview was approved and the managed runtime was updated successfully.'
    if (-not $SkipRelaunch) {
      Start-DreamSkinInstalledRuntime -RuntimePort $RuntimePort
    }
  } catch {
    Write-DreamSkinDeploymentLog -Message "Deployment failed: $($_.Exception.Message)"
    if ((Get-DreamSkinCodexProcesses -Codex $codex).Count -eq 0) {
      try { $null = Start-DreamSkinCodex -Codex $codex } catch {}
    }
    try {
      $shell = New-Object -ComObject WScript.Shell
      $null = $shell.Popup(
        "Dream Skin deployment failed. Codex was reopened when possible.`n`n$($_.Exception.Message)",
        0, 'Codex Dream Skin', 16
      )
    } catch {}
    throw
  }
}

$stateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$themePaths = Get-DreamSkinThemePaths -StateRoot $stateRoot

if ($DeployApproved) {
  if ($ApprovalToken -notmatch '\A[0-9a-f]{32}\z') {
    throw 'The deployment approval token is invalid.'
  }
  $approvalPath = Join-Path $themePaths.Root "deploy-approval-$ApprovalToken.json"
  if (-not (Test-DreamSkinThemePathWithin -Path $approvalPath -Root $themePaths.Root) -or
    -not (Test-Path -LiteralPath $approvalPath -PathType Leaf)) {
    throw 'The deployment approval file is missing or outside the managed state root.'
  }
  try {
    $approval = Read-DreamSkinUtf8File -Path $approvalPath | ConvertFrom-Json -ErrorAction Stop
    $expectedRoot = [System.IO.Path]::GetFullPath($SkillRoot)
    if (-not (Test-DreamSkinPathEqual -Left "$($approval.sourceRoot)" -Right $expectedRoot) -or
      "$($approval.token)" -cne $ApprovalToken) {
      throw 'The deployment approval does not match this source checkout.'
    }
    $createdAt = [DateTimeOffset]::Parse("$($approval.createdAt)")
    $age = [DateTimeOffset]::UtcNow - $createdAt.ToUniversalTime()
    if ($age.TotalSeconds -lt 0 -or $age.TotalMinutes -gt 5) {
      throw 'The deployment approval has expired.'
    }
  } finally {
    Remove-Item -LiteralPath $approvalPath -Force -ErrorAction SilentlyContinue
  }
  Invoke-DreamSkinApprovedDeployment -RuntimePort $Port -SkipRelaunch:$NoRelaunch
  exit 0
}

$session = Get-DreamSkinLiveSessionContext -StateRoot $stateRoot
if ($null -eq $session) {
  throw 'No verified live Dream Skin session was found. Start Codex from the Dream Skin shortcut, then retry.'
}
if (-not $PortExplicit) { $Port = $session.Port }
Assert-DreamSkinPort -Port $Port
if ($Port -ne $session.Port) {
  throw "The requested port $Port does not match the verified live session on port $($session.Port)."
}

$previewResult = Invoke-DreamSkinNative -FilePath $session.NodePath -ArgumentList @(
  $Injector, '--once', '--port', "$Port",
  '--browser-id', $session.BrowserId,
  '--theme-dir', $session.Paths.Active,
  '--timeout-ms', '30000'
)
if ($previewResult.ExitCode -ne 0) {
  throw "Hot preview failed:`n$($previewResult.Output -join "`n")"
}
$previewResult.Output | ForEach-Object { Write-Host $_ }
Write-Host 'Hot preview applied. Inspect the home view, task view, sidebar states, and composer before approving.'

$approved = Confirm-DreamSkinRestart -Message @'
The hot preview is active.

If the appearance is correct, choose Yes to close Codex and the Dream Skin tray, update the managed runtime, and relaunch Codex automatically.

Unsaved composer input may be lost. Choose No to keep previewing without installing.
'@
if (-not $approved) {
  Write-Host 'Preview remains active for this session; the managed runtime was not changed.'
  exit 0
}

Ensure-DreamSkinManagedDirectory -Path $themePaths.Root -Root $themePaths.Root
$token = [Guid]::NewGuid().ToString('N')
$approvalPath = Join-Path $themePaths.Root "deploy-approval-$token.json"
$approval = [ordered]@{
  token = $token
  sourceRoot = [System.IO.Path]::GetFullPath($SkillRoot)
  createdAt = [DateTimeOffset]::UtcNow.ToString('o')
}
Write-DreamSkinUtf8FileAtomically -Path $approvalPath -Content (($approval | ConvertTo-Json -Depth 3) + "`r`n")

$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$helperArguments = @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass',
  '-File', $PSCommandPath,
  '-DeployApproved', '-ApprovalToken', $token,
  '-Port', "$Port"
)
if ($NoRelaunch) { $helperArguments += '-NoRelaunch' }
$helperLine = ConvertTo-DreamSkinArgumentLine -Arguments $helperArguments
try {
  Start-Process -FilePath $powershell -ArgumentList $helperLine -WindowStyle Hidden | Out-Null
} catch {
  Remove-Item -LiteralPath $approvalPath -Force -ErrorAction SilentlyContinue
  throw
}
Write-Host 'Deployment helper started. Codex will close and reopen automatically.'
