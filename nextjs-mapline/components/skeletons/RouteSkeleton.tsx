import React, { useEffect, useRef, useState } from 'react';
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

// Must match the fade in .hidden. The shapes stay mounted for this long after the route
// completes so they dissolve over the real page instead of being yanked, which left the
// overlay's ground fading on its own and read as an intentional dark flash.
const FADE_MS = 300;

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
  const [lingering, setLingering] = useState(false);
  // Mirrors `painted` so the effect can branch on it without taking it as a dependency:
  // re-running this effect on every paint change would restart the fade timer.
  const paintedRef = useRef(false);
  // The destination outlives `navigatingTo`, which is nulled the instant the route
  // completes - the shapes need to know what they were still drawing while they fade.
  const lastPath = useRef('/');

  useEffect(() => {
    if (navigatingTo === null) {
      if (!paintedRef.current) {
        setLingering(false);
        return undefined;
      }
      paintedRef.current = false;
      setPainted(false);
      setLingering(true);
      const timer = setTimeout(() => setLingering(false), FADE_MS);
      return () => clearTimeout(timer);
    }
    lastPath.current = navigatingTo.split('?')[0];
    setLingering(false);
    const timer = setTimeout(() => {
      paintedRef.current = true;
      setPainted(true);
    }, PAINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [navigatingTo]);

  const visible = navigatingTo !== null && painted;
  // Kept mounted through the fade-out; `visible` still drives the aria state, so a
  // screen reader hears the same thing at the same time as before.
  const mounted = visible || lingering;
  const path = navigatingTo ? navigatingTo.split('?')[0] : lastPath.current;

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
        {mounted && skeletonFor(lastPath.current)}
      </div>
    </div>
  );
}
