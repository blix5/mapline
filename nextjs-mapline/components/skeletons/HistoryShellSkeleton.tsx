import React, { useState } from 'react';
import styles from '../../styles/historyShellSkeleton.module.css';
import MapGridSkeleton from './MapGridSkeleton';
import TimelineGridSkeleton from './TimelineGridSkeleton';

// Mirrors URL_STATE_DEFAULTS.div in pages/index.tsx.
const DEFAULT_SPLIT = 0.6;

// Home restores the divider position from the `div` query param, so a user who has
// dragged it would see the split jump the moment Home mounts if this used the default.
// Reading the same param here costs one URLSearchParams parse and removes the jump.
function splitFromUrl() {
  if (typeof window === 'undefined') return DEFAULT_SPLIT;
  const raw = new URLSearchParams(window.location.search).get('div');
  const parsed = Number(raw);
  // Guard the same way Home does: ignore anything non-finite or outside the drag range.
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) return DEFAULT_SPLIT;
  return parsed;
}

// The / route's placeholder while Next fetches the page chunk. Uses the same grid
// components Home renders, so when Home takes over there is no visual seam.
export default function HistoryShellSkeleton() {
  // Lazy initialiser: this component only ever mounts client-side (it is rendered in
  // response to a router event), so there is no server render to mismatch against.
  const [split] = useState(splitFromUrl);

  return (
    <div className={styles.shell}>
      <div className={styles.mapPane} style={{ flex: `0 0 ${split * 100}%` }}>
        <MapGridSkeleton />
      </div>
      <div className={styles.timelinePane}>
        <TimelineGridSkeleton />
      </div>
    </div>
  );
}
