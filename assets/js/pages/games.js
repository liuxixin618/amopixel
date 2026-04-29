/**
 * 游戏页：图标选择 + Banner 轮播 + 信息区。
 */

import { cloneTemplate, loadJSON, esc } from "../utils.js";
import { replace } from "../router.js";

const STATE = {
  /** @type {any[]} */ games: [],
  /** @type {string|null} */ current: null,
  bannerIdx: 0,
};

/**
 * @param {HTMLElement} mount
 * @param {{ gameId?: string }} params
 */
export async function renderGames(mount, params = {}) {
  document.title = "游戏 — amopixel";

  let data;
  try {
    data = await loadJSON("/amopixel/data/games.json");
  } catch (e) {
    mount.innerHTML = `<section class="page page-error">
      <h1>无法加载游戏列表</h1>
      <p>${esc(e.message)}</p>
      <p style="font-size:14px;color:#8a918c;margin-top:8px">请先运行 <code>python build.py</code></p>
    </section>`;
    return;
  }

  STATE.games = (data && data.games) || [];

  if (!STATE.games.length) {
    mount.innerHTML = `<section class="page page-games">
      <div class="games-empty">
        <h2>还没有游戏</h2>
        <p>在 <code>Games/</code> 目录下添加你的第一个游戏，然后运行 <code>python build.py</code>。</p>
      </div>
    </section>`;
    return;
  }

  const frag = cloneTemplate("tpl-games");
  const root = frag.firstElementChild;
  mount.replaceChildren(root);

  const track = root.querySelector("[data-selector-track]");
  const arrowL = root.querySelector('[data-arrow="left"]');
  const arrowR = root.querySelector('[data-arrow="right"]');
  const detail = root.querySelector("[data-detail]");

  // 渲染图标列表
  STATE.games.forEach((g) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "game-icon";
    btn.dataset.gameId = g.id;
    btn.innerHTML = `
      <img src="${esc(g.icon)}" alt="${esc(g.title)}" loading="lazy" />
      <span class="game-icon-label">${esc(g.title)}</span>
    `;
    btn.addEventListener("click", () => selectGame(g.id, true));
    track.appendChild(btn);
  });

  // 选中游戏：URL 参数 → 之前的状态 → 第一个
  const initialId =
    (params.gameId && STATE.games.find((g) => g.id === params.gameId) && params.gameId) ||
    STATE.current ||
    STATE.games[0].id;

  selectGame(initialId, false);

  // 左右切换按钮
  arrowL.addEventListener("click", () => stepGame(-1));
  arrowR.addEventListener("click", () => stepGame(1));
  updateArrows();

  // ----- 内部函数 -----

  function stepGame(delta) {
    const idx = STATE.games.findIndex((g) => g.id === STATE.current);
    const next = STATE.games[idx + delta];
    if (next) selectGame(next.id, true);
  }

  function updateArrows() {
    const idx = STATE.games.findIndex((g) => g.id === STATE.current);
    arrowL.toggleAttribute("disabled", idx <= 0);
    arrowR.toggleAttribute("disabled", idx >= STATE.games.length - 1);
  }

  function selectGame(id, updateUrl) {
    const game = STATE.games.find((g) => g.id === id);
    if (!game) return;
    STATE.current = id;
    STATE.bannerIdx = 0;

    // 高亮
    track.querySelectorAll(".game-icon").forEach((el) => {
      el.classList.toggle("is-selected", el.dataset.gameId === id);
    });

    // 滚动到可见
    const sel = track.querySelector(".game-icon.is-selected");
    if (sel) {
      sel.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }

    renderDetail(detail, game);
    updateArrows();

    if (updateUrl) {
      // 仅同步地址栏，不触发 popstate 重新渲染
      replace(`/amopixel/games/${encodeURIComponent(id)}`);
    }
  }
}

/**
 * 渲染详情区（Banner + 文本 + 下载）。
 */
