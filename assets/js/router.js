/**
 * 极简 History API 路由（无 # 号）。
 *
 * 路由表：
 *   /                       → home
 *   /games                  → games（默认选第一个）
 *   /games/<gameId>         → games（指定游戏选中）
 *   /download/<gameId>      → download
 *   /about                  → about
 *
 * GitHub Pages 配套：
 *   - 直接访问 /games 这种"伪"路径时 GitHub Pages 会返回 404.html
 *   - 404.html 把当前路径暂存到 sessionStorage 然后跳到 /
 *   - index.html 启动时检测并 history.replaceState 恢复路径
 *   该恢复逻辑在 index.html 的内联 <script> 中执行（在本模块加载之前）。
 */

/** @typedef {{ name: string, params: Record<string,string> }} Route */

const routes = [
  { name: "home", pattern: /^\/?$/, keys: [] },
  { name: "games", pattern: /^\/games\/?$/, keys: [] },
  { name: "games", pattern: /^\/games\/([^/]+)\/?$/, keys: ["gameId"] },
  { name: "download", pattern: /^\/download\/([^/]+)\/?$/, keys: ["gameId"] },
  { name: "about", pattern: /^\/about\/?$/, keys: [] },
];

/**
 * 解析当前 URL 为路由。
 * @returns {Route}
 */
export function parseLocation() {
  const path = decodePath(location.pathname || "/");
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

/**
 * 把 path 中的每段单独解码（保留 / 分隔符），让目录里有空格 / 中文也能匹配模式。
 * @param {string} p
 */
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
 * 跳转到给定路径（带历史记录）。
 * @param {string} path
 */
export function navigate(path) {
  const target = normalize(path);
  if (target === currentPath()) return;
  history.pushState(null, "", target);
  fire();
}

/**
 * 替换当前历史记录（不新增条目，例如游戏页内切换游戏 ID）。
 * @param {string} path
 */
export function replace(path) {
  const target = normalize(path);
  if (target === currentPath()) return;
  history.replaceState(null, "", target);
  // 不触发 onRoute 回调（仅同步地址栏）
}

function currentPath() {
  return (location.pathname || "/") + (location.search || "") + (location.hash || "");
}

function normalize(path) {
  if (!path) return "/";
  if (!path.startsWith("/")) path = "/" + path;
  return path;
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

/**
 * 注册路由变化监听。回调收到 (Route, prevRoute|null)。
 */
export function onRoute(handler) {
  _handler = handler;
  window.addEventListener("popstate", fire);
  fire();
}
