/**
 * 应用入口：组装路由 + 切换页面 + 顶栏状态同步 + 内部链接点击拦截。
 */

import { onRoute, navigate, parseLocation } from "./router.js";
import { renderHome } from "./pages/home.js";
import { renderGames } from "./pages/games.js";
import { renderDownload } from "./pages/download.js";
import { renderAbout } from "./pages/about.js";

const view = document.getElementById("view");
const topbar = document.querySelector(".topbar");
const navLinks = document.querySelectorAll(".nav a[data-nav]");

let activeRoute = null;

/* ---------- 顶栏状态 ---------- */

function syncTopbar(route) {
  navLinks.forEach((a) => {
    if (a.dataset.nav === route.name) {
      a.setAttribute("aria-current", "page");
    } else {
      a.removeAttribute("aria-current");
    }
  });
  topbar.dataset.page = route.name;
}

function syncTopbarShadow() {
  topbar.dataset.scrolled = window.scrollY > 4 ? "true" : "false";
}

window.addEventListener("scroll", syncTopbarShadow, { passive: true });
syncTopbarShadow();

/* ---------- 客户端路由：拦截内部 <a> 点击 ---------- */

document.addEventListener("click", (e) => {
  // 仅左键，无修饰键
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (e.defaultPrevented) return;

  const a = e.target.closest("a");
  if (!a) return;

  // 跳过外链 / 新窗口 / 下载链接
  if (a.target && a.target !== "" && a.target !== "_self") return;
  if (a.hasAttribute("download")) return;

  const href = a.getAttribute("href");
  if (!href) return;
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("//") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  )
    return;

  // 仅处理站内绝对路径（以 / 开头）
  if (!href.startsWith("/")) return;

  e.preventDefault();
  navigate(href);
});

/* ---------- 路由 → 页面渲染分发 ---------- */

async function go(route, prev) {
  activeRoute = route;
  syncTopbar(route);

  // 离场动画
  const oldPage = view.firstElementChild;
  if (oldPage && prev) {
    oldPage.classList.add("is-leaving");
    await new Promise((r) => setTimeout(r, 180));
  }

  try {
    switch (route.name) {
      case "home":
        await renderHome(view);
        break;
      case "games":
        await renderGames(view, route.params);
        break;
      case "download":
        if (!route.params.gameId) {
          navigate("/games");
          return;
        }
        await renderDownload(view, route.params);
        break;
      case "about":
        await renderAbout(view);
        break;
      default:
        view.innerHTML = `<section class="page page-error">
          <h1>页面不存在</h1>
          <p>找不到对应的页面。</p>
          <a class="btn btn-primary" href="/">返回首页</a>
        </section>`;
    }
  } catch (err) {
    console.error(err);
    view.innerHTML = `<section class="page page-error">
      <h1>渲染出错</h1>
      <p>${err && err.message ? err.message : "未知错误"}</p>
      <a class="btn btn-primary" href="/">返回首页</a>
    </section>`;
  }

  // 顶部回滚（除非是同一页只换游戏 ID）
  if (!prev || prev.name !== route.name) {
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }
}

onRoute(go);

window.__amopixel = { parseLocation };
