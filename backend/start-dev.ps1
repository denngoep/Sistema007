# Keep compilation and the HTTP process separate. Nest's default watch mode
# restarts through taskkill on Windows, which can fail under some terminals.
# Node owns its watched child and shuts it down before every restart instead.
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$watchStarted = Get-Date
$compiler = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'build:watch') -WorkingDirectory $PSScriptRoot -PassThru -NoNewWindow

try {
  # The watch compiler clears dist once when it starts. Wait for its first
  # successful emit so Node never observes a transient missing entry point.
  $entry = Join-Path $PSScriptRoot 'dist\main.js'
  $deadline = (Get-Date).AddSeconds(45)
  while ((!(Test-Path $entry) -or (Get-Item $entry).LastWriteTime -lt $watchStarted) -and (Get-Date) -lt $deadline) {
    if ($compiler.HasExited) {
      throw 'La compilación en modo watch terminó antes de generar dist/main.js.'
    }
    Start-Sleep -Milliseconds 250
  }
  if (!(Test-Path $entry)) {
    throw 'La compilación en modo watch no generó dist/main.js dentro del tiempo esperado.'
  }

  & node.exe --watch (Join-Path $PSScriptRoot 'dist\main.js')
  exit $LASTEXITCODE
} finally {
  if ($compiler -and !$compiler.HasExited) {
    Stop-Process -Id $compiler.Id -Force -ErrorAction SilentlyContinue
  }
}
