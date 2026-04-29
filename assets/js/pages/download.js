/**
 * 下载页：展示某个游戏的所有外部链接。
 */

import { cloneTemplate, loadJSON, esc } from "../utils.js";

/**
 * @param {HTMLElement} mount
 * @param {{ gameId: string }} params
 */
export async function renderDownload(mount, params) {
  const gameId = params.gameId;

  let data;
  try {
    data = await loadJSON("data/games.json");
  } catch (e) {
    mount.innerHTML = `<section class="page page-error">
      <h1>无法加载</h1><p>${esc(e.message)}</p>
      <a class="btn btn-primary" href="games">返回游戏页</a>
    </section>`;
    return;
  }

  const game = (data.games || []).find((g) => g.id === gameId);

  if (!game) {
    mount.innerHTML = `<section class="page page-error">
      <h1>未找到该游戏</h1>
      <p>ID：${esc(gameId)}</p>
      <a class="btn btn-primary" href="games">返回游戏页</a>
    </section>`;
    return;
  }

  document.title = `下载 ${game.title} — amopixel`;

  const frag = cloneTemplate("tpl-download");
  const root = frag.firstElementChild;

  // 返回按钮带上 gameId，点击回到游戏页时保留选中（相对路径，由 <base> 自动补 BASE）
  const backBtn = root.querySelector("[data-back]");
  backBtn.setAttribute("href", `games/${encodeURIComponent(game.id)}`);

  const icon = root.querySelector("[data-icon]");
  icon.src = game.icon;
  icon.alt = game.title;

  root.querySelector("[data-title]").textContent = game.title;

  const linksBox = root.querySelector("[data-links]");
  (game.downloads || []).forEach((d, i) => {
    const a = document.createElement("a");
    a.className = "download-link";
    a.href = d.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = d.label;
    a.style.animationDelay = `${i * 60}ms`;
    linksBox.appendChild(a);
  });

  mount.replaceChildren(root);
}
