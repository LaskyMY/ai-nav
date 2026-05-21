#!/usr/bin/env python3
"""AI Nav local bridge — serves Mac status + relays CLI commands on http://localhost:9337"""
import json, subprocess, os, time, platform
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = 9337

def run(cmd, timeout=10):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return {'ok': True, 'out': r.stdout, 'err': r.stderr, 'code': r.returncode}
    except subprocess.TimeoutExpired:
        return {'ok': False, 'err': f'Command timed out after {timeout}s'}

def get_status():
    boot = run("sysctl -n kern.boottime | awk '{print $4}' | tr -d ','").get('out','').strip()
    uptime_sec = time.time() - int(boot) if boot else 0
    days, rem = divmod(int(uptime_sec), 86400)
    hours, mins = divmod(rem, 3600), divmod(rem % 3600, 60)
    uptime_str = f'{days}d {hours[0]}h {mins[0]}m'

    mem = run("vm_stat | awk '/page size of/{sz=$8} /Pages (active|wired down):/{u+=$NF} /Pages (free|inactive|speculative):/{f+=$NF} END{printf \"%.1f/%.1fG\",u*sz/1073741824,(u+f)*sz/1073741824}'")
    mem_str = mem.get('out', '-').strip() if mem.get('ok') else '-'

    claude_procs = run("ps aux | grep -i '[C]laude' | wc -l").get('out','0').strip()
    load = run("sysctl -n vm.loadavg | tr -d '{}'").get('out','-').strip()

    return {
        'uptime': uptime_str,
        'load': load,
        'memory': mem_str,
        'claudeProcs': int(claude_procs) if claude_procs.isdigit() else 0,
        'hostname': platform.node(),
        'time': time.strftime('%H:%M:%S'),
    }

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        self._cors()
        if path == '/api/status':
            self._json(get_status())
        elif path == '/api/ping':
            self._json({'ok': True, 'host': platform.node()})
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        path = urlparse(self.path).path
        self._cors()
        if path == '/api/cli':
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            cmd = body.get('cmd', '').strip()
            if not cmd:
                self._json({'ok': False, 'err': 'Empty command'})
                return
            if any(kw in cmd.lower() for kw in ['rm -rf', 'shutdown', 'reboot', 'mkfs', 'dd if=']):
                self._json({'ok': False, 'err': 'Dangerous command blocked'})
                return
            result = run(cmd, timeout=body.get('timeout', 15))
            self._json(result)
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self._cors()
        self.send_response(204)
        self.end_headers()

    def _cors(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _json(self, data):
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
        self.end_headers()

    def log_message(self, fmt, *args):
        pass  # quiet

if __name__ == '__main__':
    print(f'Bridge running on http://localhost:{PORT}')
    print(f'  GET  /api/status  -> system status')
    print(f'  POST /api/cli     -> run CLI command')
    HTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
