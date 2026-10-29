import { describe, expect, it } from 'vitest'
import { detectPlatform, trustCommand } from './printer-trust-commands'

const SAY = {
  trusted: 'Klaar: deze computer vertrouwt de printer nu.',
  noCertutil: (f: string) => `certutil ontbreekt - importeer ${f}`,
}
const TARGET = {
  host: '192.168.1.50',
  port: 443,
  uploadUrl: 'https://arcanum.test/api/public/print/cert/pr-1?code=abc',
}

describe('detectPlatform', () => {
  it('tells an iPad (which says Macintosh) from a Mac by its touch screen', () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
    expect(detectPlatform({ userAgent: mac, maxTouchPoints: 0 })).toBe('mac')
    expect(detectPlatform({ userAgent: mac, maxTouchPoints: 5 })).toBe('ios')
    expect(
      detectPlatform({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      })
    ).toBe('ios')
    expect(
      detectPlatform({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0',
      })
    ).toBe('windows')
    expect(
      detectPlatform({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0',
      })
    ).toBe('linux')
    expect(
      detectPlatform({
        userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/130.0',
      })
    ).toBe('linux')
  })
})

describe('trustCommand', () => {
  it('Mac: reads the certificate, uploads it, then trusts it in the login keychain - no sudo', () => {
    const c = trustCommand('mac', TARGET, SAY)
    expect(c).toContain(`openssl s_client -connect '192.168.1.50:443' </dev/null 2>/dev/null | openssl x509 > "$TMPDIR/arcanum-printer.pem"`)
    expect(c).not.toContain('-servername')
    expect(c.indexOf('curl')).toBeLessThan(c.indexOf('security add-trusted-cert'))
    expect(c).toContain(`--data-binary @"$TMPDIR/arcanum-printer.pem" 'https://arcanum.test/api/public/print/cert/pr-1?code=abc'`)
    expect(c).toContain('security add-trusted-cert -r trustRoot -k ~/Library/Keychains/login.keychain-db')
    expect(c).not.toContain('sudo')
    // One line, each step only after the one before worked.
    expect(c).not.toContain('\n')
    expect(c.split(' && ').length).toBeGreaterThanOrEqual(4)
  })

  it('Windows: PowerShell reads the certificate itself, uploads it, trusts it for this user', () => {
    const c = trustCommand('windows', { ...TARGET, port: 8043 }, SAY)
    expect(c.startsWith('& {')).toBe(true)
    expect(c).toContain("New-Object Net.Sockets.TcpClient('192.168.1.50', 8043)")
    expect(c).toContain("Invoke-RestMethod -Method Post -Uri 'https://arcanum.test/api/public/print/cert/pr-1?code=abc'")
    expect(c).toContain('Import-Certificate -FilePath $f -CertStoreLocation Cert:\\CurrentUser\\Root')
    expect(c.indexOf('Invoke-RestMethod')).toBeLessThan(c.indexOf('Import-Certificate'))
    expect(c).toContain("Write-Host 'Klaar: deze computer vertrouwt de printer nu.'")
  })

  it("Linux: Chrome's own store when certutil is there, else says how", () => {
    const c = trustCommand('linux', { ...TARGET, host: 'printer.local' }, SAY)
    expect(c).toContain("-connect 'printer.local:443' -servername 'printer.local'")
    expect(c).toContain("certutil -d sql:$HOME/.pki/nssdb -A -t 'C,,' -n 'Arcanum printer printer.local'")
    expect(c).toContain("echo 'certutil ontbreekt - importeer /tmp/arcanum-printer.pem'")
  })

  it('quotes what it puts in the command', () => {
    expect(trustCommand('mac', { ...TARGET, uploadUrl: "https://x/'; rm -rf ~; '" }, SAY)).toContain(`'https://x/'\\''; rm -rf ~; '\\'''`)
    expect(trustCommand('windows', { ...TARGET, uploadUrl: "https://x/'; evil" }, SAY)).toContain(`'https://x/''; evil'`)
    expect(trustCommand('mac', { ...TARGET, host: 'fe80::1' }, SAY)).toContain(`-connect '[fe80::1]:443'`)
  })
})
