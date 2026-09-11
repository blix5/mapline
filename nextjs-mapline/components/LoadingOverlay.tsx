import React from 'react';
import Image from 'next/image';
import styles from '../styles/loading.module.css';

type Props = { visible: boolean; label?: string };

// Rendered in two places: _app shows it the moment a route change starts, and the
// timeline page keeps it up until the map's first data tier has landed. They are the
// same markup, so the hand-off between them is invisible.
export default function LoadingOverlay({ visible, label = 'Loading' }: Props) {
  return (
    <div
      className={`${styles.overlay} ${visible ? '' : styles.hidden}`}
      aria-hidden={!visible}
      role="status"
      aria-live="polite"
    >
      <Image
        className={styles.mark}
        src="/images/logo_dark.png"
        width={300}
        height={100}
        priority
        alt=""
      />
      <div className={styles.bar}>
        <div className={styles.barFill} />
      </div>
      <span className={styles.label}>{visible ? label : 'Ready'}</span>
    </div>
  );
}
