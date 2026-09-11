import React from 'react';
import skeleton from '../../styles/skeleton.module.css';
import styles from '../../styles/proseSkeleton.module.css';

// Deterministic widths, for the same hydration reason as SourcesSkeleton.
const LEDE = ['100%', '96%', '58%'];
const SECTIONS = [
  ['100%', '92%', '71%'],
  ['100%', '86%', '94%', '48%'],
  ['100%', '64%'],
];

// Used for /about, and as the fallback for any route without a skeleton of its own.
export default function ProseSkeleton() {
  return (
    <div className={styles.main}>
      <div className={styles.page}>
      <div className={`${skeleton.block} ${styles.heading}`} />

      <div className={styles.lede}>
        {LEDE.map((width, i) => (
          <div key={i} className={`${skeleton.block} ${styles.ledeLine}`} style={{ width }} />
        ))}
      </div>

      {SECTIONS.map((lines, s) => (
        <section key={s} className={styles.section}>
          <div className={`${skeleton.block} ${styles.sectionHeading}`} />
          <div className={styles.sectionRule} />
          {lines.map((width, i) => (
            <div key={i} className={`${skeleton.block} ${styles.bodyLine}`} style={{ width }} />
          ))}
        </section>
      ))}
      </div>
    </div>
  );
}
