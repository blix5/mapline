import { useEffect, useState } from 'react';

// Module-scope cache shared by every component instance. Previously each instance kept
// its result in its own useRef, so every one of the ~860 event rows paid for its own
// import() round trip plus a setLoading(true)/setLoading(false) pair — two extra renders
// each — and remounting re-ran the whole cycle, flashing an empty string in between.
const cache = new Map();
const inFlight = new Map();

const load = (icon) => {
  if (cache.has(icon)) return Promise.resolve(cache.get(icon));
  if (!inFlight.has(icon)) {
    inFlight.set(icon, import(/* webpackMode: "lazy" */ `../public/images/${icon}.svg`)
      .then((module) => {
        cache.set(icon, module.default);
        inFlight.delete(icon);
        return module.default;
      })
      .catch((error) => {
        inFlight.delete(icon);
        throw error;
      }));
  }
  return inFlight.get(icon);
};

export default function useDynamicIconImport(icon, options = {}) {
  const { onCompleted, onError } = options;
  // Read synchronously when it is already cached: no loading state, no flash.
  const [SvgIcon, setSvgIcon] = useState(() => cache.get(icon) ?? null);
  const [loading, setLoading] = useState(() => !cache.has(icon));
  const [error, setError] = useState();

  useEffect(() => {
    const cached = cache.get(icon);
    if (cached) {
      setSvgIcon(() => cached);
      setLoading(false);
      if (onCompleted) onCompleted(icon, cached);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    load(icon).then(
      (component) => {
        if (cancelled) return;
        setSvgIcon(() => component);
        setLoading(false);
        if (onCompleted) onCompleted(icon, component);
      },
      (err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
        if (onError) onError(err);
      },
    );
    return () => { cancelled = true; };
  }, [icon, onCompleted, onError]);

  return { error, loading, SvgIcon };
}
