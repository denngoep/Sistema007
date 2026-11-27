# Starts Nest against the isolated functional-test database without changing .env.
function Get-ListeningPort([int]$Port) {
  $portPattern = [regex]::Escape(":$Port")
  return netstat -ano |
    Where-Object { $_ -match "^\s*TCP\s+\S+$portPattern\s+\S+\s+LISTENING\s+\d+\s*$" } |
    Select-Object -First 1
}

$testConfig = @{}
Get-Content "$PSScriptRoot\.env" | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') {
    $value = $matches[2].Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $testConfig[$matches[1]] = $value
  }
}

$env:DATABASE_NAME = 'sistema007_funcional_pruebas'
$env:DATABASE_URL = $testConfig['DATABASE_URL'] -replace '/sistema007(?=\?|$)', '/sistema007_funcional_pruebas'
$env:INVENTORY_DOCUMENTS_ENABLED = 'true'
if (-not $env:INVENTORY_DOCUMENT_ROOT) {
  $env:INVENTORY_DOCUMENT_ROOT = Join-Path $PSScriptRoot 'private-inventory-documents-test'
}

if ($env:DATABASE_URL -notmatch '/sistema007_funcional_pruebas(?:\?|$)') {
  throw 'No fue posible seleccionar la base de pruebas aislada.'
}

$port = if ($testConfig.ContainsKey('PORT') -and $testConfig['PORT']) { [int]$testConfig['PORT'] } else { 3000 }
$listener = Get-ListeningPort $port
if ($listener) {
  Write-Error "No se inicio el modo de pruebas: el puerto $port esta en uso. Cierra la instancia actual del backend y vuelve a ejecutar npm run start:test."
  exit 1
}

Write-Host "Sistema 007: iniciando PRUEBAS FUNCIONALES con la base aislada sistema007_funcional_pruebas en el puerto $port."
Write-Host 'Documentos de inventario: habilitados con almacenamiento privado de pruebas.'
& npm.cmd run start:dev
exit $LASTEXITCODE
