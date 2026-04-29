/**
 * 首页：渲染主视觉（图片或视频）。
 */

import { cloneTemplate, loadJSON, esc } from "../utils.js";

/**
 * @param {HTMLElement} mount
 */
export async function renderHome(mount) {
  const frag = cloneTemplate("tpl-home");
  const root = frag.firstElementChild;
  const heroBox = root.querySelector("[data-hero]");

  let cfg = null;
  try {
    cfg = await loadJSON("/data/home.json");
  } catch {
    /* 静默 */
  }

  const hero = cfg && cfg.hero;
  if (!hero || !hero.src) {
    heroBox.innerHTML =
      '<div class="hero-empty">请在 data/home.json 中配置主视觉资源</div>';
  } else if (hero.type === "video") {
    const poster = hero.poster ? ` poster="${esc(hero.poster)}"` : "";
    heroBox.innerHTML = `
      <video
        src="${esc(hero.src)}"${poster}
        autoplay
        loop
        muted
        playsinline
        preload="auto"
      ></video>
    `;
    // iOS Safari 偶尔不会自动播放，主动尝试一下
    const v = heroBox.querySelector("video");
    v && v.play && v.play().catch(() => {});
  } else {
    heroBox.innerHTML = `<img src="${esc(hero.src)}" alt="${esc(
      cfg.alt || "主视觉"
    )}" />`;
  }

  mount.replaceChildren(root);
  document.title = "amopixel — 独立游戏开发者";
}
