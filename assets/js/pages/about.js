/**
 * 「了解我」页面：从 data/about.json 渲染开发者介绍。
 */

import { cloneTemplate, loadJSON, mdLite, esc } from "../utils.js";

/**
 * @param {HTMLElement} mount
 */
export async function renderAbout(mount) {
  document.title = "了解我 — amopixel";

  let cfg;
  try {
    cfg = await loadJSON("/data/about.json");
  } catch (e) {
    mount.innerHTML = `<section class="page page-error">
      <h1>无法加载</h1><p>${esc(e.message)}</p>
    </section>`;
    return;
  }

  const frag = cloneTemplate("tpl-about");
  const root = frag.firstElementChild;

  root.querySelector("[data-title]").textContent = cfg.title || "关于我";

  const body = root.querySelector("[data-body]");
  const paragraphs = Array.isArray(cfg.paragraphs) ? cfg.paragraphs : [];
  body.innerHTML = paragraphs.map((p) => mdLite(p)).join("\n");

  mount.replaceChildren(root);
}
