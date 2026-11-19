param(
  [int]$Port = 8019
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$MimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$Listener.Start()

Write-Host "Mens Day Card server listening at http://localhost:$Port/"

try {
  while ($true) {
    $Client = $Listener.AcceptTcpClient()
    try {
      $Stream = $Client.GetStream()
      $Reader = [System.IO.StreamReader]::new($Stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
      $RequestLine = $Reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($RequestLine)) {
        $Client.Close()
        continue
      }
      # Drain headers
      while ($true) {
        $Line = $Reader.ReadLine()
        if ([string]::IsNullOrEmpty($Line)) { break }
      }

      $Parts = $RequestLine.Split(' ')
      $RawTarget = if ($Parts.Length -ge 2) { $Parts[1] } else { '/' }
      $UrlPath = $RawTarget.Split('?')[0]
      $UrlPath = [System.Uri]::UnescapeDataString($UrlPath)
      if ($UrlPath -eq '/' -or [string]::IsNullOrEmpty($UrlPath)) {
        $UrlPath = '/index.html'
      }

      $RelPath = $UrlPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      $FullPath = [System.IO.Path]::GetFullPath((Join-Path $Root $RelPath))
      $RootFull = [System.IO.Path]::GetFullPath($Root)

      if (-not $FullPath.StartsWith($RootFull, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $FullPath -PathType Leaf)) {
        $NotFoundBody = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
        $Header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($NotFoundBody.Length)`r`nConnection: close`r`n`r`n"
        $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
        $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
        $Stream.Write($NotFoundBody, 0, $NotFoundBody.Length)
      } else {
        $Ext = [System.IO.Path]::GetExtension($FullPath).ToLowerInvariant()
        $ContentType = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { 'application/octet-stream' }
        $Body = [System.IO.File]::ReadAllBytes($FullPath)
        $Header = "HTTP/1.1 200 OK`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
        $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
        $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
        $Stream.Write($Body, 0, $Body.Length)
      }
      $Stream.Flush()
    } catch {
      # Ignore transient client disconnect
    } finally {
      $Client.Close()
    }
  }
} finally {
  $Listener.Stop()
}
