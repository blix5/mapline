import React from 'react';
import styles from '../../styles/timeline/timelineSkeleton.module.css';

// Only used during a route transition. Once Home mounts it draws its own gridlines from
// getStaticProps data with no async gate, so nothing on the real page needs this.
export default function TimelineGridSkeleton() {
  return (
    <div className={styles.grid} aria-hidden="true">
      <div className={styles.axis} />
    </div>
  );
}
