// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: '博客维护',
      collapsed: false,
      items: ['blog/write-new-post'],
    },
    {
      type: 'category',
      label: '站点部署',
      collapsed: false,
      items: ['deploy/cloudflare-pages'],
    },
  ],
};

export default sidebars;
