# Printer simulator: an Epson receipt printer, without the printer

Behaves as an Epson TM printer (a TM-m30III) on your network, with Epson's
own protocols - nothing of ours - so Arcanum can't tell it from the real
thing, and swapping in a real printer is a settings change only.

```sh
node tools/printer-sim/server.mjs            # https://<this Mac>:8043/
```

Open the address it prints and accept its certificate once (it's
self-signed, as a real printer's is). That page shows:

- **Push** - where screens send to: host and port (put these in the
  console), the endpoint `/cgi-bin/epos/service.cgi`, device id
  `local_printer`. Always on.
- **Polling** - the URL to ask for work (the console gives it, with its
  secret), an optional ID + password (HTTP Digest, used only when the server
  asks), the interval. Off until you set a URL.
- **Printer** - paper width (80 / 58 mm), the device id, and **Paper out**:
  every job is then refused with `EPTR_REC_EMPTY`, as a real printer does.
- **Activity** - every push, every poll (a run of empty ones is one line
  that counts up), every report, every error.
- **Printed** - each ticket as a receipt, newest first; click one to look
  back, Older / Newer to browse, "Show new tickets" to follow along.

Settings and tickets are kept in `~/.arcanum-printer-sim` (`--data` for
another folder, e.g. one per simulated printer with its own `--port`).

## Options

| | |
|---|---|
| `--port 8043` | the port (a real printer: 443) |
| `--data DIR` | settings, certificate, tickets |
| `--poll-url URL` | start polling at once |
| `--id ID --password PW` | Digest credentials for polling |
| `--interval S` | seconds between polls |
| `--cert F --key F` | your own certificate, e.g. from `mkcert` (then the browser trusts it without a warning) |

## What it speaks

The formats are checked against Epson's manuals - see PRINTING.md
(arcanum/), "Epson protocols (checked)":

- **ePOS-Print** (push): `POST /cgi-bin/epos/service.cgi?devid=…&timeout=…`,
  a SOAP envelope with `<epos-print>`; answers `<response success=… code=…
  status=…/>`. Device id from the query or the SOAP header. Epson's CORS
  headers, no login.
- **Server Direct Print** (polling): posts `ConnectionType=GetRequest&ID=…`,
  takes an empty answer as "nothing" or a `<PrintRequestInfo>` (1.00 / 2.00
  with job ids), prints, posts `ConnectionType=SetResponse` with
  `<PrintResponseInfo>` in the same version. Waits the interval after each
  exchange.

The preview draws text (align, Font A/B, width/height, bold, underline,
reverse), feeds, cuts and lines; QR codes, barcodes and images show as a
labelled box.

## Swapping in a real printer

- **Push:** in the console, the printer's host becomes the real printer's
  IP (port 443). Open `https://<printer-ip>/` once in each screen's browser
  to accept its certificate.
- **Polling:** in the printer's WebConfig (Server Direct Print), enter the
  same URL, ID and password the simulator used, and the interval.
