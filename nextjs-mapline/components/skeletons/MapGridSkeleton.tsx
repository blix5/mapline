import React from 'react';
import styles from '../../styles/map/mapSkeleton.module.css';

type Props = { hidden?: boolean };

// Rendered in two places, like the overlay it replaces: _app puts it up the moment a
// route change toward / starts, and Home keeps it up until the map's first data tier
// lands. Same component both times, so the hand-off has no seam.
export default function MapGridSkeleton({ hidden = false }: Props) {
  return (
    <div className={`${styles.grid} ${hidden ? styles.gridHidden : ''}`} aria-hidden="true" />
  );
}
