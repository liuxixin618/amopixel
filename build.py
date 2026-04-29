#!/usr/bin/env python3
"""
amopixel.com 站点构建脚本
=================================

扫描 ``Games/`` 目录，将每个游戏的元数据合并为单一的 ``data/games.json``，
供前端 SPA 在运行时读取。无需任何第三方依赖，标准库即可。

约定：
    Games/<GameDir>/icon.png      游戏图标（必需）
    Games/<GameDir>/game.json     游戏配置（必需）
    Games/<GameDir>/Banners/*.*   Banner 图（至少 1 张，按文件名排序）

游戏配置 game.json 字段：
    title         (str, required)  游戏标题
    description   (str, required)  游戏简介，支持 \\n 换行
    downloads     (list, required) [{ "label": str, "url": str }, ...]
    id            (str, optional)  路由 ID，缺省用目录名
    order         (int, optional)  排序权重，越小越靠前

用法：
    python build.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Windows GBK 控制台兼容：强制 stdout/stderr 用 UTF-8，避免输出框线/对勾时崩溃
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Windows 终端启用 ANSI 颜色
if os.name == "nt":
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent
GAMES_DIR = ROOT / "Games"
DATA_DIR = ROOT / "data"
OUTPUT = DATA_DIR / "games.json"

# 允许的 banner 后缀（小写）
BANNER_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"}
# 允许的图标后缀
ICON_NAMES = ["icon.png", "icon.jpg", "icon.jpeg", "icon.webp", "icon.svg"]


# ---------- 终端彩色输出（Windows / *nix 通用，无依赖） ----------

class _Color:
    RESET = "\033[0m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    CYAN = "\033[96m"
    DIM = "\033[2m"


def _safe_print(s: str, file=None) -> None:
    """Windows 终端再保险：编码失败时降级为纯 ASCII。"""
    try:
        print(s, file=file)
    except UnicodeEncodeError:
        print(s.encode("ascii", "replace").decode("ascii"), file=file)


def _info(msg: str) -> None:
    _safe_print(f"{_Color.CYAN}[i]{_Color.RESET} {msg}")


def _ok(msg: str) -> None:
    _safe_print(f"{_Color.GREEN}[ok]{_Color.RESET} {msg}")


def _warn(msg: str) -> None:
    _safe_print(f"{_Color.YELLOW}[!]{_Color.RESET} {msg}")


def _err(msg: str) -> None:
    _safe_print(f"{_Color.RED}[x]{_Color.RESET} {msg}", file=sys.stderr)


# ---------- 数据结构 ----------

@dataclass
class GameError(Exception):
    game_dir: str
    message: str

    def __str__(self) -> str:  # pragma: no cover - 仅用于打印
        return f"{self.game_dir}: {self.message}"


# ---------- 实现 ----------

def _natural_key(s: str) -> list[Any]:
    """按文件名中的数字部分自然排序：'2.jpg' < '10.jpg'。"""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def _find_icon(game_dir: Path) -> str | None:
    for name in ICON_NAMES:
        p = game_dir / name
        if p.exists():
            # 用绝对路径，让前端在任意 history 路由下都能正确加载
            return f"/Games/{game_dir.name}/{p.name}"
    return None


def _find_banners(game_dir: Path) -> list[str]:
    banners_dir = game_dir / "Banners"
    if not banners_dir.is_dir():
        return []
    files = [
        p
        for p in banners_dir.iterdir()
        if p.is_file() and p.suffix.lower() in BANNER_EXTS
    ]
    files.sort(key=lambda p: _natural_key(p.name))
    return [f"/Games/{game_dir.name}/Banners/{p.name}" for p in files]


def _load_game(game_dir: Path) -> dict[str, Any]:
    cfg_path = game_dir / "game.json"
    if not cfg_path.exists():
        raise GameError(game_dir.name, "缺少 game.json")

    try:
        with cfg_path.open("r", encoding="utf-8") as f:
            cfg = json.load(f)
    except json.JSONDecodeError as e:
        raise GameError(game_dir.name, f"game.json 解析失败: {e}") from e

    if not isinstance(cfg, dict):
        raise GameError(game_dir.name, "game.json 顶层必须是对象")

    title = cfg.get("title")
    if not isinstance(title, str) or not title.strip():
        raise GameError(game_dir.name, "缺少必填字段 title")

    description = cfg.get("description", "")
    if not isinstance(description, str):
        raise GameError(game_dir.name, "description 必须是字符串")

    downloads = cfg.get("downloads", [])
    if not isinstance(downloads, list) or not downloads:
        raise GameError(game_dir.name, "downloads 必须是非空数组")
    cleaned_downloads: list[dict[str, str]] = []
    for i, d in enumerate(downloads):
        if not isinstance(d, dict):
            raise GameError(game_dir.name, f"downloads[{i}] 必须是对象")
        label = d.get("label")
        url = d.get("url")
        if not isinstance(label, str) or not label.strip():
            raise GameError(game_dir.name, f"downloads[{i}].label 缺失")
        if not isinstance(url, str) or not url.strip():
            raise GameError(game_dir.name, f"downloads[{i}].url 缺失")
        cleaned_downloads.append({"label": label.strip(), "url": url.strip()})

    icon = _find_icon(game_dir)
    if not icon:
        raise GameError(game_dir.name, "缺少图标 icon.png/jpg/webp/svg")

    banners = _find_banners(game_dir)
    if not banners:
        raise GameError(game_dir.name, "Banners/ 中至少需要 1 张图")

    return {
        "id": str(cfg.get("id") or game_dir.name),
        "dir": game_dir.name,
        "title": title.strip(),
        "description": description,
        "icon": icon,
        "banners": banners,
        "downloads": cleaned_downloads,
        "order": int(cfg.get("order", 1000)),
    }


def build() -> int:
    if not GAMES_DIR.is_dir():
        _warn(f"未找到 Games/ 目录: {GAMES_DIR}，将生成空列表")
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(
            json.dumps({"games": []}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return 0

    game_dirs = sorted(
        [p for p in GAMES_DIR.iterdir() if p.is_dir() and not p.name.startswith(".")],
        key=lambda p: p.name.lower(),
    )

    games: list[dict[str, Any]] = []
    errors: list[GameError] = []

    for d in game_dirs:
        try:
            g = _load_game(d)
            games.append(g)
            _ok(
                f"{d.name:<24} -> {g['title']}  "
                f"{_Color.DIM}(banners: {len(g['banners'])}, downloads: {len(g['downloads'])}){_Color.RESET}"
            )
        except GameError as e:
            errors.append(e)
            _err(str(e))

    games.sort(key=lambda g: (g["order"], g["title"].lower()))

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps({"games": games}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    _info(f"已写入 {OUTPUT.relative_to(ROOT)}（共 {len(games)} 个游戏）")

    if errors:
        _warn(f"{len(errors)} 个游戏被跳过，请修正上方错误后重新构建")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(build())
