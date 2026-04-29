/**
 * 通用工具：JSON 加载、模板克隆、轻量 Markdown、转义。
 */

const _cache = new Map();

/**
 * 带缓存的 JSON 加载，带友好的错误信息。
 * @template T
 * @param {string} url
 * @returns {Promise<T>}
 */
export async function loadJSON(url) {
  if (_cache.has(url)) return _cache.get(url);
  const p = (async () => {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(`加载失败 (${res.status}): ${url}`);
    }
    return res.json();
  })();
  _cache.set(url, p);
  try {
    return await p;
  } catch (err) {
    _cache.delete(url);
    throw err;
  }
}

/**
 * 克隆 <template id="..."> 内容。
 * @param {string} id
 * @returns {DocumentFragment}
 */
export function cloneTemplate(id) {
  const tpl = /** @type {HTMLTemplateElement | null} */ (
    document.getElementById(id)
  );
  if (!tpl) throw new Error(`模板未找到：#${id}`);
  return tpl.content.cloneNode(true);
}

/** HTML 转义。 */
export function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 极轻量 Markdown 子集：粗体 **x**、斜体 *x*、链接 [t](url)、行内 `code`。
 * 段落由空行分隔，单行换行转 <br/>。
 * 故意不引入完整 markdown 库，体积更小、更可控。
 * @param {string} src
 * @returns {string}
 */
export function mdLite(src) {
  const blocks = String(src).replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks
    .map((block) => {
      let html = esc(block);
      // 链接 [text](url)
      html = html.replace(
        /\[([^\]]+)\]\(([^)\s]+)\)/g,
        (_, t, u) =>
          `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`
      );
      // 粗体
      html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      // 斜体
      html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
      // 行内 code
      html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
      // 换行
      html = html.replace(/\n/g, "<br/>");
      return `<p>${html}</p>`;
    })
    .join("\n");
}

/**
 * 防抖。
 * @template {(...args: any[]) => any} F
 * @param {F} fn
 * @param {number} wait
 * @returns {(...args: Parameters<F>) => void}
 */
export function debounce(fn, wait = 100) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/**
 * 等待 N ms。
 */
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 根据图片 URL 预加载，返回 Promise。
 */
export function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${src}`));
    img.src = src;
  });
}
