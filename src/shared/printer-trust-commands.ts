// Trusting a push printer (arcanum/PRINTING.md, "Trusting a push printer"):
// the command a screen shows for a computer on the printer's network. One
// paste: read the printer's own certificate, upload it to Arcanum with a
// one-time code (so an iPad can get it as a profile), then trust it on this
// computer - no admin rights: macOS's login keychain, Windows' CurrentUser
// store, Chrome's own store on Linux. An iPad can't run a command: it
// downloads the uploaded certificate as a profile instead.

export type TrustPlatform = 'ios' | 'mac' | 'windows' | 'linux'

// iPadOS reports itself as a Mac; a touch screen tells them apart.
export function detectPlatform(nav: { userAgent: string; platform?: string; maxTouchPoints?: number }): TrustPlatform {
  const ua = nav.userAgent
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1)) return 'ios'
  if (/Windows/.test(ua)) return 'windows'
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac'
  return 'linux'
}

export interface TrustTarget {
  host: string
  port: number
  // Where the command uploads the certificate (with its one-time code).
  uploadUrl: string
}

// What the command says at the end, in the screen's language.
export interface TrustSay {
  trusted: string
  noCertutil: (file: string) => string
}

const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
const ps = (s: string) => `'${s.replace(/'/g, "''")}'`
const isIp = (host: string) => /^[\d.]+$/.test(host) || host.includes(':')
// openssl wants an IPv6 address in brackets.
const hostPort = (t: TrustTarget) => `${t.host.includes(':') && !t.host.startsWith('[') ? `[${t.host}]` : t.host}:${t.port}`

export function trustCommand(platform: Exclude<TrustPlatform, 'ios'>, t: TrustTarget, say: TrustSay): string {
  if (platform === 'windows') {
    const host = t.host.replace(/^\[|\]$/g, '')
    return [
      '& {',
      "$ErrorActionPreference = 'Stop'",
      `$c = New-Object Net.Sockets.TcpClient(${ps(host)}, ${t.port})`,
      '$s = New-Object Net.Security.SslStream($c.GetStream(), $false, { $true })',
      `$s.AuthenticateAsClient(${ps(host)})`,
      "$der = $s.RemoteCertificate.Export('Cert'); $c.Close()",
      '$f = Join-Path $env:TEMP arcanum-printer.cer; [IO.File]::WriteAllBytes($f, $der)',
      `Invoke-RestMethod -Method Post -Uri ${ps(t.uploadUrl)} -ContentType 'application/x-pem-file' -Body ([Convert]::ToBase64String($der))`,
      'Import-Certificate -FilePath $f -CertStoreLocation Cert:\\CurrentUser\\Root | Out-Null',
      `Write-Host ${ps(say.trusted)}`,
      '}',
    ].join('\n')
  }
  const file = platform === 'mac' ? '"$TMPDIR/arcanum-printer.pem"' : '/tmp/arcanum-printer.pem'
  const fetch = `openssl s_client -connect ${sh(hostPort(t))}${isIp(t.host) ? '' : ` -servername ${sh(t.host)}`} </dev/null 2>/dev/null | openssl x509 > ${file}`
  const upload = `curl -sS --fail-with-body -H 'Content-Type: application/x-pem-file' --data-binary @${file} ${sh(t.uploadUrl)}`
  const trust =
    platform === 'mac'
      ? `security add-trusted-cert -r trustRoot -k ~/Library/Keychains/login.keychain-db ${file} && echo ${sh(say.trusted)}`
      : `if command -v certutil >/dev/null; then mkdir -p ~/.pki/nssdb && { [ -f ~/.pki/nssdb/cert9.db ] || certutil -d sql:$HOME/.pki/nssdb -N --empty-password; } && certutil -d sql:$HOME/.pki/nssdb -A -t 'C,,' -n ${sh(`Arcanum printer ${t.host}`)} -i ${file} && echo ${sh(say.trusted)}; else echo ${sh(say.noCertutil('/tmp/arcanum-printer.pem'))}; fi`
  return `${fetch} && ${upload} && ${trust}`
}
