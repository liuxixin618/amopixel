/**
 * 极简 History API 路由（无 # 号），支持 BASE 子路径部署。
 *
 * 路由表（"逻辑路径"，即 BASE 之外的部分）：
 *   /                       → home
 *   /games                  → games（默认选第一个）
 *   /games/<gameId>         → games（指定游戏选中）
 *   /download/<gameId>      → download
 *   /about                  → about
 *
 * GitHub Pages 配套：
 *   - 直接访问 /games 这种"伪"路径时 GitHub Pages 会返回 404.html
 *   - 404.html 把当前路径暂存到 sessionStorage 然后跳到 BASE 根
 *   - index.html 启动时检测并 history.replaceState 恢复路径
 *   该恢复逻辑在 index.html 的内联 <script> 中执行（在本模块加载之前）。
 */

import { withBase, stripBase } from "./base.js";

/** @typedef {{ name: string, params: Record<string,string> }} Route */

const routes = [
  { name: "home", pattern: /^\/?$/, keys: [] },
  { name: "games", pattern: /^\/games\/?$/, keys: [] },
  { name: "games", pattern: /^\/games\/([^/]+)\/?$/, keys: ["gameId"] },
  { name: "download", pattern: /^\/download\/([^/]+)\/?$/, keys: ["gameId"] },
  { name: "about", pattern: /^\/about\/?$/, keys: [] },
];

/**
 * 解析当前 URL 为路由（自动剥离 BASE 前缀）。
 * @returns {Route}
 */
export function parseLocation() {
  const path = decodePath(stripBase(location.pathname || "/"));
  for (const r of routes) {
    const m = path.match(r.pattern);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { name: r.name, params };
    }
  }
  return { name: "notfound", params: {} };
}

function decodePath(p) {
  try {
    return p
      .split("/")
      .map((seg) => (seg ? decodeURIComponent(seg) : seg))
      .join("/");
  } catch {
    return p;
  }
}

/**
 * 跳转到给定逻辑路径（自动拼 BASE）。
 * @param {string} logicalPath 例如 "/games/Lumen"
 */
export function navigate(logicalPath) {
  const target = withBase(normalize(logicalPath));
  if (target === currentPath()) return;
  history.pushState(null, "", target);
  fire();
}

/**
 * 替换当前历史条目（不新增），用于游戏页内切换游戏 ID 等场景。
 * @param {string} logicalPath
 */
export function replace(logicalPath) {
  const target = withBase(normalize(logicalPath));
  if (target === currentPath()) return;
  history.replaceState(null, "", target);
}

function currentPath() {
  return (location.pathname || "/") + (location.search || "") + (location.hash || "");
}

function normalize(p) {
  if (!p) return "/";
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

/** @type {((cur: Route, prev: Route|null) => void) | null} */
let _handler = null;
let _prev = null;

function fire() {
  if (!_handler) return;
  const cur = parseLocation();
  _handler(cur, _prev);
  _prev = cur;
}

export function onRoute(handler) {
  _handler = handler;
  window.addEventListener("popstate", fire);
  fire();
}
