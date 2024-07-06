import Head from 'next/head';
import Image from 'next/image';
import styles from './layout.module.css';
import utilStyles from '../styles/utils.module.css';
import Link from 'next/link';

const name = 'US4D';
export const siteTitle = 'US4D';

export default function Layout({ children, page }) {
  return (
    <div className={styles.container}>
      <Head>
        <link rel="icon" href="/icon.ico" />
        <meta
          name="description"
          content="US4D - History, now in time *and* space."
        />
        <meta
          property="og:image"
          content={`https://og-image.vercel.app/${encodeURI(
            siteTitle,
          )}.png?theme=light&md=0&fontSize=75px&images=https%3A%2F%2Fassets.vercel.com%2Fimage%2Fupload%2Ffront%2Fassets%2Fdesign%2Fnextjs-black-logo.svg`}
        />
        <meta name="og:title" content={siteTitle} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <header className={styles.header}>
        <Link className={`${styles.link} ${styles.logoContainer}`} href={page == "history" ? "javascript:void(0);" : "/"}>
          <Image className={styles.logo}
            src="/images/logo_dark.png"
            height={300}
            width={900}
            alt="MAPLINE"
          />
        </Link>
        <Link className={styles.link} href={page == "history" ? "javascript:void(0);" : "/"}>
          <div className={`${styles.headButton} ${page == "history" && styles.selHeadButton}`}>
            HISTORY
            <svg className={`${styles.headUl} ${page == "history" && styles.selHeadUl}`} width="8rem" height="0.25rem">
              <rect width="8rem" height="0.3rem"/>
            </svg>
          </div>
        </Link>
        <Link className={styles.link} href={page == "about" ? "javascript:void(0);" : "/about"}>
          <div className={`${styles.headButton} ${page == "about" && styles.selHeadButton}`}>
            ABOUT
            <svg className={`${styles.headUl} ${page == "about" && styles.selHeadUl}`} width="8rem" height="0.25rem">
              <rect width="8rem" height="0.3rem"/>
            </svg>
          </div>
        </Link>
        <Link className={styles.link} href={page == "sources" ? "javascript:void(0);" : "/sources"}>
          <div className={`${styles.headButton} ${page == "sources" && styles.selHeadButton}`}>
            SOURCES
            <svg className={`${styles.headUl} ${page == "sources" && styles.selHeadUl}`} width="8rem" height="0.25rem">
              <rect width="8rem" height="0.3rem"/>
            </svg>
          </div>
        </Link>
      </header>
      <main>
        <div className={`${page != "history" && styles.main}`}>{children}</div>
      </main>
    </div>
  );
}