function renderDetail(detail, game) {
  detail.classList.remove("is-swapping");
  // 触发 reflow 来重启动画
  void detail.offsetWidth;
  detail.classList.add("is-swapping");

  const stage = detail.querySelector("[data-banner-stage]");
  const dotsBox = detail.querySelector("[data-banner-dots]");
  const titleEl = detail.querySelector("[data-title]");
  const descEl = detail.querySelector("[data-desc]");
  const dlBtn = detail.querySelector("[data-download]");
  const bannerBox = detail.querySelector("[data-banner]");

  // 标题字号自适应：长度越短越大
  const len = [...game.title].length;
  let size;
  if (len <= 6) size = "clamp(36px, 5vw, 64px)";
  else if (len <= 12) size = "clamp(30px, 4vw, 50px)";
  else if (len <= 20) size = "clamp(24px, 3.2vw, 38px)";
  else size = "clamp(20px, 2.6vw, 30px)";
  titleEl.style.setProperty("--title-size", size);
  titleEl.textContent = game.title;

  descEl.textContent = game.description || "";

  dlBtn.setAttribute("href", `/amopixel/download/${encodeURIComponent(game.id)}`);

  // Banner
  stage.innerHTML = "";
  dotsBox.innerHTML = "";
  // 移除旧的箭头
  bannerBox.querySelectorAll(".banner-arrow").forEach((n) => n.remove());

  const banners = game.banners || [];
  banners.forEach((src, i) => {
    const slide = document.createElement("div");
    slide.className = "banner-slide";
    slide.innerHTML = `<img src="${esc(src)}" alt="${esc(
      game.title
    )} banner ${i + 1}" loading="${i === 0 ? "eager" : "lazy"}" />`;
    slide.addEventListener("click", () => openLightbox(src));
    stage.appendChild(slide);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "banner-dot" + (i === 0 ? " is-active" : "");
    dot.setAttribute("aria-label", `第 ${i + 1} 张`);
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      go(i);
    });
    dotsBox.appendChild(dot);
  });

  if (banners.length > 1) {
    const left = createArrow("left");
    const right = createArrow("right");
    left.addEventListener("click", (e) => {
      e.stopPropagation();
      go(STATE.bannerIdx - 1);
    });
    right.addEventListener("click", (e) => {
      e.stopPropagation();
      go(STATE.bannerIdx + 1);
    });
    bannerBox.appendChild(left);
    bannerBox.appendChild(right);

    // 触摸滑动
    enableSwipe(stage, () => go(STATE.bannerIdx + 1), () => go(STATE.bannerIdx - 1));
  }

  go(0);

  function go(i) {
    const n = banners.length;
    if (!n) return;
    STATE.bannerIdx = ((i % n) + n) % n;
    stage.style.transform = `translateX(-${STATE.bannerIdx * 100}%)`;
    dotsBox.querySelectorAll(".banner-dot").forEach((d, j) => {
      d.classList.toggle("is-active", j === STATE.bannerIdx);
    });
  }
}

function createArrow(dir) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `banner-arrow banner-arrow--${dir}`;
  btn.setAttribute("aria-label", dir === "left" ? "上一张" : "下一张");
  const path =
    dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6";
  btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return btn;
}

function enableSwipe(el, onSwipeLeft, onSwipeRight) {
  let startX = 0;
  let startY = 0;
  let active = false;
  el.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      active = true;
    },
    { passive: true }
  );
  el.addEventListener(
    "touchend",
    (e) => {
      if (!active) return;
      active = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    },
    { passive: true }
  );
}

function openLightbox(src) {
  const lb = document.getElementById("lightbox");
  const img = lb.querySelector(".lightbox-img");
  img.src = src;
  lb.hidden = false;
  lb.setAttribute("aria-hidden", "false");
}

// 全局：Lightbox 关闭逻辑（只挂一次）
(function bindLightbox() {
  const lb = document.getElementById("lightbox");
  if (!lb || lb.dataset.bound) return;
  lb.dataset.bound = "1";
  const close = () => {
    lb.hidden = true;
    lb.setAttribute("aria-hidden", "true");
    const img = lb.querySelector(".lightbox-img");
    img.src = "";
  };
  lb.addEventListener("click", (e) => {
    if (e.target === lb || e.target.classList.contains("lightbox-close")) {
      close();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lb.hidden) close();
  });
})();

/**
 * 暴露给路由：返回当前选中的 gameId（用于下载页返回时恢复）。
 */
export function getCurrentGameId() {
  return STATE.current;
}
