import Link from 'next/link';
import Layout from '../components/layout';
import utilStyles from '../styles/utils.module.css';

// Was a bare <h1> with no Layout — no nav, no font, no way back to the site.
export default function Custom404() {
  return (
    <Layout page="404" title="Page not found" description="This page doesn't exist.">
      <h1 className={utilStyles.headingLg} style={{ paddingTop: '2rem' }}>404 — page not found</h1>
      <p>That page doesn&apos;t exist.</p>
      <p>
        <Link className={utilStyles.inlineLink} href="/">
          Back to the timeline
        </Link>
      </p>
    </Layout>
  );
}
