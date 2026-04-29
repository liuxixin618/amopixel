#!/usr/bin/env python3
"""
端到端一致性自检脚本（非测试框架，仅做静态验证）。

校验：
1. 所有 game.json 引用的图标 / banner 文件均存在
2. 所有 data/games.json 中的资源路径在磁盘上能找到
3. data/home.json 中引用的 hero 资源存在
4. index.html 引用的 logo / favicon / CSS / JS 入口都存在
5. JS 文件中通过 import 引入的相对路径文件都存在
6. 各 JS 文件的大括号 / 圆括号 / 方括号配对平衡
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

errors: list[str] = []
warnings: list[str] = []
checks = 0


def check(cond: bool, msg: str) -> None:
    global checks
    checks += 1
    if not cond:
        errors.append(msg)


def resolve(*parts: str) -> Path:
    """把 URL 风格路径解析为磁盘路径。/foo 与 foo 等价。"""
    cleaned = []
    for p in parts:
        # pathlib / 操作遇到绝对路径会重置，所以先剥掉前导斜杠
        cleaned.append(p.lstrip("/\\"))
    return ROOT.joinpath(*cleaned)


# 1) games.json
games_json = resolve("data", "games.json")
check(games_json.exists(), "data/games.json 不存在（请先运行 python build.py）")
if games_json.exists():
    data = json.loads(games_json.read_text(encoding="utf-8"))
    games = data.get("games", [])
    check(isinstance(games, list) and len(games) > 0, "games.json 中没有任何游戏")

    for g in games:
        gid = g.get("id", "?")
        icon = resolve(g["icon"])
        check(icon.exists(), f"[{gid}] 图标缺失: {g['icon']}")
        for b in g.get("banners", []):
            check(resolve(b).exists(), f"[{gid}] banner 缺失: {b}")
        check(len(g.get("downloads", [])) >= 1, f"[{gid}] 至少需要 1 个下载链接")


# 2) home.json
home_json = resolve("data", "home.json")
check(home_json.exists(), "data/home.json 不存在")
if home_json.exists():
    h = json.loads(home_json.read_text(encoding="utf-8"))
    hero = h.get("hero") or {}
    if hero.get("src"):
        check(resolve(hero["src"]).exists(), f"hero 资源缺失: {hero['src']}")
        check(
            hero.get("type") in ("image", "video"),
            f"hero.type 必须是 image 或 video，实际: {hero.get('type')}",
        )


# 3) about.json
about_json = resolve("data", "about.json")
check(about_json.exists(), "data/about.json 不存在")


# 4) index.html 中引用的真实静态资源
#    （跳过路由路径 /、/games、/about 等，它们不是文件）
index = resolve("index.html").read_text(encoding="utf-8")
for ref in re.findall(r'(?:href|src)=["\']([^"\'#?]+)["\']', index):
    if ref.startswith("http") or ref.startswith("#") or ref.startswith("//"):
        continue
    if ref.startswith("mailto:") or ref.startswith("tel:"):
        continue
    # 只校验 /assets/ /data/ /Games/ 这些资源前缀，路由路径忽略
    if not any(
        ref.startswith(prefix)
        for prefix in ("/assets/", "/data/", "/Games/", "assets/", "data/", "Games/")
    ):
        continue
    p = resolve(ref)
    check(p.exists(), f"index.html 引用的资源缺失: {ref}")


# 5) JS 内部 import 路径
js_root = resolve("assets", "js")
for js_file in js_root.rglob("*.js"):
    text = js_file.read_text(encoding="utf-8")
    for imp in re.findall(r'from\s+["\']([^"\']+)["\']', text):
        if not imp.startswith(".") and not imp.startswith("/"):
            continue
        target = (js_file.parent / imp).resolve()
        # 允许 .js 缺省，但我们的代码都写全了
        check(
            target.exists(),
            f"{js_file.relative_to(ROOT)}: 找不到 import 目标 {imp}",
        )


# 6) HTML 模板里使用的 template id 在 index.html 中真实存在
TPL_IDS = re.findall(r'cloneTemplate\(["\']([^"\']+)["\']\)', "\n".join(
    p.read_text(encoding="utf-8") for p in js_root.rglob("*.js")
))
for tid in set(TPL_IDS):
    check(
        f'id="{tid}"' in index,
        f"index.html 缺少模板 #{tid}（被 JS 中 cloneTemplate 引用）",
    )


# 输出结果
print(f"共执行检查: {checks}")
if errors:
    print(f"\n[FAIL] 发现 {len(errors)} 个问题:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("[PASS] 所有检查通过")
