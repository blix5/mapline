import React from 'react';
import skeleton from '../../styles/skeleton.module.css';
import styles from '../../styles/sourcesSkeleton.module.css';

// Deterministic, not random: a Math.random() width here would differ between the server
// render and the client hydration and trip a mismatch warning.
const NAME_WIDTHS = ['82%', '54%', '71%', '45%', '88%', '63%'];

// The real .intro wraps to three lines at the 46rem column width.
const INTRO_WIDTHS = ['100%', '100%', '43%'];

const SECTIONS = 4;

// /sources gets its data from getStaticProps, so this is only ever on screen during a
// client-side route transition - it is never morphed into real content, it is unmounted
// as the real page mounts. That is why the row count is chosen to fill a viewport rather
// than to match the real number of entries per period.
export default function SourcesSkeleton() {
  return (
    <div className={styles.main}>
      <div className={styles.page}>
      <div className={`${skeleton.block} ${styles.heading}`} />

      <div className={styles.intro}>
        {INTRO_WIDTHS.map((width, i) => (
          <div key={i} className={`${skeleton.block} ${styles.introLine}`} style={{ width }} />
        ))}
      </div>

      <div className={styles.controls}>
        <div className={`${skeleton.block} ${styles.filter}`} />
        <div className={`${skeleton.block} ${styles.count}`} />
      </div>

      {[...Array(SECTIONS)].map((_, s) => (
        <section key={s} className={styles.period}>
          <div className={styles.periodHeading}>
            <div className={`${skeleton.block} ${styles.periodLabel}`} />
            <div className={`${skeleton.block} ${styles.periodRange}`} />
            <div className={`${skeleton.block} ${styles.periodCount}`} />
          </div>
          <ul className={styles.list}>
            {NAME_WIDTHS.map((width, r) => (
              <li key={r} className={styles.entry}>
                <div className={`${skeleton.block} ${styles.chip}`} />
                <div className={`${skeleton.block} ${styles.name}`} style={{ width }} />
                <div className={`${skeleton.block} ${styles.date}`} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      </div>
    </div>
  );
}
