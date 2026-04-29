/**
 * 站点 BASE 路径管理。
 *
 * BASE 来源：HTML <head> 中的 <base href="..."> 标签。
 *   - 自定义域名根部署（如 https://amopixel.com/）：<base href="/" />
 *   - GitHub Pages 项目页面部署（如 https://user.github.io/amopixel/）：<base href="/amopixel/" />
 *
 * 切换部署位置只需要改 index.html 和 404.html 中的 <base href> 即可，
 * 其它代码自动适配。
 *
 * 三个核心导出：
 *   BASE        始终以 "/" 开头并以 "/" 结尾的字符串
 *   withBase()  把"逻辑路径"(/games/Lumen) 拼成完整 pathname (/amopixel/games/Lumen)
 *   stripBase() 反向操作，从 location.pathname 拿到逻辑路径
 */

const baseEl = document.querySelector("base");
let _base = (baseEl && baseEl.getAttribute("href")) || "/";

// 容错：忽略协议/域名形式的 base，仅取 pathname
try {
  if (/^https?:/i.test(_base) || _base.startsWith("//")) {
    _base = new URL(_base, location.href).pathname;
  }
} catch {
  _base = "/";
}

if (!_base.startsWith("/")) _base = "/" + _base;
if (!_base.endsWith("/")) _base += "/";

/** 站点 BASE，例如 "/" 或 "/amopixel/"。 */
export const BASE = _base;

/**
 * 把逻辑路径（站内绝对，如 /games/Lumen）拼接 BASE 得到完整 pathname。
 * 用于 history.pushState / 设置 href。
 *
 * 入参也可以是 "games/Lumen"（不带前导 /），效果相同。
 * 入参是完整 URL（http://...）时原样返回。
 *
 * @param {string} logicalPath
 * @returns {string}
 */
export function withBase(logicalPath) {
  if (!logicalPath) return BASE;
  if (/^https?:\/\//i.test(logicalPath) || logicalPath.startsWith("//")) {
    return logicalPath;
  }
  const stripped = logicalPath.replace(/^\/+/, "");
  return BASE + stripped;
}

/**
 * 从 location.pathname 中去掉 BASE 前缀，得到逻辑路径（始终以 / 开头）。
 *
 *   BASE="/"          : "/games/Lumen" -> "/games/Lumen"
 *   BASE="/amopixel/" : "/amopixel/games/Lumen" -> "/games/Lumen"
 *   BASE="/amopixel/" : "/amopixel/" -> "/"
 *   BASE="/amopixel/" : "/amopixel"  -> "/"
 *
 * 不在 BASE 范围内的路径原样返回（router 会判定 notfound）。
 *
 * @param {string} pathname
 * @returns {string}
 */
export function stripBase(pathname) {
  if (!pathname) return "/";
  if (BASE === "/") return pathname;
  const noSlash = BASE.slice(0, -1); // 例如 "/amopixel"
  if (pathname === noSlash || pathname === BASE) return "/";
  if (pathname.startsWith(BASE)) return "/" + pathname.slice(BASE.length);
  return pathname;
}
