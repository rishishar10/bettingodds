# Serves out/ on localhost with caching off, so a reload always shows the latest build.
#   python3 scripts/serve.py [port]
import functools
import http.server
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "out")


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
handler = functools.partial(NoCache, directory=ROOT)
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
