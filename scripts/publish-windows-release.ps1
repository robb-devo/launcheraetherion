param(
  [string]$Version = "",
  [string]$Owner = "washryan",
  [string]$Repo = "launcheraetherion",
  [string]$InstallerPath = "",
  [string]$ReleaseBody = "Aetherion Launcher Windows build."
)

$ErrorActionPreference = "Stop"

if (-not $Version) {
  $packageJson = Get-Content (Join-Path (Get-Location) "package.json") -Raw | ConvertFrom-Json
  $Version = $packageJson.version
  if (-not $Version) {
    throw "package.json nao tem version. Passe -Version explicitamente."
  }
}

if (-not $env:GITHUB_TOKEN) {
  throw "Defina GITHUB_TOKEN com permissao de Contents: Read and write antes de publicar."
}

$tag = "v$Version"
if (-not $InstallerPath) {
  $InstallerPath = Join-Path (Get-Location) "dist\Aetherion.Launcher.Setup.$Version.exe"
}

if (-not (Test-Path $InstallerPath)) {
  throw "Instalador nao encontrado: $InstallerPath. Rode pnpm build:win primeiro."
}

$installer = Get-Item $InstallerPath
$headers = @{
  Authorization = "Bearer $env:GITHUB_TOKEN"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

function Invoke-GitHubJson {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body = $null
  )

  $options = @{
    Method = $Method
    Uri = $Uri
    Headers = $headers
  }
  if ($null -ne $Body) {
    $options.ContentType = "application/json"
    $options.Body = ($Body | ConvertTo-Json -Depth 20)
  }

  Invoke-RestMethod @options
}

$release = $null
try {
  $release = Invoke-GitHubJson -Method Get -Uri "https://api.github.com/repos/$Owner/$Repo/releases/tags/$tag"
  Write-Host "Release existente: $tag"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -ne 404) {
    throw
  }

  Write-Host "Criando release: $tag"
  $release = Invoke-GitHubJson -Method Post -Uri "https://api.github.com/repos/$Owner/$Repo/releases" -Body @{
    tag_name = $tag
    name = "Aetherion Launcher $Version"
    body = $ReleaseBody
    draft = $false
    prerelease = $false
    make_latest = "true"
  }
}

Write-Host "Marking $tag as the latest GitHub release"
$release = Invoke-GitHubJson -Method Patch -Uri "https://api.github.com/repos/$Owner/$Repo/releases/$($release.id)" -Body @{
  make_latest = "true"
}

$distDir = Join-Path (Get-Location) "dist"
$blockmap = Get-Item "$($installer.FullName).blockmap" -ErrorAction SilentlyContinue
$latestYml = Join-Path $distDir "latest.yml"
if (-not (Test-Path $latestYml)) {
  throw "latest.yml was not found in dist. electron-builder must generate it so installed launchers can update."
}
$assetsToUpload = @($installer.FullName)
if ($blockmap) { $assetsToUpload += $blockmap.FullName }
if (Test-Path $latestYml) { $assetsToUpload += $latestYml }

$uploadUrl = $release.upload_url -replace "\{\?name,label\}", ""

foreach ($assetPath in $assetsToUpload) {
  $asset = Get-Item $assetPath
  $existingAsset = $release.assets | Where-Object { $_.name -eq $asset.Name } | Select-Object -First 1
  if ($existingAsset) {
    Write-Host "Removing previous asset: $($asset.Name)"
    Invoke-GitHubJson -Method Delete -Uri "https://api.github.com/repos/$Owner/$Repo/releases/assets/$($existingAsset.id)" | Out-Null
  }

  $encodedName = [uri]::EscapeDataString($asset.Name)
  $target = "$uploadUrl`?name=$encodedName"
  Write-Host "Uploading asset: $($asset.Name) ($($asset.Length) bytes)"
  Invoke-WebRequest `
    -Method Post `
    -Uri $target `
    -Headers $headers `
    -ContentType "application/octet-stream" `
    -InFile $asset.FullName | Out-Null
  Write-Host "Published: https://github.com/$Owner/$Repo/releases/download/$tag/$encodedName"
}
