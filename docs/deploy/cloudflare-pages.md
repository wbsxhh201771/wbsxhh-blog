---
sidebar_position: 1
---

# Cloudflare Pages 部署

> 本文是[关于](/docs/intro)中「文档 = 博客技术补充」的一部分，面向**站点维护者**，记录本博客的部署方式。

本文介绍如何将本 Docusaurus 站点部署到 [Cloudflare Pages](https://pages.cloudflare.com/)。

## 前置条件

- Cloudflare 账号
- 代码托管在 GitHub
- Node.js >= 20

## 方式一：Git 集成（推荐）

### 1. 推送代码到 Git 仓库

```bash
git init
git add .
git commit -m "init: your blog"
git remote add origin git@github.com:your/your-blog.git
git push -u origin main
```

### 2. 在 Cloudflare Dashboard 创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. 选择 GitHub 并授权，选中 `wbsxhh-blog` 仓库
4. 配置构建设置：

| 配置项 | 值 |
|--------|-----|
| **Production branch** | `main` |
| **Framework preset** | `None` |
| **Build command** | `npm run build` |
| **Build output directory** | `build` |

### 3. 环境变量（可选）

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NODE_VERSION` | `20` | 指定 Node.js 版本 |

### 4. 保存并部署

部署完成后访问 `https://<project-name>.pages.dev`，或在 **Custom domains** 绑定自定义域名。

## 方式二：Wrangler CLI 本地部署

```bash
npm install -g wrangler
wrangler login
npm run build
npx wrangler pages deploy build --project-name=wbsxhh-blog
```

## 常见问题

### Node 版本

在项目根目录添加 `.node-version`（已配置为 `20`），或设置环境变量 `NODE_VERSION=20`。

### baseUrl 与自定义域名

本站点使用根路径部署：

```js
// docusaurus.config.js
baseUrl: '/',
url: 'https://wbsxhh-blog.pages.dev',
```

若部署到子路径（如 `example.com/blog/`），需同步修改 `baseUrl`。

## 部署检查清单

- [ ] `npm run build` 本地构建成功
- [ ] Cloudflare 构建命令为 `npm run build`，输出目录为 `build`
- [ ] `docusaurus.config.js` 中 `url` 与最终访问地址一致

## 参考链接

- [Docusaurus 部署文档](https://docusaurus.io/docs/deployment)
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
