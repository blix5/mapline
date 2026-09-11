import { useEffect, useState } from 'react';

// Module-scope cache shared by every component instance. Previously each instance kept
// its result in its own useRef, so every one of the ~860 event rows paid for its own
// import() round trip plus a setLoading(true)/setLoading(false) pair — two extra renders
// each — and remounting re-ran the whole cycle, flashing an empty string in between.
const cache = new Map();
const inFlight = new Map();

const load = (filter) => {
  if (cache.has(filter)) return Promise.resolve(cache.get(filter));
  if (!inFlight.has(filter)) {
    inFlight.set(filter, import(/* webpackMode: "lazy" */ `../public/timeline/filter/${filter}.svg`)
      .then((module) => {
        cache.set(filter, module.default);
        inFlight.delete(filter);
        return module.default;
      })
      .catch((error) => {
        inFlight.delete(filter);
        throw error;
      }));
  }
  return inFlight.get(filter);
};

export default function useDynamicFilterImport(filter, options = {}) {
  const { onCompleted, onError } = options;
  // Read synchronously when it is already cached: no loading state, no flash.
  const [SvgIcon, setSvgIcon] = useState(() => cache.get(filter) ?? null);
  const [loading, setLoading] = useState(() => !cache.has(filter));
  const [error, setError] = useState();

  useEffect(() => {
    const cached = cache.get(filter);
    if (cached) {
      setSvgIcon(() => cached);
      setLoading(false);
      if (onCompleted) onCompleted(filter, cached);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    load(filter).then(
      (component) => {
        if (cancelled) return;
        setSvgIcon(() => component);
        setLoading(false);
        if (onCompleted) onCompleted(filter, component);
      },
      (err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
        if (onError) onError(err);
      },
    );
    return () => { cancelled = true; };
  }, [filter, onCompleted, onError]);

  return { error, loading, SvgIcon };
}
