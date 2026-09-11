import React from 'react';
import Head from 'next/head';
import Image from 'next/image';
import styles from './layout.module.css';
import Link from 'next/link';

export const siteTitle = 'Mapline';
const siteDescription =
  'A map and timeline of United States history — a study tool for APUSH, with events ' +
  'plotted in both time and space.';

// Absolute URLs are required for OG images. Set NEXT_PUBLIC_SITE_URL to the deployed
// origin; without it the tag is omitted rather than shipped pointing somewhere wrong.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

const NAV = [
  { key: 'history', href: '/', label: 'HISTORY' },
  { key: 'about', href: '/about', label: 'ABOUT' },
  { key: 'sources', href: '/sources', label: 'SOURCES' },
];

type LayoutProps = {
  children: React.ReactNode;
  page: string;
  title?: string;
  description?: string;
};

export default function Layout({ children, page, title, description }: LayoutProps) {
  const pageTitle = title ? `${title} · ${siteTitle}` : siteTitle;
  const pageDescription = description || siteDescription;

  return (
    <div className={styles.container}>
      <Head>
        <title>{pageTitle}</title>
        <link rel="icon" href="/icon_dark.ico" />
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:site_name" content={siteTitle} />
        <meta property="og:type" content="website" />
        {siteUrl && <meta property="og:image" content={`${siteUrl}/images/logo_dark.png`} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
      </Head>

      <header className={styles.header}>
        <Link className={`${styles.link} ${styles.logoContainer}`} href="/">
          <Image
            className={styles.logo}
            src="/images/logo_dark.png"
            height={100}
            width={300}
            priority
            alt="Mapline"
          />
        </Link>

        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => {
            const current = page === item.key;
            return (
              <Link
                key={item.key}
                className={styles.link}
                href={item.href}
                aria-current={current ? 'page' : undefined}
              >
                {/* The class list used to interpolate the string "false" on every
                    inactive item, because `cond && styles.x` yields false, not ''. */}
                <div className={`${styles.headButton} ${current ? styles.selHeadButton : ''}`}>
                  {item.label}
                  <svg
                    className={`${styles.headUl} ${current ? styles.selHeadUl : ''}`}
                    width="8rem"
                    height="0.25rem"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <rect width="8rem" height="0.3rem" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </nav>
      </header>

      <main className={page !== 'history' ? styles.main : undefined}>{children}</main>
    </div>
  );
}
