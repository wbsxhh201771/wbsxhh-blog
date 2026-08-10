// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'wbsxhh 的 blog',
  tagline: '个人技术笔记与项目实践',
  favicon: 'img/logo.jpg',

  future: {
    v4: true,
  },

  url: 'https://wbsxhh-blog.pages.dev',
  baseUrl: '/',

  organizationName: 'wbsxhh201771',
  projectName: 'wbsxhh-blog',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: 'docs',
        },
        blog: {
          showReadingTime: true,
          blogTitle: 'wbsxhh 的 blog',
          blogDescription: 'wbsxhh 的个人技术博客',
          postsPerPage: 10,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        defaultMode: 'light',
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'wbsxhh 的 blog',
        logo: {
          alt: 'wbsxhh logo',
          src: 'img/logo.jpg',
          width: 36,
          height: 36,
        },
        items: [
          {to: '/blog', label: '博客', position: 'left'},
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: '文档',
          },
          {to: '/docs/intro', label: '关于', position: 'left'},
          {
            href: 'https://github.com/wbsxhh201771',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: '站点',
            items: [
              {label: '博客', to: '/blog'},
              {label: '关于', to: '/docs/intro'},
              {label: '技术文档', to: '/docs/deploy/cloudflare-pages'},
            ],
          },
          {
            title: '链接',
            items: [
              {label: 'GitHub', href: 'https://github.com/wbsxhh201771?tab=repositories'},
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} wbsxhh. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'go', 'yaml', 'promql'],
      },
    }),
};

export default config;
