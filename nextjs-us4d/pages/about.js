import Head from 'next/head';
import Layout, { siteTitle } from '../components/layout';
import utilStyles from '../styles/utils.module.css';
import Link from 'next/link';
import Date from '../components/date';

export default function About() {
  return (
    <Layout page="about">
      <Head>
        <title>{siteTitle}</title>
      </Head>
      <section className={utilStyles.aboutHeadMd}>
        <p>History, now in time <span className={utilStyles.bold}>and</span> space.</p>
      </section>

      <section className={`${utilStyles.headingMd} ${utilStyles.padding1px}`}>
        <h2 className={utilStyles.headingLg}>pages</h2>
      </section>
    </Layout>
  );
}