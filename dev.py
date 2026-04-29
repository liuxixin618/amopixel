#!/usr/bin/env python3
"""
本地预览服务器（带 SPA fallback）。

Python 内置的 ``python -m http.server`` 不会使用 ``404.html``，
直接刷新 /games 这种伪路径会返回 404 错误页。
本脚本对所有不是真实文件的请求统一回退到 ``index.html``，
让本地体验与 GitHub Pages 完全一致。

用法：
    python dev.py            # 默认 8080 端口
    python dev.py 9000       # 指定端口
"""

from __future__ import annotations

import http.server
import os
import socket
import socketserver
import sys
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INDEX = ROOT / "index.html"

# 这些前缀下的文件都是真实静态资源，找不到就该 404
STATIC_PREFIXES = ("/assets/", "/data/", "/Games/")

# 这些前缀属于 SPA 路由，必须无条件回退到 index.html
# 注意 Windows 文件系统大小写不敏感：os.path.isdir("/games") 在
# 存在 /Games/ 时会返回 True，所以必须显式判定路由前缀，
# 不能依赖磁盘探测。
ROUTE_PREFIXES = ("/games", "/download", "/about")


class SpaHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".avif": "image/avif",
        ".woff2": "font/woff2",
        "": "application/octet-stream",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # 开发期禁缓存
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write(
            "[%s] %s\n" % (self.log_date_time_string(), fmt % args)
        )

    def send_head(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]

        # 1) SPA 路由前缀：无条件回退到 index.html（避免 Windows
        #    大小写不敏感把 /games 当成磁盘上的 /Games/ 目录）
        for prefix in ROUTE_PREFIXES:
            if path == prefix or path.startswith(prefix + "/"):
                self.path = "/index.html"
                return super().send_head()

        # 2) 静态资源前缀：必须真实存在，否则 404
        if any(path.startswith(p) for p in STATIC_PREFIXES):
            try:
                disk = self.translate_path(path)
            except Exception:
                disk = ""
            if not (disk and os.path.isfile(disk)):
                self.send_error(404, "File not found")
                return None
            return super().send_head()

        # 3) 其他路径：尝试真实文件，否则也 fallback 到 index.html
        try:
            disk = self.translate_path(path)
        except Exception:
            disk = ""
        if not (disk and (os.path.isfile(disk) or os.path.isdir(disk))):
            self.path = "/index.html"
        return super().send_head()


def _pick_port(preferred: int) -> int:
    """端口被占就 +1 直到可用，避免上次 dev 没退干净导致启动失败。"""
    port = preferred
    for _ in range(20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("", port))
                return port
            except OSError:
                port += 1
    raise RuntimeError(f"附近 20 个端口都被占用了（从 {preferred} 起）")


def main() -> int:
    requested = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    port = _pick_port(requested)
    if port != requested:
        print(f"[!] 端口 {requested} 被占用，改用 {port}")

    handler = partial(SpaHandler)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), handler) as httpd:
        print()
        print(f"  amopixel dev server")
        print(f"  → http://localhost:{port}/")
        print(f"  → http://localhost:{port}/games")
        print(f"  → http://localhost:{port}/about")
        print()
        print(f"  serving:   {ROOT}")
        print(f"  fallback:  any non-asset URL → index.html (SPA)")
        print(f"  Ctrl+C 退出")
        print()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[!] 已停止")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
