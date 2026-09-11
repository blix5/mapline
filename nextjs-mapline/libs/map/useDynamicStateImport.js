import { useEffect, useState } from 'react';

// Module-scope cache shared by every component instance. Previously each instance kept
// its result in its own useRef, so every one of the ~860 event rows paid for its own
// import() round trip plus a setLoading(true)/setLoading(false) pair — two extra renders
// each — and remounting re-ran the whole cycle, flashing an empty string in between.
const cache = new Map();
const inFlight = new Map();

const load = (name) => {
  if (cache.has(name)) return Promise.resolve(cache.get(name));
  if (!inFlight.has(name)) {
    inFlight.set(name, import(/* webpackMode: "lazy" */ `../../public/map/states/${name.substring(0, 2)}/${name.toLowerCase().replace('_', '-')}.svg`)
      .then((module) => {
        cache.set(name, module.default);
        inFlight.delete(name);
        return module.default;
      })
      .catch((error) => {
        inFlight.delete(name);
        throw error;
      }));
  }
  return inFlight.get(name);
};

export default function useDynamicStateImport(name, options = {}) {
  const { onCompleted, onError } = options;
  // Read synchronously when it is already cached: no loading state, no flash.
  const [SvgIcon, setSvgIcon] = useState(() => cache.get(name) ?? null);
  const [loading, setLoading] = useState(() => !cache.has(name));
  const [error, setError] = useState();

  useEffect(() => {
    const cached = cache.get(name);
    if (cached) {
      setSvgIcon(() => cached);
      setLoading(false);
      if (onCompleted) onCompleted(name, cached);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    load(name).then(
      (component) => {
        if (cancelled) return;
        setSvgIcon(() => component);
        setLoading(false);
        if (onCompleted) onCompleted(name, component);
      },
      (err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
        if (onError) onError(err);
      },
    );
    return () => { cancelled = true; };
  }, [name, onCompleted, onError]);

  return { error, loading, SvgIcon };
}
