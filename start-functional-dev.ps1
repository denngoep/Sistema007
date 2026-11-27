# Starts the complete local functional-test environment. It intentionally uses
# backend/start:test, whose database guard only accepts the isolated copy.
function Get-ListeningPort([int]$Port) {
  $portPattern = [regex]::Escape(":$Port")
  return netstat -ano |
    Where-Object { $_ -match "^\s*TCP\s+\S+$portPattern\s+\S+\s+LISTENING\s+\d+\s*$" } |
    Select-Object -First 1
}

$backendPort = 3000
$frontendPort = 5173

foreach ($port in @($backendPort, $frontendPort)) {
  $listener = Get-ListeningPort $port
  if ($listener) {
    Write-Error "No se inició Sistema 007: el puerto $port está en uso. Cierra la instancia actual y vuelve a ejecutar npm run dev:test."
    exit 1
  }
}

$root = $PSScriptRoot
Write-Host 'Sistema 007: iniciando PRUEBAS FUNCIONALES.'
Write-Host 'Base: sistema007_funcional_pruebas | Backend: http://localhost:3000 | Frontend: http://localhost:5173'
$env:VITE_INVENTORY_DOCUMENTS_ENABLED = 'true'
$env:INVENTORY_DOCUMENTS_ENABLED = 'true'
$env:INVENTORY_DOCUMENT_ROOT = Join-Path $root 'backend\private-inventory-documents-test'

$frontend = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev', '--', '--host', 'localhost', '--port', '5173', '--strictPort') -WorkingDirectory (Join-Path $root 'fronted') -PassThru -NoNewWindow

try {
  $frontendDeadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Seconds 1
    $frontend.Refresh()
    $frontendListening = Get-ListeningPort $frontendPort
  } while (!$frontend.HasExited -and !$frontendListening -and (Get-Date) -lt $frontendDeadline)

  if ($frontend.HasExited -or !$frontendListening) {
    throw 'El frontend no quedo disponible en el puerto 5173. Revisa el mensaje anterior antes de continuar.'
  }

  # Run Nest in this console instead of as another detached watcher. Ctrl+C is
  # therefore delivered to Nest normally; finally only cleans this script's
  # Vite child process tree.
  Push-Location (Join-Path $root 'backend')
  try {
    & npm.cmd run start:test
    $backendExitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }

  if ($backendExitCode -ne 0) {
    Write-Error "El backend de pruebas finalizo con codigo $backendExitCode."
  }
} finally {
  if ($frontend -and !$frontend.HasExited) {
    # npm.cmd may have a nested Vite process. Terminate only this launcher's
    # own process tree so Ctrl+C does not leave a development server behind.
    & taskkill.exe /PID $frontend.Id /T /F *> $null
  }
}
