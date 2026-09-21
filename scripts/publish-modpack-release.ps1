param(
  [string]$Version = "0.4",
  [string]$Owner = "washryan",
  [string]$Repo = "launcheraetherion",
  [string]$AssetsPath = "release-v0.4-upload\\assets",
  [string]$ReleaseBody = "Aetherion modpack assets used by public/manifest.json."
)

$ErrorActionPreference = "Stop"

if (-not $env:GITHUB_TOKEN) {
  throw "Defina GITHUB_TOKEN com permissao de Contents: Read and write antes de publicar."
}

if (-not (Test-Path $AssetsPath)) {
  throw "Pasta de assets nao encontrada: $AssetsPath"
}

$tag = "v$Version"
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
    name = "Aetherion Modpack $Version"
    body = $ReleaseBody
    draft = $false
    prerelease = $false
  }
}

$files = Get-ChildItem -Path $AssetsPath -Recurse -File | Sort-Object FullName
if (-not $files) {
  throw "Nenhum arquivo encontrado em $AssetsPath"
}

$names = @{}
foreach ($file in $files) {
  if ($names.ContainsKey($file.Name)) {
    throw "Nome duplicado no pack: $($file.Name). O manifest usa nomes de assets sem pastas."
  }
  $names[$file.Name] = $true
}

Write-Host "Publicando $($files.Count) asset(s) no release $tag"

foreach ($file in $files) {
  $release = Invoke-GitHubJson -Method Get -Uri "https://api.github.com/repos/$Owner/$Repo/releases/tags/$tag"
  $existingAsset = $release.assets | Where-Object { $_.name -eq $file.Name } | Select-Object -First 1
  if ($existingAsset) {
    Write-Host "Removendo asset antigo: $($file.Name)"
    Invoke-GitHubJson -Method Delete -Uri "https://api.github.com/repos/$Owner/$Repo/releases/assets/$($existingAsset.id)" | Out-Null
  }

  $uploadUrl = $release.upload_url -replace "\{\?name,label\}", ""
  $encodedName = [uri]::EscapeDataString($file.Name)
  $target = "$uploadUrl`?name=$encodedName"

  Write-Host "Enviando: $($file.Name) ($($file.Length) bytes)"
  Invoke-WebRequest `
    -Method Post `
    -Uri $target `
    -Headers $headers `
    -ContentType "application/octet-stream" `
    -InFile $file.FullName | Out-Null
}

Write-Host "Modpack publicado: https://github.com/$Owner/$Repo/releases/tag/$tag"
