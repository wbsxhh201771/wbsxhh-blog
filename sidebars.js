// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'SRE Agent 调研材料',
      collapsed: false,
      link: {type: 'doc', id: 'research/index'},
      items: [
        'research/datadog-bits-ai',
        'research/komodor',
        'research/dash0',
        'research/cleric-ai',
        'research/anthropic-sre-agent',
        'research/bytedance-sre-agent',
      ],
    },
    {
      type: 'category',
      label: '博客维护',
      collapsed: true,
      items: ['blog/write-new-post'],
    },
    {
      type: 'category',
      label: '站点部署',
      collapsed: true,
      items: ['deploy/cloudflare-pages'],
    },
  ],
};

export default sidebars;
