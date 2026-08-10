import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: '博客',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        记录技术观点、思考与实践复盘。
        <br />
        <Link to="/blog">进入博客 →</Link>
      </>
    ),
  },
  {
    title: '文档',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        博客文章的详细技术补充与参考手册。
        <br />
        <Link to="/docs/intro">查看文档 →</Link>
      </>
    ),
  },
  {
    title: 'GitHub',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        开源项目与代码仓库。
        <br />
        <a href="https://github.com/wbsxhh201771?tab=repositories" target="_blank" rel="noopener noreferrer">
          wbsxhh201771 →
        </a>
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
