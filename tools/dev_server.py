#!/usr/bin/env python3
"""
Local preview server for V2 (no PHP needed).

    python tools/dev_server.py [port]

- Serves public_html/ with the same security headers as .htaccess (incl. CSP),
  so CSP violations show up in the browser console during development.
- Mocks csrf.php and send_lead.php so the form flow can be tested:
    message containing "fail"  -> server error response
    message containing "slow"  -> 2 s delay
    otherwise                   -> success
Development only. Never deploy this file.
"""
import json
import secrets
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

ROOT = Path(__file__).resolve().parent.parent / "public_html"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

CSP = ("default-src 'self'; script-src 'self'; style-src 'self' https://fonts.bunny.net; "
       "font-src 'self' https://fonts.bunny.net; img-src 'self' data:; connect-src 'self'; "
       "form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'")

TOKENS = set()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def end_headers(self):
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path.endswith("/csrf.php"):
            tok = secrets.token_hex(32)
            TOKENS.add(tok)
            return self._json(200, {"token": tok})
        if path.endswith(".php"):
            return self._json(405, {"status": "error", "message": "Method not allowed."})
        if (ROOT / path.lstrip("/")).is_dir() or (ROOT / path.lstrip("/")).exists():
            return super().do_GET()
        # emulate ErrorDocument 404
        self.send_response(404)
        body = (ROOT / "404.html").read_bytes() if (ROOT / "404.html").exists() else b"Not found"
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not self.path.split("?")[0].endswith("/send_lead.php"):
            return self._json(404, {"status": "error"})
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        ctype = self.headers.get("Content-Type", "")
        fields = {}
        if "multipart/form-data" in ctype:
            boundary = ctype.split("boundary=")[1].encode()
            for part in raw.split(b"--" + boundary):
                if b'name="' in part:
                    head, _, val = part.partition(b"\r\n\r\n")
                    name = head.split(b'name="')[1].split(b'"')[0].decode()
                    fields[name] = val.rstrip(b"\r\n").decode("utf-8", "replace")
        else:
            fields = {k: v[0] for k, v in parse_qs(raw.decode()).items()}
        msg = fields.get("message", "")
        if fields.get("csrf") not in TOKENS:
            return self._json(403, {"status": "error", "code": "csrf", "message": "Session expired. Please submit the form again."})
        if fields.get("website"):
            return self._json(200, {"status": "success"})
        if "slow" in msg:
            time.sleep(2)
        if "fail" in msg:
            return self._json(500, {"status": "error", "message": "Mock: mail server failure."})
        TOKENS.discard(fields.get("csrf"))
        print("  [mock] lead:", {k: v for k, v in fields.items() if k not in ("csrf",)})
        return self._json(200, {"status": "success", "message": "Thank you."})


if __name__ == "__main__":
    print(f"Serving {ROOT} on http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
