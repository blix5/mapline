import React, { useEffect, useState } from 'react';
import skeleton from '../../styles/skeleton.module.css';
import utilStyles from '../../styles/utils.module.css';
import SourcesSkeleton from './SourcesSkeleton';
import ProseSkeleton from './ProseSkeleton';
import HistoryShellSkeleton from './HistoryShellSkeleton';

type Props = { navigatingTo: string | null };

// A cached destination chunk can resolve in a handful of milliseconds. Painting a
// skeleton in that window is a flash, not a loading state, so hold it back briefly -
// the usual "no spinner for sub-200ms loads" rule.
const PAINT_DELAY_MS = 140;

function skeletonFor(path: string) {
  switch (path) {
    case '/':
      return <HistoryShellSkeleton />;
    case '/sources':
      return <SourcesSkeleton />;
    // /about and anything else gets the prose shape, which is closer to those pages than
    // a list of rows would be.
    default:
      return <ProseSkeleton />;
  }
}

function labelFor(path: string) {
  if (path === '/') return 'Loading map data';
  if (path === '/sources') return 'Loading sources';
  return 'Loading';
}

// Replaces LoadingOverlay at the _app level. Same trigger (router events, owned by
// _app), but the placeholder now has the shape of the page that is arriving.
export default function RouteSkeleton({ navigatingTo }: Props) {
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    if (navigatingTo === null) {
      setPainted(false);
      return;
    }
    const timer = setTimeout(() => setPainted(true), PAINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [navigatingTo]);

  const visible = navigatingTo !== null && painted;
  const path = navigatingTo ? navigatingTo.split('?')[0] : '/';

  return (
    <div
      className={`${skeleton.overlay} ${visible ? '' : skeleton.hidden}`}
      // The shapes are decorative - a screen reader walking dozens of empty blocks would
      // be worse than silence. One status message carries the state instead, which is
      // what the overlay this replaces did with role="status" + aria-live.
      aria-hidden={!visible}
      aria-busy={visible}
    >
      <span className={utilStyles.srOnly} role="status" aria-live="polite">
        {visible ? labelFor(path) : 'Ready'}
      </span>
      <div aria-hidden="true" style={{ height: '100%' }}>
        {visible && skeletonFor(path)}
      </div>
    </div>
  );
}
