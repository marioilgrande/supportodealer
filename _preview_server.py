import http.server, socketserver
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.endswith('.html') or self.path == '/':
            self.send_header('Content-Type', 'text/html; charset=utf-8')
        super().end_headers()
    def guess_type(self, path):
        if path.endswith('.html'):
            return 'text/html; charset=utf-8'
        return super().guess_type(path)
with socketserver.TCPServer(("127.0.0.1", 8735), H) as httpd:
    httpd.serve_forever()
