---
sidebar_position: 2
---

# 编写与发布新文章

> 本文面向**站点维护者**，说明如何在本博客中新增、编辑和发布文章。

## 文章存放位置

所有博客文章放在项目根目录的 `blog/` 文件夹下，每个文件对应一篇文章：

```
blog/
├── authors.yml          # 作者信息
├── tags.yml             # 标签定义（可选）
└── YYYY-MM-DD-文章slug.md   # 文章正文
```

**文件命名建议**：`日期-slug.md`，例如 `2026-08-10-my-first-post.md`。日期会用于排序和 URL。

## 新建一篇文章

### 1. 创建 Markdown 文件

在 `blog/` 下新建 `.md` 文件，开头写 **Front Matter**（YAML 元数据）：

```md
---
slug: my-first-post
title: 文章标题
authors: [wbsxhh]
tags: [sre, agent]
date: 2026-08-10
---

正文从这里开始……
```

| 字段 | 必填 | 说明 |
|------|:----:|------|
| `title` | ✅ | 文章标题，显示在列表和页面顶部 |
| `authors` | ✅ | 作者 key，需在 `authors.yml` 中已定义 |
| `date` | ✅ | 发布日期，`YYYY-MM-DD` |
| `slug` | 可选 | 自定义 URL 路径，不写则用文件名 |
| `tags` | 可选 | 标签列表，需在 `tags.yml` 中定义（或自动创建） |

### 2. 编写正文

- 使用标准 **Markdown** 语法（标题、列表、代码块、表格、链接等）
- 代码块请标注语言，例如 ` ```bash `、` ```go `
- 需要**列表页摘要截断**时，在合适位置插入：

```md
{/* truncate */}
```

截断符**上方**的内容会显示在博客列表页，下方仅在文章详情页展示。

> 注意：本站使用 MDX 渲染，HTML 注释 `<!-- -->` 不可用，请用 `{/* */}` 格式。

### 3. 关联文档（可选）

若文章有详细技术补充，可在 `docs/` 下新建对应文档，并在文章末尾添加链接：

```md
---

**延伸阅读**：[详细说明](/docs/xxx/yyy)
```

文档侧边栏在 `sidebars.js` 中配置。

## 作者与标签

### 作者 `blog/authors.yml`

```yaml
wbsxhh:
  name: wbsxhh
  page: true
```

- `name`：显示名称
- `page: true`：生成作者页 `/blog/authors/wbsxhh`
- 不要设置 `title`，否则名字旁会出现小字副标题

### 标签 `blog/tags.yml`

预定义标签的描述（可选）：

```yaml
sre:
  label: SRE
  description: Site Reliability Engineering 实践

agent:
  label: Agent
  description: AI Agent 相关
```

Front Matter 里写 `tags: [sre, agent]` 即可关联。标签会显示在文章页，但本站**不设独立标签导航页**。

## 本地预览

```bash
# 安装依赖（首次）
npm install

# 启动开发服务器，支持热更新
npm start
```

浏览器打开 http://localhost:3000/blog 查看效果。修改 `blog/` 或 `docs/` 下的文件会自动刷新。

## 发布流程

```bash
# 1. 确认构建无误
npm run build

# 2. 提交到 Git
git add blog/ docs/
git commit -m "blog: 新增 xxx 文章"
git push

# 3. Cloudflare Pages 会自动构建部署
```

部署配置详见 [Cloudflare Pages 部署](/docs/deploy/cloudflare-pages)。

## 目录关系速查

| 想做的事 | 改哪里 |
|----------|--------|
| 新增/改文章 | `blog/*.md` |
| 改作者信息 | `blog/authors.yml` |
| 改标签描述 | `blog/tags.yml` |
| 新增技术文档 | `docs/` + `sidebars.js` |
| 改导航/站点名 | `docusaurus.config.js` |
| 改首页文案 | `src/pages/index.js`、`src/components/HomepageFeatures/` |
