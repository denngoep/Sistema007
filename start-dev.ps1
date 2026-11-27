# Starts the normal local environment against sistema007.
# The functional-test database is selected only by npm run dev:test.
function Get-ListeningPort([int]$Port) {
  $portPattern = [regex]::Escape(":$Port")
  return netstat -ano |
    Where-Object { $_ -match "^\s*TCP\s+\S+$portPattern\s+\S+\s+LISTENING\s+\d+\s*$" } |
    Select-Object -First 1
}

$backendPort = 3000
$frontendPort = 5173
$root = $PSScriptRoot

$backendEnv = Join-Path $root 'backend\.env'
$databaseLine = Get-Content $backendEnv | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
$databaseUrl = if ($databaseLine) {
  $databaseLine.Substring('DATABASE_URL='.Length).Trim().Trim('"').Trim("'")
} else {
  ''
}
if (-not $databaseUrl -or $databaseUrl -notmatch '/sistema007(?:\?|$)' -or $databaseUrl -match 'sistema007_funcional_pruebas') {
  throw 'La configuración normal debe apuntar exclusivamente a sistema007.'
}

foreach ($port in @($backendPort, $frontendPort)) {
  $listener = Get-ListeningPort $port
  if ($listener) {
    Write-Error "No se inició Sistema 007: el puerto $port está en uso. Cierra la instancia actual y vuelve a ejecutar npm run dev."
    exit 1
  }
}

# Do not inherit a test connection from a parent shell. Nest loads backend/.env.
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_NAME -ErrorAction SilentlyContinue
$env:INVENTORY_DOCUMENTS_ENABLED = 'true'
$env:INVENTORY_DOCUMENT_ROOT = Join-Path $root 'backend\private-inventory-documents'
$env:VITE_INVENTORY_DOCUMENTS_ENABLED = 'true'

Write-Host 'Sistema 007: iniciando ENTORNO NORMAL.'
Write-Host 'Base: sistema007 | Backend: http://localhost:3000 | Frontend: http://localhost:5173'
Write-Host 'Documentos de inventario: habilitados con almacenamiento privado local.'

$frontend = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev', '--', '--host', 'localhost', '--port', '5173', '--strictPort') -WorkingDirectory (Join-Path $root 'fronted') -PassThru -NoNewWindow

try {
  $deadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Seconds 1
    $frontend.Refresh()
    $frontendListening = Get-ListeningPort $frontendPort
  } while (!$frontend.HasExited -and !$frontendListening -and (Get-Date) -lt $deadline)

  if ($frontend.HasExited -or !$frontendListening) {
    throw 'El frontend no quedó disponible en el puerto 5173. Revisa el mensaje anterior antes de continuar.'
  }

  Push-Location (Join-Path $root 'backend')
  try {
    & npm.cmd run start:dev
    $backendExitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }

  if ($backendExitCode -ne 0) {
    Write-Error "El backend normal finalizó con código $backendExitCode."
  }
} finally {
  if ($frontend -and !$frontend.HasExited) {
    & taskkill.exe /PID $frontend.Id /T /F *> $null
  }
}
