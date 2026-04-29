#!/usr/bin/env python3
"""
本地预览服务器（带 SPA fallback + 可选 BASE 前缀）。

Python 内置的 ``python -m http.server`` 不会使用 ``404.html``，
直接刷新 /games 这种伪路径会返回 404 错误页。
本脚本对所有不是真实文件的请求统一回退到 ``index.html``，
让本地体验与 GitHub Pages 完全一致。

支持模拟「GitHub Pages 项目页面」部署：

    python dev.py                       # http://localhost:8080/
    python dev.py --base /amopixel/     # http://localhost:8080/amopixel/
    python dev.py --port 9000

注意：使用 --base 时还需要把 index.html 与 404.html 中的 <base href> 改成相同值。
"""

from __future__ import annotations

import argparse
import http.server
import os
import socket
import socketserver
import sys
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent

STATIC_PREFIXES = ("assets/", "data/", "Games/")  # 不含前导 /
SPECIAL_FILES = {"favicon.ico", "robots.txt", "sitemap.xml", "CNAME"}


def make_handler(base: str):
    """
    base 形如 "/" 或 "/amopixel/"。
    所有 URL 必须落在 base 前缀下，否则返回 404 / 重定向。
    base 内部的请求按真实文件 → 不存在则回退 index.html。
    """

    base_prefix = base if base.endswith("/") else base + "/"
    base_no_slash = base_prefix[:-1]  # "" 或 "/amopixel"

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
            self.send_header("Cache-Control", "no-store, must-revalidate")
            super().end_headers()

        def log_message(self, fmt, *args):
            sys.stderr.write(
                "[%s] %s\n" % (self.log_date_time_string(), fmt % args)
            )

        def send_head(self):
            full_path = self.path.split("?", 1)[0].split("#", 1)[0]

            # ---- BASE 前缀检查 ----
            if base_prefix != "/":
                if full_path == base_no_slash:
                    self.send_response(301)
                    self.send_header("Location", base_prefix)
                    self.end_headers()
                    return None
                if not full_path.startswith(base_prefix):
                    self.send_error(404, f"Not in BASE ({base_prefix})")
                    return None
                inner = full_path[len(base_prefix):]
            else:
                inner = full_path.lstrip("/")

            # 根路径 → index.html
            if inner == "" or inner == "index.html":
                self.path = "/index.html"
                return super().send_head()

            first_seg = inner.split("/", 1)[0]
            is_static = (
                any(inner.startswith(p) for p in STATIC_PREFIXES)
                or first_seg in SPECIAL_FILES
                or first_seg == "404.html"
            )

            if is_static:
                # 真实静态资源：必须存在，否则 404
                # （case-sensitive 路径检查，避免 Windows 把 /games 误匹配到 Games/）
                disk = (ROOT / inner).resolve()
                try:
                    disk.relative_to(ROOT)
                except ValueError:
                    self.send_error(403, "Forbidden")
                    return None
                if disk.is_file() or disk.is_dir():
                    self.path = "/" + inner
                    return super().send_head()
                self.send_error(404, "File not found")
                return None

            # 其它任何路径都是 SPA 路由，回退到 index.html
            self.path = "/index.html"
            return super().send_head()

    return SpaHandler


def _pick_port(preferred: int) -> int:
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
    parser = argparse.ArgumentParser(
        description="amopixel 本地预览服务器（带 SPA fallback）"
    )
    parser.add_argument("--port", type=int, default=8080, help="默认 8080")
    parser.add_argument(
        "--base",
        default="/",
        help='BASE 前缀，默认 "/"。模拟 GitHub Pages 项目页面用 "/amopixel/"',
    )
    # 兼容老用法 dev.py 8080
    parser.add_argument("legacy_port", nargs="?", type=int, help=argparse.SUPPRESS)
    args = parser.parse_args()

    port = _pick_port(args.legacy_port or args.port)
    if port != (args.legacy_port or args.port):
        print(f"[!] 端口被占用，改用 {port}")

    base = args.base
    if not base.startswith("/"):
        base = "/" + base
    if not base.endswith("/"):
        base += "/"

    handler = make_handler(base)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), handler) as httpd:
        print()
        print(f"  amopixel dev server")
        print(f"  → http://localhost:{port}{base}")
        print(f"  → http://localhost:{port}{base}games")
        print(f"  → http://localhost:{port}{base}about")
        print()
        print(f"  serving:   {ROOT}")
        print(f"  base:      {base}")
        print(f"  fallback:  any non-asset URL inside base → index.html (SPA)")
        print(f"  Ctrl+C 退出")
        print()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[!] 已停止")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
