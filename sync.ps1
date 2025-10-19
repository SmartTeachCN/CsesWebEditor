$script = Join-Path $PSScriptRoot "sync.js"
if (!(Test-Path $script)) {
  Write-Host "[ERROR] sync.js not found in $PSScriptRoot"
  exit 1
}
node $script $args