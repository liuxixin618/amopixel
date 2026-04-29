# amopixel.com

独立游戏开发者个人官网，纯静态站点，部署于 GitHub Pages。

- 域名：`amopixel.com`
- 技术：原生 HTML / CSS / JavaScript（零运行时依赖）
- 构建：Python 3 脚本扫描 `Games/` 目录生成 `data/games.json`
- 部署：GitHub Pages（自定义域名 + GitHub Actions 自动构建）

---

## 1. 目录结构

```
amopixel/
├── index.html                # SPA 单入口（含 <base href> 配置部署 BASE）
├── 404.html                  # SPA 子路径回退（同样含 <base href>）
├── CNAME                     # 自定义域名（仅根部署需要，子路径部署请删除）
├── build.py                  # 扫描 Games/ 自动生成 games.json
├── dev.py                    # 本地预览服务器（带 SPA fallback / BASE 仿真）
├── verify.py                 # 端到端资源/配置/模板一致性自检
│
├── assets/
│   ├── css/main.css          # 设计系统 + 所有页面样式
│   ├── js/                   # 应用代码（router + 各页面控制器）
│   │   ├── app.js
│   │   ├── router.js         # History API 路由（无 #）
│   │   ├── base.js           # BASE 路径管理（withBase / stripBase）
│   │   ├── utils.js
│   │   └── pages/
│   │       ├── home.js
│   │       ├── games.js
│   │       ├── download.js
│   │       └── about.js
│   ├── icons/favicon.svg
│   └── home/                 # 首页主视觉资源
│       ├── logo.svg          # 站点 Logo（替换为 png/jpg 均可，横向长图也支持）
│       └── hero.svg          # 或 hero.jpg / hero.mp4
│
├── Games/                    # 游戏内容目录（核心维护区）
│   ├── ExampleGameA/
│   │   ├── icon.png          # 游戏图标（建议 512×512 PNG）
│   │   ├── game.json         # 游戏配置
│   │   └── Banners/          # Banner 轮播图（至少 1 张）
│   │       ├── 01.jpg
│   │       └── 02.jpg
│   └── ExampleGameB/
│       └── ...
│
├── data/
│   ├── games.json            # 由 build.py 自动生成，勿手工编辑
│   ├── home.json             # 首页主视觉配置
│   └── about.json            # 「了解我」页面内容
│
└── .github/workflows/deploy.yml   # CI：构建 + 部署
```

## 2. 新增一个游戏

仅需 4 步，无需改代码：

1. 在 `Games/` 下新建目录，如 `Games/MyNewGame/`
2. 放入 `icon.png`（图标）
3. 创建 `Banners/` 子目录，放入至少 1 张 banner 图（按文件名排序播放）
4. 新建 `game.json`：

```json
{
  "title": "我的新游戏",
  "description": "一句话简介。\n\n可以使用换行写多段文字。",
  "downloads": [
    { "label": "Steam 商店", "url": "https://store.steampowered.com/..." },
    { "label": "itch.io", "url": "https://example.itch.io/..." },
    { "label": "Android APK", "url": "https://..." }
  ]
}
```

可选字段：
- `id`：路由用 ID，缺省时自动用目录名
- `order`：排序权重，数字越小越靠前

提交推送后，GitHub Actions 会自动重新生成 `data/games.json` 并发布。

## 3. 本地预览

由于网站采用 **History API 路由**（URL 是 `/games` 而不是 `/#/games`），刷新子路径时
浏览器会向服务器请求 `/games` 这种文件，必须由服务器把它回退到 `index.html`。
普通 `python -m http.server` **不支持** 这种回退（也不会用 `404.html`），
所以推荐使用项目自带的 `dev.py`：

```bash
# 1) 先生成数据
python build.py

# 2) 起本地预览服务器（带 SPA fallback）
python dev.py            # 默认 8080，被占用时自动 +1
python dev.py 9000       # 指定端口

# 然后任意路径都能直接刷新：
#   http://localhost:8080/
#   http://localhost:8080/games
#   http://localhost:8080/games/Lumen
#   http://localhost:8080/about
```

如果你只想验证资源完整性，也可以临时用 `python -m http.server`，
但只有访问根路径 `/` 才能正常进入 SPA，刷新子路径会 404。

### 自检脚本

`verify.py` 会做一次端到端的资源 / 配置 / 模板一致性校验，新增游戏后建议跑一次：

```bash
python verify.py
```

## 4. 部署到 GitHub Pages

### 方式 A：自定义域名根部署（推荐，amopixel.com）

URL 形如 `https://amopixel.com/games`。

1. 在 GitHub 创建仓库，将本目录推送上去
2. 仓库 Settings → Pages → Source 选择 **GitHub Actions**
3. 将自定义域名 `amopixel.com` 在 DNS 提供商处指向 GitHub Pages
4. 推送代码后，`.github/workflows/deploy.yml` 会自动跑 `build.py` 并部署

`CNAME` 文件已包含 `amopixel.com`，无需手动在 Pages 设置里再填一遍。

`index.html` 与 `404.html` 中的 `<base href="/" />` 保持默认即可。

### 方式 B：GitHub Pages 项目页面（带子路径）

URL 形如 `https://用户名.github.io/amopixel/games`。

只需要改 **2 个地方**，整个项目就会自动适配子路径——其他代码全部基于
`<base href>` 自动解析，无须再动：

1. **`index.html`**：`<base href="/" />` → `<base href="/amopixel/" />`
2. **`404.html`**：`<base href="/" />` → `<base href="/amopixel/" />`

如果你要部署到不同名字的仓库，把 `/amopixel/` 换成 `/<repo-name>/`（开头与
结尾都要保留 `/`）即可。

> 同时记得：使用方式 B 时**删除 `CNAME` 文件**（CNAME 是给自定义域名用的，
> 子路径部署不需要）。

### 本地仿真子路径部署

```bash
python dev.py --base /amopixel/
# 浏览器打开 http://localhost:8080/amopixel/
```

`dev.py` 会模拟 GitHub Pages 的子路径行为，让本地体验和线上一致。

## 5. 配置文件说明

### `data/home.json`
```json
{
  "hero": {
    "type": "image",        // "image" 或 "video"
    "src": "assets/home/hero.jpg",
    "poster": "assets/home/hero-poster.jpg"   // 仅视频时可选
  }
}
```

### `data/about.json`
```json
{
  "title": "关于我",
  "paragraphs": [
    "段落 1，可使用 **粗体** 与 *斜体* 与 [链接](https://example.com)。",
    "段落 2 ……"
  ]
}
```

## 6. 浏览器兼容

- 现代 Chrome / Edge / Firefox / Safari
- 移动端 iOS Safari / Android Chrome
- 不支持 IE
