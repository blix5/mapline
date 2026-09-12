import React, { useMemo, useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';
import Image from 'next/image';
import ReactLink from 'next/link';

import Draggable, {DraggableCore} from 'react-draggable';
import debounce from 'lodash.debounce';
import styled from 'styled-components';
import { Link, Button, Element, Events, animateScroll as scroll, scrollSpy } from 'react-scroll';
import Fuse from 'fuse.js';

import Date from '../components/date';
import useWindowDimensions from '../components/useWindowDimensions';
import Layout from '../components/layout';

import utilStyles from '../styles/utils.module.css';
import mapStyles from '../styles/map/map.module.css';
import infoStyles from '../styles/map/info.module.css';
import stateStyles from '../styles/map/states.module.css';
import timelineStyles from '../styles/timeline/timeline.module.css';
import MapGridSkeleton from '../components/skeletons/MapGridSkeleton';

import { getSheetData } from '../libs/sheets';

import State from '../libs/map/State';
import MapSvg from '../libs/map/MapSvg';
import { useMapDataReady, useMapBaseDrawn, LowProjectionLCC, LowTopProjectionLCC, MediumProjectionLCC, MediumTopProjectionLCC, MediumTopLabelProjectionLCC, MediumTopRiverLabelProjectionLCC, HighTopLabelProjectionLCC, latLonToX, latLonToY } from '../libs/map/LambertConformalConicMap';
import FilterIcon from '../libs/FilterIcon';
import Icon from '../libs/Icon';

import HoverVisibleDiv from '../libs/HoverVisibleDiv';

import { convertDecimalYearToDate, convertDateToDecimal } from '../libs/dateDecimal';
import categoryToIndex from '../libs/categoryIndex';
import { dateFilterRender, convertDate } from '../libs/dateFilterRender';
import UrlToAbstract from '../libs/wikipediaAbstract';

import compassDimensions from '../libs/map/mapUtils';

export async function getStaticProps(context) {
  // One batchGet for all three tabs, instead of three sequential requests each
  // preceded by its own OAuth handshake.
  const { states, events, locations } = await getSheetData();
  return {
    props: {
      // slice(1) drops each tab's header row.
      states: states.slice(1),
      locations: locations.slice(1),
      events: events.slice(1),
    },
    // Was 1, which made the page stale after a second and turned almost every request
    // into a background regeneration (and another round of Sheets calls).
    revalidate: 300,
  };
}

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Same shape as the query string, so a nav back to a bare "/" can restore from here and
// the merge is one fallback per key. Session-scoped: a visit tomorrow starts clean.
const VIEW_STORAGE_KEY = 'mapline:view:v1';

// Keys mirrored into the query string, and the defaults used before restore.
const URL_STATE_DEFAULTS = {
  div: 0.6,
  mpx: -1450,
  mpy: -275,
  mps: 1,
  tpx: 0,
  tpy: 0,
  tps: 100,
  year: 1776.5,
};

// Card opacity from importance. The old mapping (importance / 9 + 0.4) bottomed out at
// 0.51, and compositing a card over the timeline background at 0.51 dropped even the
// reworked palette to ~3.2:1 — below AA. A 0.80 floor keeps the worst pairing at 5.88:1.
// Keep this to a small set of discrete values: styled-components mints a stylesheet rule
// per distinct interpolation result (see libs/HoverVisibleDiv.tsx).
// Clicking an event fires two simultaneous 500ms smooth scrolls across the whole
// viewport, which is exactly the kind of motion that triggers vestibular symptoms.
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scrollOptions = (horizontal) => ({
  containerId: 'timeline',
  horizontal,
  smooth: !prefersReducedMotion(),
  duration: prefersReducedMotion() ? 0 : 500,
});

// Width of an event box from its measured label, never narrower than the date column.
// Mirrors the original inline expression, but returns the floor (instead of NaN) when
// the element has not been measured yet.
// '' at 'done', which is what stops the intro animations matching anything ever again.
const introMarker = (phase, prefix) =>
  phase === 'idle' ? `${prefix}-pending` : phase === 'running' ? `${prefix}-run` : '';

const labelWidth = (measured, hasEndDate) => {
  const floor = 130 + (hasEndDate ? 70 : 0);
  return (!measured || measured < floor) ? (floor - 1) : (measured - 0.01);
};

export default function Home({ states, locations, events, onCompleted, onError }) {
  const startYear = 1480;
  const endYear = 2024;

  const [inHidden, setInHidden] = useState(-1);
  const { width, height } = useWindowDimensions();
  // Until the map's first data tier lands the map pane is an empty blue rectangle, so a
  // grid stands in for it. The rest of the page renders immediately: the timeline's data
  // comes from getStaticProps and has nothing to wait for.
  const mapDataReady = useMapDataReady();
  // mapDataReady flips on whichever GeoJSON file resolves first, which is not
  // necessarily the tier on screen, and the projections draw with d3 a frame later
  // anyway. This one means there are actually paths in the DOM to reveal.
  const mapBaseDrawn = useMapBaseDrawn();
  // Pan, zoom and both scroll offsets are final. Nothing else means this: urlRestored
  // and pendingScrollRestore are refs (no re-render), and `scrolling` starts true and
  // is re-triggered by the restore, so it is anti-correlated with settled.
  const [positionsSettled, setPositionsSettled] = useState(false);
  const settleArmed = useRef(false);
  const [borderY, setBorderY] = useState(URL_STATE_DEFAULTS.div);

  const [mapX, setMapX] = useState(URL_STATE_DEFAULTS.mpx);
  const [mapY, setMapY] = useState(URL_STATE_DEFAULTS.mpy);
  const [mapScale, setMapScale] = useState(URL_STATE_DEFAULTS.mps);
  const [isDragging, setIsDragging] = useState(false);
  const [mousePos, setMousePos] = useState({ x: null, y: null });
  // Un-throttled, this fired setState on every mousemove and re-rendered the timeline too.
  const mouseFrame = useRef(null);
  const pendingMouse = useRef(null);
  const onMapMouseMove = useCallback((e) => {
    pendingMouse.current = { x: e.clientX, y: e.clientY };
    if (mouseFrame.current === null) {
      mouseFrame.current = requestAnimationFrame(() => {
        mouseFrame.current = null;
        setMousePos(pendingMouse.current);
      });
    }
  }, []);
  useEffect(() => () => {
    if (mouseFrame.current !== null) cancelAnimationFrame(mouseFrame.current);
  }, []);

  const tempMousePos = useRef({x: 0, y: 0});
  const mapMouseDown = (e) => {
    tempMousePos.current = {x: e.clientX, y: e.clientY};
  }
  const mapMouseUp = (e) => {
    const {x, y} = tempMousePos.current;
    if(Math.abs(e.clientX - x) < 2 && Math.abs(e.clientY - y) < 2) {
      setLocSel(null);
      setEventSelected(null);
    }
  }

  const [timeX, setTimeX] = useState(URL_STATE_DEFAULTS.tpx);
  const [timeY, setTimeY] = useState(URL_STATE_DEFAULTS.tpy);
  const [timeScale, setTimeScale] = useState(URL_STATE_DEFAULTS.tps);
  const [timeYear, setTimeYear] = useState(URL_STATE_DEFAULTS.year);

  const mapLimX = 2400;
  const mapLimY = 1280;

  const timeLimX = useMemo(() => (endYear - startYear + 1) * timeScale, [endYear, startYear, timeScale]);
  const timeLimY = 65 * (8 * 2);

  const numberLineRef = useRef(null);
  const timelineRef = useRef(null);
  const eventsRef = useRef<Array<HTMLDivElement | null>>([]);
  const eventsPinRef = useRef<Array<HTMLDivElement | null>>([]);
  const eventsPinDivRef = useRef<Array<HTMLDivElement | null>>([]);

  // Interaction state lives in React state; the query string is mirrored from it on a
  // debounce, so scrolling no longer writes to history on every frame. Restoring runs
  // after mount rather than in the useState initialisers so SSR hydration still matches.
  const urlRestored = useRef(false);
  const pendingScrollRestore = useRef(null);
  // Seeded by the restore below and read by the effect that builds `parents`, which runs
  // later and would otherwise hardcode every entry back to collapsed.
  const restoredExpanded = useRef(null);
  // Suppresses exactly one run of the effect that auto-opens a tab for the selected event.
  const skipAutoOpen = useRef(false);
  // The latest view, mirrored synchronously so the unmount flush has something to write
  // that is not stuck behind the debounce.
  const viewRef = useRef(null);

  const syncUrl = useMemo(() => debounce((next) => {
    const params = new URLSearchParams(window.location.search);
    Object.keys(next).forEach((key) => {
      const value = next[key];
      if (Array.isArray(value)) {
        if (value.length === 0) params.delete(key); else params.set(key, value.join(','));
      } else if (typeof value === 'string') {
        if (value === '') params.delete(key); else params.set(key, value);
      } else if (value == null) {
        // Deleting, not skipping: clearing a selection used to leave its param behind.
        params.delete(key);
      } else if (Number.isFinite(value)) {
        params.set(key, String(Math.round(value * 1000) / 1000));
      }
      // A non-null, non-finite number falls through unwritten, keeping the last good value.
    });
    const query = params.toString();
    // replaceState, not push: the back button should not collect a frame of scrolling.
    window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }, 300), []);
  // cancel, deliberately not flush: at unmount during a route change the router has
  // already moved on, so flushing would stamp the map's query onto /about. The
  // last-write-wins problem is handled by the storage flush instead, which is
  // path-independent and therefore safe.
  useEffect(() => () => syncUrl.cancel(), [syncUrl]);

  const writeView = useCallback((view) => {
    if (!view) return;
    // sessionStorage throws on access in Safari private browsing and wherever site data
    // is blocked. Persistence is a convenience; it must never take the page down.
    try { window.sessionStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ v: 1, ...view })); }
    catch { /* storage unavailable - fall back to the URL alone */ }
  }, []);
  const persistView = useMemo(() => debounce(writeView, 300), [writeView]);

  useEffect(() => {
    const flush = () => writeView(viewRef.current);
    // pagehide rather than beforeunload: it also fires for bfcache eviction.
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      persistView.cancel();
      flush();
    };
  }, [persistView, writeView]);

  // A layout effect, not a passive one: as a passive effect the map painted at the
  // defaults and then jumped to the restored pan/zoom a frame later.
  useIsomorphicLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const readNum = (key) => {
      const raw = params.get(key);
      if (raw === null) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const readStr = (key) => params.get(key);
    const readList = (key) => {
      const raw = params.get(key);
      return raw === null ? null : raw.split(',').filter(Boolean);
    };

    // The nav links are plain hrefs with no query, so coming back from /about lands on a
    // bare "/" and the URL has nothing to say. Storage covers that case, and the logo
    // link, and reload. A shared link still wins wherever it carries a value.
    let stored = null;
    try {
      const raw = window.sessionStorage.getItem(VIEW_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.v === 1) stored = parsed;
    } catch { /* unavailable or corrupt - the URL is still authoritative */ }

    const num = (key) => readNum(key) ?? (Number.isFinite(stored?.[key]) ? stored[key] : null);
    const str = (key) => readStr(key) ?? (typeof stored?.[key] === 'string' ? stored[key] : null);
    const list = (key) => readList(key) ?? (Array.isArray(stored?.[key]) ? stored[key] : []);

    const setters = { div: setBorderY, mpx: setMapX, mpy: setMapY, mps: setMapScale,
                      tpx: setTimeX, tpy: setTimeY, tps: setTimeScale, year: setTimeYear };
    Object.keys(setters).forEach((key) => {
      const value = num(key);
      if (value !== null) setters[key](value);
    });

    // Validated against the props rather than the eventsById/statesById memos: those are
    // declared below this effect, so reading them here would tie correctness to the order
    // of declarations in the file. Ids come from a live sheet, so a stored id can simply
    // stop existing between builds.
    const eventIds = new Set(events.map((event) => event?.id).filter(Boolean));
    const placeIds = new Set([...states.map((state) => state?.id),
                              ...locations.map((location) => location?.id)].filter(Boolean));

    const restoredOpen = list('open').filter((id) => eventIds.has(id));
    const rawEv = str('ev');
    const restoredEv = rawEv !== null && eventIds.has(rawEv) ? rawEv : null;
    const rawTab = str('tab');
    const restoredTab = rawTab !== null && restoredOpen.includes(rawTab)
      ? rawTab
      : (restoredEv !== null && restoredOpen.includes(restoredEv) ? restoredEv : (restoredOpen[0] ?? null));
    const rawLoc = str('loc');
    const restoredLoc = rawLoc !== null && placeIds.has(rawLoc) ? rawLoc : null;

    if (restoredOpen.length) setEventsOpen(restoredOpen);
    if (restoredEv !== null) setEventSelected(restoredEv);
    if (restoredTab !== null) setEventOpenSelected(restoredTab);
    if (restoredLoc !== null) setLocSel(restoredLoc);
    // Not setParents: that effect runs later and rebuilds the list from scratch.
    restoredExpanded.current = new Set(list('exp'));

    // Only skip the auto-open effect when the restore is self-consistent. A hand-written
    // ?ev=x with no open/tab should still behave like a click and open the panel.
    skipAutoOpen.current = restoredEv !== null && restoredOpen.includes(restoredEv) && restoredTab !== null;

    pendingScrollRestore.current = { x: num('tpx') ?? URL_STATE_DEFAULTS.tpx, y: num('tpy') ?? URL_STATE_DEFAULTS.tpy };
    urlRestored.current = true;

    // Stamp the merged view into the address bar now rather than waiting out the sync
    // debounce, so a nav back from /about does not show a bare "/" for 300ms.
    const merged = { div: num('div'), mpx: num('mpx'), mpy: num('mpy'), mps: num('mps'),
                     tpx: num('tpx'), tpy: num('tpy'), tps: num('tps'), year: num('year'),
                     ev: restoredEv, open: restoredOpen, tab: restoredTab, loc: restoredLoc,
                     exp: list('exp') };
    const stamped = new URLSearchParams();
    Object.keys(merged).forEach((key) => {
      const value = merged[key];
      if (Array.isArray(value)) { if (value.length) stamped.set(key, value.join(',')); }
      else if (typeof value === 'string') { if (value) stamped.set(key, value); }
      else if (Number.isFinite(value)) stamped.set(key, String(Math.round(value * 1000) / 1000));
    });
    const stampedQuery = stamped.toString();
    if (stampedQuery) window.history.replaceState(null, '', `${window.location.pathname}?${stampedQuery}`);
  }, []);

  // Scroll containers are restored once, from the URL, rather than being written back
  // on every timeX change (which fed the scroll handler its own output). A layout effect
  // so the restored offset is in place before the first paint.
  useIsomorphicLayoutEffect(() => {
    if (settleArmed.current) return;
    // No width means the very first commit, when the section heights are still NaN.
    if (!width || !height || !timelineRef.current || !numberLineRef.current) return;

    const target = pendingScrollRestore.current;
    if (target) {
      pendingScrollRestore.current = null;
      timelineRef.current.scrollLeft = target.x;
      timelineRef.current.scrollTop = target.y;
      numberLineRef.current.scrollLeft = target.x;
    }

    // Positions count as final once that write has round-tripped. It deliberately does
    // not set echoGuard, so it emits a real scroll event; queueScroll defers that one
    // frame to commitScroll, and commitScroll's setTimeX needs one more to paint. Armed
    // through a ref because this effect has no dependency array - a cancel-and-restart
    // pattern here would be starved by the very commit it is waiting for.
    settleArmed.current = true;
    requestAnimationFrame(() => requestAnimationFrame(() => setPositionsSettled(true)));
  });

  // The load reveal. Two machines, not one: the timeline's events come from
  // getStaticProps and are ready immediately, so making them wait on the map's ~1.1MB
  // of GeoJSON would leave a bare grid on screen for no reason.
  //
  // Three phases rather than a boolean because each does a distinct job. 'idle' holds
  // the animating content at opacity 0 - without it, content paints at full opacity and
  // then restarts from zero, which is a worse flash than the one being fixed. 'done'
  // removes the marker class, and that removal is the whole reason the animations do
  // not re-fire: the timeline virtualises on scroll, so cards mount and unmount
  // constantly, and a mount-triggered animation would otherwise replay forever.
  const [mapIntro, setMapIntro] = useState('idle');
  const [tlIntro, setTlIntro] = useState('idle');

  useEffect(() => {
    if (mapIntro !== 'idle' || !positionsSettled || !mapBaseDrawn) return undefined;
    // One frame of slack: on a warm re-navigation the GeoJSON is already cached, so
    // useMapBaseDrawn is true at useState init while the d3 draw rAF has yet to run.
    const frame = requestAnimationFrame(() => setMapIntro('running'));
    return () => cancelAnimationFrame(frame);
  }, [mapIntro, positionsSettled, mapBaseDrawn]);

  useEffect(() => {
    if (tlIntro !== 'idle' || !positionsSettled) return undefined;
    const frame = requestAnimationFrame(() => setTlIntro('running'));
    return () => cancelAnimationFrame(frame);
  }, [tlIntro, positionsSettled]);

  // Long enough for the slowest animation plus its sweep delay, with margin for the
  // dynamically imported pin and state SVGs landing a beat late.
  useEffect(() => {
    if (mapIntro !== 'running') return undefined;
    const timer = setTimeout(() => setMapIntro('done'), 1200);
    return () => clearTimeout(timer);
  }, [mapIntro]);

  useEffect(() => {
    if (tlIntro !== 'running') return undefined;
    const timer = setTimeout(() => setTlIntro('done'), 1000);
    return () => clearTimeout(timer);
  }, [tlIntro]);

  // Horizontal position across the viewport, 0 at the left edge and 1 at the right,
  // turned into an animation-delay so content arrives as a wave rather than a cut.
  // Only emitted while the intro is live: timeX changes every scroll frame, and leaving
  // the property in would churn inline styles forever for no benefit.
  const sweepDelay = useCallback((screenX) => {
    if (!width || !Number.isFinite(screenX)) return undefined;
    const fraction = Math.min(Math.max(screenX / width, 0), 1);
    // Spread into a style literal rather than written as a key: a custom property is not
    // in React.CSSProperties, and a spread is exempt from excess-property checking.
    return { '--sweep': `${(fraction * 0.18).toFixed(3)}s` } as React.CSSProperties;
  }, [width]);

  // Map items are positioned in map space, which is panned and scaled under the pane.
  const mapSweep = useCallback((x) => (
    mapIntro === 'done' ? undefined : sweepDelay(x * mapScale + mapX)
  ), [mapIntro, sweepDelay, mapScale, mapX]);

  const tlSweep = useCallback((x) => (
    tlIntro === 'done' ? undefined : sweepDelay(x - timeX)
  ), [tlIntro, sweepDelay, timeX]);

  // Nothing above can fail today, but the intro holds content at opacity 0 until this
  // flips, so a thrown ref must never be able to strand the page invisible.
  useEffect(() => {
    if (positionsSettled) return undefined;
    const timer = setTimeout(() => setPositionsSettled(true), 1200);
    return () => clearTimeout(timer);
  }, [positionsSettled]);


  const [eventSelected, setEventSelected] = useState(null);
  const [eventsOpen, setEventsOpen] = useState([]);
  const [eventOpenSelected, setEventOpenSelected] = useState(null);

  const [searchMatches, setSearchMatches] = useState([]);
  const options = useMemo(() => ({
    keys: ['displayName'],
    threshold: 0.5,
  }), []);
  const initializeFuse = (events) => {
    return new Fuse(events, options);
  };
  const [fuse, setFuse] = useState(null);
  useEffect(() => {
    if (events.length > 0) {
      setFuse(initializeFuse(events));
    }
  }, [events]);
  const handleSearch = (e) => {
    const search = e.target.value.trim().toLowerCase();
    if (search && fuse) {
      const results = fuse.search(search);
      setSearchMatches(results.map(result => result.item).slice(0, 20));
    } else {
      setSearchMatches([]);
    }
  };
  const searchEnter = (e) => {
    if(e.key == 'Enter') {
      if(searchMatches != null && searchMatches != undefined && searchMatches.length > 0) {
        const topMatch = searchMatches[0];
        eventClick(topMatch);
      }
    }
  }
  useEffect(() => {
    // The null check has to come first. On mount this runs once with eventSelected still
    // null - the restore sets state from a layout effect, so React flushes the first
    // commit's passive effects before the restored value arrives - and if that run
    // consumed the guard it would be spent before it was ever needed.
    if (eventSelected === null) return;
    if (skipAutoOpen.current) {
      // A restored selection already has its tab strip and fronted tab; appending here
      // would reorder the strip and override which tab was showing.
      skipAutoOpen.current = false;
      return;
    }
    if (!eventsOpen.includes(eventSelected)) {
      setEventsOpen(prevEvents => [...prevEvents, eventSelected]);
    }
    setEventOpenSelected(eventSelected);
  }, [eventSelected]);
  useEffect(() => {
    eventsRef.current = eventsRef.current.slice(0, events.length);
    eventsPinRef.current = eventsPinRef.current.slice(0, events.length);
    eventsPinDivRef.current = eventsPinDivRef.current.slice(0, events.length);
  }, [events.length])
  const useMeasure = (searchMatches) => {
    const searchResultsRef = useRef([]);
    const [widths, setWidths] = useState([]);
  
    useEffect(() => {
      const newWidths = searchResultsRef.current.map(el => el ? el.offsetWidth : 0);
      setWidths(newWidths);
    }, [searchMatches]);
  
    return { searchResultsRef, widths };
  };
  const { searchResultsRef, widths } = useMeasure(searchMatches);
  // Label widths are measured after layout into a ref; the version counter only
  // re-renders when a measurement actually changed, so this settles in a pass or two.
  // Previously setRef called setState, and because the ref callbacks are inline arrows
  // React re-attached them on every commit — which re-fired the state update forever.
  const measuredWidths = useRef({ events: [], pins: [], pinDivs: [] });
  const [, bumpWidthVersion] = useState(0);
  useIsomorphicLayoutEffect(() => {
    const measure = (key, refArray) => {
      const store = measuredWidths.current[key];
      let changed = false;
      for (let i = 0; i < refArray.current.length; i += 1) {
        const el = refArray.current[i];
        const next = el ? el.offsetWidth : 0;
        if (store[i] !== next) {
          store[i] = next;
          changed = true;
        }
      }
      return changed;
    };
    const eventsChanged = measure('events', eventsRef);
    const pinsChanged = measure('pins', eventsPinRef);
    const pinDivsChanged = measure('pinDivs', eventsPinDivRef);
    if (eventsChanged || pinsChanged || pinDivsChanged) {
      bumpWidthVersion((version) => version + 1);
    }
  });
  const setRef = useCallback((refArray, el, i) => {
    refArray.current[i] = el;
  }, []);

  const yearInput = (e) => {
    if (e.key === 'Enter') {
      const decimalYear = convertDateToDecimal(e.target.value);
      if (decimalYear != null) {
        setTimeYear(decimalYear);
        const newTime = (timeScale * (decimalYear - startYear + 0.5)) - (width / 2);
        setTimeX(newTime);
        setScrolling(true);
        scroll.scrollTo(newTime, scrollOptions(true));
      }
      e.target.value = '';
      e.target.blur();
    }
  };

  const [parents, setParents] = useState([]);
  const [locSel, setLocSel] = useState(null);
  useEffect(() => {
    const parentItems = events.map(event => event.parent).filter(parent => parent !== null && parent !== undefined);
    const uniqueParentsSet = new Set(parentItems);
    // Seeded from the restore rather than hardcoded to false. This effect has [] deps and
    // runs after the restore layout effect, so a setParents() in the restore path would be
    // overwritten here a tick later. Layout effects for a commit run before passive ones,
    // so the ref is always populated by the time this reads it. Expansion ids that no
    // longer name a parent simply never appear in the set being mapped.
    const uniqueParents = Array.from(uniqueParentsSet).map(parent => ({
      parent,
      expanded: restoredExpanded.current?.has(parent) ?? false,
    }));
    setParents(uniqueParents);
  }, []);
  const toggleParentSelection = (parentName) => {
    setParents(prevParents =>
      prevParents.map((event) =>
        event.parent === parentName ? { ...event, expanded: !event.expanded } : event
      )
    );
  }

  const expandedIds = useMemo(
    () => parents.filter((entry) => entry.expanded).map((entry) => entry.parent),
    [parents],
  );

  // Mirror the view into both the URL and session storage once scrolling settles. Lives
  // here rather than up with the other URL plumbing because its dependency array is
  // evaluated during render, and eventSelected/eventsOpen/eventOpenSelected/locSel are all
  // declared below that point - naming them there is a TDZ ReferenceError, not a warning.
  useEffect(() => {
    if (!urlRestored.current) return;
    const view = { div: borderY, mpx: mapX, mpy: mapY, mps: mapScale,
                   tpx: timeX, tpy: timeY, tps: timeScale, year: timeYear,
                   ev: eventSelected, open: eventsOpen, tab: eventOpenSelected,
                   loc: locSel, exp: expandedIds };
    viewRef.current = view;
    syncUrl(view);
    persistView(view);
  }, [syncUrl, persistView, borderY, mapX, mapY, mapScale, timeX, timeY, timeScale, timeYear,
      eventSelected, eventsOpen, eventOpenSelected, locSel, expandedIds]);
  // ---- Derived data -------------------------------------------------------------
  // Everything here is a function of the sheet data and is recomputed only when that
  // data changes. It used to be redone per event, per render: getEventY ran a full
  // events.filter() + findIndex() for every event, each position re-parsed its date
  // strings, and every state/location lookup was a linear scan.

  const statesById = useMemo(() => {
    const map = new Map();
    states.forEach((state) => {
      if (!state) return;
      if (!map.has(state.id)) map.set(state.id, []);
      map.get(state.id).push({
        ...state,
        decimalStart: convertDateToDecimal(state.startDate),
        decimalEnd: convertDateToDecimal(state.endDate),
        decimalState: convertDateToDecimal(state.stateDate),
      });
    });
    return map;
  }, [states]);

  const locationsById = useMemo(() => {
    const map = new Map();
    locations.forEach((location) => { if (location) map.set(location.id, location); });
    return map;
  }, [locations]);

  // latLonToX/Y are pure, so project each location once instead of six times per render.
  const locationPoints = useMemo(() => {
    const map = new Map();
    locations.forEach((location) => {
      if (!location) return;
      map.set(location.id, {
        x: latLonToX(Number(location.lat), Number(location.long)),
        y: latLonToY(Number(location.lat), Number(location.long)),
      });
    });
    return map;
  }, [locations]);

  const eventsById = useMemo(() => {
    const map = new Map();
    events.forEach((event) => { if (event && !map.has(event.id)) map.set(event.id, event); });
    return map;
  }, [events]);

  // Decimal dates and the vertical lane for every event, in one pass.
  const eventMeta = useMemo(() => {
    const byIndex = [];
    const byId = new Map();
    const categoryCursor = new Map();
    let periodCursor = 0;

    events.forEach((event, index) => {
      if (!event) { byIndex.push(null); return; }
      const start = convertDateToDecimal(event.startDate);
      const end = event?.endDate ? convertDateToDecimal(event.endDate) : null;

      // The old isEvenIndexInCategory indexed into events.filter(category && parent),
      // which includes period events — so they take up slots in the alternation even
      // though they are laid out separately. Nested Maps keep '' and null distinct as
      // parent values, matching the original's strict equality.
      let parentCursor = categoryCursor.get(event.category);
      if (!parentCursor) {
        parentCursor = new Map();
        categoryCursor.set(event.category, parentCursor);
      }
      const seen = parentCursor.get(event.parent) ?? 0;
      parentCursor.set(event.parent, seen + 1);

      let y;
      if (event.period) {
        y = (periodCursor % 4) * (65 / 2);
        periodCursor += 1;
      } else {
        y = (categoryToIndex(event.category) * 65 * 2) + (seen % 2 === 0 ? 0 : 65);
      }

      const meta = { start, end, y, index };
      byIndex.push(meta);
      if (!byId.has(event.id)) byId.set(event.id, meta);
    });

    return { byIndex, byId };
  }, [events]);

  // Index-aligned decimal dates for the two map render loops, which parsed five date
  // strings per state and one per location on every render.
  const stateDates = useMemo(() => states.map((state) => (state ? {
    start: convertDateToDecimal(state.startDate),
    end: convertDateToDecimal(state.endDate),
    statehood: Number(convertDateToDecimal(state.stateDate)),
  } : null)), [states]);
  const locationFoundDates = useMemo(
    () => locations.map((location) => (location ? convertDateToDecimal(location.foundDate) : null)),
    [locations],
  );

  const parentIds = useMemo(() => new Set(parents.map((entry) => entry.parent)), [parents]);
  const expandedParents = useMemo(() => {
    const map = new Map();
    parents.forEach((entry) => map.set(entry.parent, entry.expanded));
    return map;
  }, [parents]);

  const xFromMeta = useCallback((meta) => (meta.start - startYear + 0.5) * timeScale, [startYear, timeScale]);
  const xEndFromMeta = useCallback((meta) => (
    ((meta.end === null || ((meta.end - meta.start) * timeScale < 130))
      ? ((meta.start - startYear) * timeScale + 130)
      : ((meta.end - startYear) * timeScale)) + (timeScale * 0.4)
  ), [startYear, timeScale]);

  // Visible events grouped by location, built once per render instead of a full
  // events.filter() (with date parsing in the predicate) per map pin.
  const visibleByLocation = useMemo(() => {
    const centre = timeX + (width / 2);
    const reach = (width / 2) + 65;
    const map = new Map();
    events.forEach((event, index) => {
      if (!event || !event.location) return;
      const meta = eventMeta.byIndex[index];
      if (!meta) return;
      if (Math.abs(xFromMeta(meta) - centre) >= reach && Math.abs(xEndFromMeta(meta) - centre) >= reach) return;
      if (!map.has(event.location)) map.set(event.location, []);
      map.get(event.location).push(event);
    });
    return map;
  }, [events, eventMeta, timeX, width, xFromMeta, xEndFromMeta]);

  const getCurrentState = (id) => {
    const candidates = statesById.get(id);
    if (!candidates) return undefined;
    return candidates.find((state) => state.decimalEnd >= timeYear && state.decimalStart <= timeYear);
  }
  const oopsieDaisies = (id) => {
    const candidates = statesById.get(id);
    return candidates ? candidates[0] : undefined;
  }
  const getLocation = (id) => {
    return locationsById.get(id);
  }
  const isParentSelected = (parent) => {
    return expandedParents.get(parent) ?? false;
  }
  const isListedAsParent = (id) => {
    return parentIds.has(id);
  }
  const isListedAsState = (id) => {
    return statesById.has(id);
  }
  const isListedAsLoc = (id) => {
    return locationsById.has(id);
  }

  const [scrolling, setScrolling] = useState(true);
  useEffect(() => {
    if(scrolling) {
      const timer = setTimeout(() => setScrolling(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [scrolling]);
  const onMapScroll = useCallback((e) => {
    const delta = e.deltaY * -0.003;
    let newScale = mapScale + delta;
  
    if (newScale < 0.25) newScale = 0.25;
    else if (newScale > 7) newScale = 7;
  
    const ratio = 1 - newScale / mapScale;
    const mapHeight = (height - 64) * borderY;
  
    let newX = mapX + (e.clientX - mapX) * ratio;
    let newY = mapY + ((e.clientY - 78) - mapY) * ratio;
  
    if (newX > width / 2) newX = width / 2;
    else if (newX < width / 2 - (mapLimX * 2) * mapScale) newX = width / 2 - (mapLimX * 2) * mapScale;
  
    if (newY > mapHeight / 2) newY = mapHeight / 2;
    else if (newY < mapHeight / 2 - (mapLimY * 2) * mapScale) newY = mapHeight / 2 - (mapLimY * 2) * mapScale;
  
    setMapX(newX);
    setMapY(newY);
    setMapScale(newScale);
  }, [mapX, mapY, mapScale, height, borderY, mapLimX, mapLimY, width]);
  const [mapScrolling, setMapScrolling] = useState(false);
  useEffect(() => {
    if(mapScrolling) {
      const timer = setTimeout(() => setMapScrolling(false), 500);
      return () => clearTimeout(timer);
    }
  }, [mapScrolling]);
  const onMapDrag = useCallback((data) => {
    const mapHeight = (height - 64) * borderY;
  
    let newX = mapX + data.deltaX;
    let newY = mapY + data.deltaY;
    
    if (newX > width / 2) newX = width / 2;
    else if (newX < width / 2 - mapLimX * mapScale) newX = width / 2 - mapLimX * mapScale;
  
    if (newY > mapHeight / 2) newY = mapHeight / 2;
    else if (newY < mapHeight / 2 - mapLimY * mapScale) newY = mapHeight / 2 - mapLimY * mapScale;
  
    setMapX(newX);
    setMapY(newY);
  }, [mapX, mapY, height, borderY, mapLimX, mapLimY, mapScale, width]);

  // The two scroll containers drive each other's scrollLeft. Each gets its own slot
  // recording the value we last pushed into it, so the scroll event that write induces
  // is recognised as an echo rather than treated as a fresh user scroll (which would
  // bounce straight back). Compared with a tolerance because browsers report fractional
  // scrollLeft under display scaling, and an exact match would let the two ping-pong.
  const echoGuard = useRef({ timeline: null, numberLine: null });
  const isEcho = (recorded, actual) => recorded !== null && Math.abs(recorded - actual) < 1;
  // Scroll fires far faster than React can render, so updates are coalesced to one per frame.
  const scrollFrame = useRef(null);
  const pendingScroll = useRef(null);
  useEffect(() => () => {
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
  }, []);

  const commitScroll = useCallback(() => {
    scrollFrame.current = null;
    const next = pendingScroll.current;
    if (!next) return;
    pendingScroll.current = null;
    setTimeX(next.x);
    if (next.y !== null) setTimeY(next.y);
    if (Number.isFinite(width) && Number.isFinite(timeScale)) {
      setTimeYear(((next.x + width / 2) / timeScale) + (startYear - 0.5));
    }
    setScrolling(true);
  }, [width, timeScale, startYear]);

  const queueScroll = useCallback((x, y) => {
    pendingScroll.current = { x, y };
    if (scrollFrame.current === null) {
      scrollFrame.current = requestAnimationFrame(commitScroll);
    }
  }, [commitScroll]);

  const onNumberLineScroll = useCallback(() => {
    const source = numberLineRef.current;
    if (!source) return;
    const xScroll = source.scrollLeft;
    const guard = echoGuard.current;

    if (isEcho(guard.numberLine, xScroll)) {
      guard.numberLine = null;
    } else {
      const target = timelineRef.current;
      if (target && Math.abs(target.scrollLeft - xScroll) >= 1) {
        guard.timeline = xScroll;
        target.scrollLeft = xScroll;
      }
    }
    queueScroll(xScroll, null);
  }, [queueScroll]);

  const onTimelineScroll = useCallback(() => {
    const source = timelineRef.current;
    if (!source) return;
    const xScroll = source.scrollLeft;
    const yScroll = source.scrollTop;
    const guard = echoGuard.current;

    if (isEcho(guard.timeline, xScroll)) {
      guard.timeline = null;
    } else {
      const target = numberLineRef.current;
      if (target && Math.abs(target.scrollLeft - xScroll) >= 1) {
        guard.numberLine = xScroll;
        target.scrollLeft = xScroll;
      }
    }
    queueScroll(xScroll, yScroll);
  }, [queueScroll]);
  const zoomFrame = useRef(null);
  const pendingZoom = useRef(null);
  useEffect(() => () => {
    if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current);
  }, []);

  const onTimelineZoom = useCallback((value) => {
    const xTime = (timeX + (width / 2)) / timeScale;

    setTimeScale(value);

    const newX = (xTime * value) - (width / 2);

    echoGuard.current.numberLine = newX;
    echoGuard.current.timeline = newX;
    numberLineRef.current.scrollLeft = newX;
    timelineRef.current.scrollLeft = newX;

    setTimeX(newX);
    setScrolling(true);
  }, [timelineRef, numberLineRef, width, timeScale, timeX]);

  // Range inputs fire onChange for every pixel of drag; without this the rulers would
  // be rebuilt dozens of times per second while zooming.
  const queueZoom = useCallback((value) => {
    pendingZoom.current = value;
    if (zoomFrame.current === null) {
      zoomFrame.current = requestAnimationFrame(() => {
        zoomFrame.current = null;
        const next = pendingZoom.current;
        pendingZoom.current = null;
        if (next != null) onTimelineZoom(next);
      });
    }
  }, [onTimelineZoom]);

  // Only the events inside the horizontal viewport are handed to React. The map used to
  // run over all of them and return `false` for the ones off-screen, so React still
  // reconciled an entry per event on every frame.
  // Events in chronological order, for arrow-key traversal.
  const eventsByTime = useMemo(() => {
    const order = events
      .map((event, index) => ({ event, index, meta: eventMeta.byIndex[index] }))
      .filter((entry) => entry.event && entry.meta);
    order.sort((a, b) => a.meta.start - b.meta.start);
    return order;
  }, [events, eventMeta]);

  const [keyCursor, setKeyCursor] = useState(-1);

  const moveKeyCursor = useCallback((delta) => {
    if (!eventsByTime.length) return;
    setKeyCursor((current) => {
      const next = current < 0
        // Start from whatever is nearest the middle of the viewport.
        ? eventsByTime.findIndex((entry) => xFromMeta(entry.meta) >= timeX)
        : current + delta;
      const clamped = Math.min(Math.max(next < 0 ? 0 : next, 0), eventsByTime.length - 1);
      const target = eventsByTime[clamped];
      if (target && timelineRef.current) {
        timelineRef.current.scrollLeft = xFromMeta(target.meta) - (width / 2);
        timelineRef.current.scrollTop = Math.max(getEventY(target.event) - 120, 0);
      }
      return clamped;
    });
  }, [eventsByTime, xFromMeta, timeX, width]);

  const onTimelineKeyDown = useCallback((e) => {
    if (e.target !== e.currentTarget) return;   // let inputs and buttons keep their keys
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); moveKeyCursor(1); break;
      case 'ArrowLeft': e.preventDefault(); moveKeyCursor(-1); break;
      case 'Home': e.preventDefault(); setKeyCursor(0); if (timelineRef.current) timelineRef.current.scrollLeft = 0; break;
      case 'Enter':
      case ' ': {
        if (keyCursor < 0 || !eventsByTime[keyCursor]) return;
        e.preventDefault();
        eventClick(eventsByTime[keyCursor].event);
        break;
      }
      case 'Escape': setKeyCursor(-1); break;
      default: break;
    }
  }, [moveKeyCursor, keyCursor, eventsByTime]);

  const keyCursorId = keyCursor >= 0 ? eventsByTime[keyCursor]?.event?.id : null;

  const visibleTimelineEvents = useMemo(() => {
    const left = timeX;
    const right = timeX + (width * 1.1);
    const result = [];
    events.forEach((event, index) => {
      const meta = eventMeta.byIndex[index];
      if (!meta) return;
      if (xFromMeta(meta) < right && xEndFromMeta(meta) > left) result.push({ event, index });
    });
    return result;
  }, [events, eventMeta, timeX, width, xFromMeta, xEndFromMeta]);


  // --- Tick marks -----------------------------------------------------------------
  // Both rulers are a pure function of the zoom level, so they are built once per zoom
  // and never touched again. The cull test used to read timeX, which meant all 545 years
  // were walked and the visible ones rebuilt on every scroll frame — and, worse, the
  // window was derived from React state that lags the DOM scroll position, so a fast
  // scroll outran the ticks and they popped in late. That is what made this bar feel
  // detached from the timeline it is meant to track. Rendering the full span keeps it
  // purely native scrolling: React does no work here while you scroll, at all.
  const tickYears = useMemo(() => {
    const years = [];
    for (let i = 0; i <= endYear - startYear; i += 1) years.push(i);
    return years;
  }, [startYear, endYear]);

  const verticalGridlines = useMemo(() => tickYears.map((i) => (
    <React.Fragment key={i}>
      {(timeScale > 70) ? (
        <>
        <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,
            msTransform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,position:'absolute',width:'0.3rem',height:'100%',top:0,backgroundColor:'#333443'}}></div>
        <div style={{transform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,
            msTransform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'100%',top:0,backgroundColor:'#333443'}}></div>
        <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,
            msTransform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'100%',top:0,backgroundColor:'#333443'}}></div>
        <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,
            msTransform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'100%',top:0,backgroundColor:'#333443'}}></div>
        </>
      ) : (
        <>
          <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - ${i % 2 == 0 ? 0.15 : 0.075}rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - ${i % 2 == 0 ? 0.15 : 0.075}rem), 0rem)`,
                msTransform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - ${i % 2 == 0 ? 0.15 : 0.075}rem), 0rem)`,position:'absolute',width:`${i % 2 == 0 ? 0.3 : 0.15}rem`,height:`100%`,top:0,backgroundColor:'#333443'}}></div>
          <div style={{transform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,
              msTransform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'100%',top:0,backgroundColor:'#333443'}}></div>
        </>
      )}
    </React.Fragment>
  )), [tickYears, timeScale]);

  const yearTicks = useMemo(() => tickYears.map((i) => (
    <React.Fragment key={i}>
      {(timeScale > 100 || (i % 2 == 0 && (timeScale > 40 || i % 4 == 0))) && (
        <span className={timelineStyles.tickLabel} style={{transform:`translate(${(i * timeScale) - (timeScale > 100 ? 0 : (timeScale * 0.5))}px, 0rem)`,WebkitTransform:`translate(${(i * timeScale) - (timeScale > 100 ? 0 : (timeScale * 0.5))}px, 0rem)`,
            msTransform:`translate(${(i * timeScale) - (timeScale > 100 ? 0 : (timeScale * 0.5))}px, 0rem)`,width:`${timeScale > 100 ? timeScale : (timeScale * 2)}px`,textAlign:'center'}}>
          {(i + startYear)}
        </span>
      )}
      {(timeScale > 70) ? (
        <>
          <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,
              msTransform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,position:'absolute',width:'0.3rem',height:'1rem',top:0,backgroundColor:'#E9EAF3'}}></div>
          <div style={{transform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,
              msTransform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'0.7rem',top:0,backgroundColor:'#E9EAF3'}}></div>
          <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,
              msTransform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'0.4rem',top:0,backgroundColor:'#E9EAF3'}}></div>
          <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,
              msTransform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'0.4rem',top:0,backgroundColor:'#E9EAF3'}}></div>
        </>
      ) : (
        <>
          <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - ${i % 2 == 0 ? 0.15 : 0.075}rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - ${i % 2 == 0 ? 0.15 : 0.075}rem), 0rem)`,
                msTransform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - ${i % 2 == 0 ? 0.15 : 0.075}rem), 0rem)`,position:'absolute',width:`${i % 2 == 0 ? 0.3 : 0.15}rem`,height:`${i % 2 == 0 ? 1 : 0.7}rem`,top:0,backgroundColor:'#E9EAF3'}}></div>
          <div style={{transform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,
              msTransform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'0.4rem',top:0,backgroundColor:'#E9EAF3'}}></div>
        </>
      )}
    </React.Fragment>
  )), [tickYears, timeScale, startYear]);

  const getLocX = (event) => {
    if (!event?.location) return null;
    if (isListedAsState(event.location)) {
      const locSel = getCurrentState(event.location) || oopsieDaisies(event.location);
      if (!locSel) return null;
      return Number(locSel.x) + Number(locSel.xLabel) + (Number(locSel.width) / 2);
    }
    const point = locationPoints.get(event.location);
    return point ? point.x : null;
  }
  const getLocY = (event) => {
    if (!event?.location) return null;
    if (isListedAsState(event.location)) {
      const locSel = getCurrentState(event.location) || oopsieDaisies(event.location);
      if (!locSel) return null;
      return Number(locSel.y) + Number(locSel.yLabel) + (Number(locSel.height) / 2);
    }
    const point = locationPoints.get(event.location);
    return point ? point.y : null;
  }
  const metaOf = (event) => (event ? eventMeta.byId.get(event.id) : null);
  const getEventX = (event) => { const meta = metaOf(event); return meta ? xFromMeta(meta) : 0; }
  const getEventXEnd = (event) => { const meta = metaOf(event); return meta ? xEndFromMeta(meta) : 0; }
  const getEventY = (event) => { const meta = metaOf(event); return meta ? meta.y : 0; }
  const eventSpan = (event) => { const meta = metaOf(event); return (meta && meta.end !== null) ? (meta.end - meta.start) : 0; }
  const eventClick = (event) => {
    if(event?.id) {
      const clickX = getEventX(event);
      const clickY = getEventY(event) - ((height - ((height - 64) * borderY) - 200) / 2);

      scroll.scrollTo(clickX - width / 2, scrollOptions(true));
      scroll.scrollTo(clickY, scrollOptions(false))
      setEventSelected(event.id);

      if(event?.location) {
        if(isListedAsState(event.location)) {
          const locSel = getCurrentState(event.location) || oopsieDaisies(event.location);
          const statePosX = Number(locSel.x) + Number(locSel.xLabel) + (Number(locSel.width) / 2)
          const newMapX = (width / 2) - (statePosX * mapScale);
          setMapX(newMapX);
          const statePosY = Number(locSel.y) + Number(locSel.yLabel) + (Number(locSel.height) / 2)
          const newMapY = ((height - 64) * borderY / 2) - (statePosY * mapScale);
          setMapY(newMapY);
          setMapScrolling(true);
          setLocSel(event.location);
        } else if(isListedAsLoc(event.location)) {
          const locSel = getLocation(event.location);
          const locPosX = latLonToX(Number(locSel.lat), Number(locSel.long));
          const newMapX = (width / 2) - (locPosX * mapScale);
          setMapX(newMapX);
          const locPosY = latLonToY(Number(locSel.lat), Number(locSel.long));
          const newMapY = ((height - 64) * borderY / 2) - (locPosY * mapScale);
          setMapY(newMapY);
          setMapScrolling(true);
          setLocSel(event.location);
        } else {
          setLocSel(null);
        }
      } else {
        setLocSel(null);
      }
    } else {
      setEventSelected(null);
    }
  }
  const locationClick = (location) => {
    if(isListedAsState(location)) {
      const locSel = getCurrentState(location) || oopsieDaisies(location);
      const statePosX = Number(locSel.x) + Number(locSel.xLabel) + (Number(locSel.width) / 2)
      const newMapX = (width / 2) - (statePosX * mapScale);
      setMapX(newMapX);
      const statePosY = Number(locSel.y) + Number(locSel.yLabel) + (Number(locSel.height) / 2)
      const newMapY = ((height - 64) * borderY / 2) - (statePosY * mapScale);
      setMapY(newMapY);
      setMapScrolling(true);
      setLocSel(location);
    } else if(isListedAsLoc(location)) {
      const locSel = getLocation(location);
      const locPosX = latLonToX(Number(locSel.lat), Number(locSel.long));
      const newMapX = (width / 2) - (locPosX * mapScale);
      setMapX(newMapX);
      const locPosY = latLonToY(Number(locSel.lat), Number(locSel.long));
      const newMapY = ((height - 64) * borderY / 2) - (locPosY * mapScale);
      setMapY(newMapY);
      setMapScrolling(true);
      setLocSel(location);
    } else {
      setLocSel(null);
    }
  }
  const locHoverNear = (posX, posY) => {
    return Math.sqrt(Math.pow(Math.abs(posX - (mousePos.x - mapX) / mapScale), 2) + Math.pow(Math.abs(posY - (mousePos.y - mapY - 70) / mapScale), 2)) < (10 / mapScale);
  }
  const eventVisible = (event) => {
    const meta = metaOf(event);
    if (!meta) return false;
    const centre = timeX + (width / 2);
    const reach = (width / 2) + 65;
    return Math.abs(xFromMeta(meta) - centre) < reach || Math.abs(xEndFromMeta(meta) - centre) < reach;
  }
  const eventsVisibleAt = (location) => visibleByLocation.get(location) ?? [];
  const indexAtLoc = (event) => eventsVisibleAt(event.location).indexOf(event);
  const eventFromId = (eventId) => eventsById.get(eventId);
  // Hoisted and gated on below. Ids used to come only from clicking a rendered event, so
  // a miss was impossible; now that they also come from storage and the query string, a
  // stale id is ordinary input - and the panel dereferenced this without optional
  // chaining, which would have been a blank page rather than a missing panel.
  const openEvent = eventFromId(eventOpenSelected);
  const eventsAtLocLen = (event) => eventsVisibleAt(event.location).length;

  return (
    <Layout page="history">
      {/* The document had no h1 at all: the highest heading was a map state label. */}
      <h1 className={utilStyles.srOnly}>
        Mapline — a map and timeline of United States history
      </h1>
      {/* MAP */}

      <section id={`map`} className={`${mapStyles.map} ${introMarker(mapIntro, 'mapline-intro')}`} onWheel={onMapScroll} style={{height:`${(height - 64) * borderY}px`}}>
        <svg width={'10rem'} height={'100%'} style={{background:`linear-gradient(90deg, rgba(0,0,0,0.8), transparent)`,zIndex:109}}></svg>
        <Image className={mapStyles.compass} src="/images/compass.png" height={256} width={256} alt="" style={{height:`${compassDimensions(height, borderY)}px`,width:`${compassDimensions(height, borderY)}px`,
            top:`calc(${((height - 64) * borderY)}px - ${compassDimensions(height, borderY)}px - 1.2rem)`}}/>
        <MapGridSkeleton hidden={mapIntro !== 'idle'} />
        <DraggableCore onDrag={(e, data) => {onMapDrag(data)}} onStart={() => setIsDragging(true)} onStop={() => setIsDragging(false)}>
          <div onMouseMove={onMapMouseMove} style={{position:"absolute",width:"100%",height:"100%",zIndex:100,transform:`translate(${mapX}px, ${mapY}px) scale(${mapScale})`,WebkitTransform:`translate(${mapX}px, ${mapY}px) scale(${mapScale})`,
              msTransform:`translate(${mapX}px, ${mapY}px) scale(${mapScale})`,transformOrigin:"top left",WebkitTransformOrigin:"top left",msTransformOrigin:"top left"}}
              className={`${(mapScrolling && !isDragging) && mapStyles.draggableMapSlow}`} onMouseDownCapture={mapMouseDown} onMouseUpCapture={mapMouseUp}>

            <svg className={mapStyles.ocean} width={`${mapLimX * 3}px`} height={`${mapLimY * 3}px`} style={{zIndex:"-100",transform:`translate(${-1 * mapLimX}px, ${-1 * mapLimY}px)`,
                WebkitTransform:`translate(${-1 * mapLimX}px, ${-1 * mapLimY}px)`,msTransform:`translate(${-1 * mapLimX}px, ${-1 * mapLimY}px)`}} ></svg>
            <svg className={mapStyles.mapShadow} width={`${mapLimX * 2}px`} height={`${mapLimY * 4}px`} style={{zIndex:"200",transform:`translate(${-3 * mapLimX}px, ${-1.5 * mapLimY}px)`,
                WebkitTransform:`translate(${-3 * mapLimX}px, ${-1.5 * mapLimY}px)`,msTransform:`translate(${-3 * mapLimX}px, ${-1.5 * mapLimY}px)`}}></svg>
            <svg className={mapStyles.mapShadow} width={`${mapLimX * 2}px`} height={`${mapLimY * 4}px`} style={{zIndex:"200",transform:`translate(${2 * mapLimX}px, ${-1.5 * mapLimY}px)`,
                WebkitTransform:`translate(${2 * mapLimX}px, ${-1.5 * mapLimY}px)`,msTransform:`translate(${2 * mapLimX}px, ${-1.5 * mapLimY}px)`}}></svg>
            <svg className={mapStyles.mapShadow} width={`${mapLimX * 4}px`} height={`${mapLimY * 2}px`} style={{zIndex:"200",transform:`translate(${-1.5 * mapLimX}px, ${-3 * mapLimY}px)`,
                WebkitTransform:`translate(${-1.5 * mapLimX}px, ${-3 * mapLimY}px)`,msTransform:`translate(${-1.5 * mapLimX}px, ${-3 * mapLimY}px)`}}></svg>
            <svg className={mapStyles.mapShadow} width={`${mapLimX * 4}px`} height={`${mapLimY * 2}px`} style={{zIndex:"200",transform:`translate(${-1.5 * mapLimX}px, ${2 * mapLimY}px)`,
                WebkitTransform:`translate(${-1.5 * mapLimX}px, ${2 * mapLimY}px)`,msTransform:`translate(${-1.5 * mapLimX}px, ${2 * mapLimY}px)`}}></svg>
            <div style={{pointerEvents:'none',zIndex:"200",boxShadow:'inset 0 0 300px 400px #4B5B96',width:`${mapLimX * 3}px`,height:`${mapLimY * 3}px`,transform:`translate(${-1 * mapLimX}px, ${-1 * mapLimY}px)`,
                WebkitTransform:`translate(${-1 * mapLimX}px, ${-1 * mapLimY}px)`,msTransform:`translate(${-1 * mapLimX}px, ${-1 * mapLimY}px)`}}></div>
            
            {(mapScale < 0.6) ? (
              <>
                <LowProjectionLCC className={mapStyles.mapLayer} width={8000} height={7000} style={{zIndex:'-50',left:-2800,top:-3100}}/>
                <LowTopProjectionLCC className={mapStyles.mapLayer} width={8000} height={7000} style={{transition:`opacity 0.5s linear`,opacity:`${mapScale < 0.6 ? 1 : 0}`,zIndex:'110',pointerEvents:'none',left:-2800,top:-3100}}/>
              </>
            ) : (
              <>
                <MediumProjectionLCC className={mapStyles.mapLayer} width={8000} height={7000} style={{zIndex:'-50',pointerEvents:'none',left:-2800,top:-3100}}/>
                <MediumTopProjectionLCC className={mapStyles.mapLayer} width={8000} height={7000} style={{transition:`opacity 0.5s linear`,opacity:`${(mapScale >= 0.6) ? 1 : 0}`,zIndex:'110',pointerEvents:'none',left:-2800,top:-3100}}/>
                {(mapScale > 4) ? (
                  <HighTopLabelProjectionLCC className={mapStyles.mapLayer} width={8000} height={7000} style={{transition:`opacity 0.5s linear`,opacity:`${mapScale > 4 ? 1 : 0}`,zIndex:'110',pointerEvents:'none',left:-2800,top:-3100}}/>
                ) : (
                  (mapScale >= 1.5) && (
                    <MediumTopLabelProjectionLCC className={mapStyles.mapLayer} width={8000} height={7000} style={{transition:`opacity 0.5s linear`,opacity:`${(mapScale >= 1.5 && mapScale <= 4) ? 1 : 0}`,zIndex:'110',pointerEvents:'none',left:-2800,top:-3100}}/>
                  )
                )}
                {(mapScale >= 3) && (
                  <MediumTopRiverLabelProjectionLCC className={mapStyles.mapLayer} width={8000} height={7000} style={{transition:`opacity 0.5s linear`,opacity:`${(mapScale >= 3) ? 1 : 0}`,zIndex:'110',pointerEvents:'none',left:-2800,top:-3100}}/>
                )}
              </>
            )}
            
            {states.map((state, index) => (
              <React.Fragment key={state.name ?? index}>
                {(stateDates[index] && stateDates[index].start <= timeYear && stateDates[index].end > timeYear) &&
                  <>
                    <State name={state.name} className={`${stateStyles.state} ${locSel == state.id && ((stateDates[index].statehood > timeYear) ? stateStyles.nonStateHover : stateStyles.stateHover)}
                        ${(stateDates[index].statehood > timeYear) && stateStyles.nonState}`}
                        width={Number(state.width) + 5} height={Number(state.height) + 5}
                        style={{left:Number(state.x),top:Number(state.y),strokeWidth:`${0.4 / mapScale + 0.2}rem`}}
                        onCompleted={onCompleted} onError={onError} id={state.id}
                        onMouseEnter={() => (setInHidden(index))}
                        onMouseLeave={() => inHidden == index && setInHidden(-1)}
                    />
                    <div style={{left:Number(state.x) + Number(state.xLabel), top:Number(state.y) + Number(state.yLabel), width:Number(state.width) + 5, height:Number(state.height) + 5,
                        fontSize: 6 * Math.pow((2/3) * Number(state.width) + (1/3) * Number(state.height), 0.3)}}>
                      <span className={`${stateStyles.state} ${stateStyles.stateLabel} ${(stateDates[index].statehood > timeYear) && stateStyles.nonStateLabel}`}
                            style={{transformOrigin:`center center`,transform:`scale(${0.4 / mapScale + 0.3})`,opacity: `${(inHidden == index || locSel == state.id) ? 0.85 : 0}`}}>
                        {state.displayName + ((stateDates[index].statehood > timeYear) ? ' Territory' : '')}
                      </span>
                    </div>
                  </>
                }
              </React.Fragment>
            ))}

            {locations.map((location, index) => (((locationFoundDates[index] <= timeYear) &&
                ((location.size == 5) || (location.size == 4 && mapScale > 0.4) || (location.size == 3 && mapScale > 1) || (location.size == 2 && mapScale > 1.7) || (location.size == 1 && mapScale > 2.5))) || (location.id == locSel)) && (
              <React.Fragment key={location.id ?? index}>
                <div style={{...mapSweep(latLonToX(location.lat, location.long)),transformOrigin:`top left`,transform:`scale(${(location.size / 10 + 0.3) / mapScale + 0.1})`,pointerEvents:'none',position:'absolute',width:'13rem',zIndex:115,left:`${latLonToX(location.lat, location.long)}px`,top:`${latLonToY(location.lat, location.long)}px`}}>
                  <div className={`${mapStyles.locationDot}`} style={{opacity:(locHoverNear(latLonToX(location.lat, location.long), latLonToY(location.lat, location.long)) || locSel == location.id) ? 1 : (0.3 + (location.size / 10))}}></div>
                  <span className={`${mapStyles.locationLabel} ${(!locHoverNear(latLonToX(location.lat, location.long), latLonToY(location.lat, location.long)) && locSel != location.id) && mapStyles.locationLabelHidden}`}>{location.displayName}</span>
                </div>
              </React.Fragment>
            ))}

            {events.map((event, i) => ((getLocX(event) != null && event.location != null && (eventVisible(event) || event.id == eventSelected || eventsOpen.find(e => e == event.id) != null)) &&
              ((eventsAtLocLen(event) <= 1 || event.id == eventSelected) ? (
                <MapSvg key={event.id ?? i} className={`${timelineStyles.eventsp} ${timelineStyles[event.category + 'p']} ${eventSelected == event.id && timelineStyles.selectedPin}`} width={40} height={30} style={{...mapSweep(getLocX(event)),transformOrigin:`bottom center`,
                    transform:`translate(${getLocX(event)}px, ${getLocY(event)}px) scale(${(0.9 / mapScale + 0.1) * (eventSelected == event.id ? 1.3 : 1)})`}}
                    name={'pin'} onCompleted={onCompleted} onError={onError} onMouseDownCapture={mapMouseDown}
                    onMouseUpCapture={(e) => {
                      const {x, y} = tempMousePos.current;
                      if (Math.abs(e.clientX - x) < 2 && Math.abs(e.clientY - y) < 2) {
                        eventClick(event);
                      }
                    }}
                />
              ) : (
                ((indexAtLoc(event) == 0) && (event.location != eventFromId(eventSelected)?.location)) && (
                  <div key={event.id ?? i} className={`${timelineStyles.eventspMulti} ${locSel == event.location && timelineStyles.selectedPin}`} style={{...mapSweep(getLocX(event)),transformOrigin:`bottom center`,
                        transform:`translate(${getLocX(event)}px, ${getLocY(event)}px) scale(${(0.9 / mapScale + 0.1) * (locSel == event.location ? 1.3 : 1)})`}}>
                    <MapSvg className={`${timelineStyles[event.category + 'p']}`} width={40} height={30}
                        style={{top:-30,left:-20}}
                        name={'pin_multi'} onCompleted={onCompleted} onError={onError} onMouseDownCapture={mapMouseDown}
                        onMouseUpCapture={(e) => {
                          const {x, y} = tempMousePos.current;
                          if (Math.abs(e.clientX - x) < 2 && Math.abs(e.clientY - y) < 2) {
                            locationClick(event.location);
                          }
                        }}
                    />

                    {/* LOCATION COUNT */}
                    <div className={timelineStyles.eventspLabel} style={{}}>
                      <p aria-hidden="true">
                        {eventsAtLocLen(event)}
                      </p>
                    </div>

                    {/* EVENT LIST AT LOC */}
                    {(locSel == event.location && (
                      <>
                        <div className={timelineStyles.eventspListArrow} style={{transformOrigin:`center left`,transform:`translate(${0}px, -50%) scale(0.6)`}}></div>
                        <div className={`${utilStyles.scrollable} ${timelineStyles.eventspList}`} style={{width:`calc(${Math.max(0, ...measuredWidths.current.pinDivs)}px +
                            ${eventsAtLocLen(event) * 72 - 10 > 450 ? 0.9 : 0}rem)`,pointerEvents:'auto',height:`calc(${Math.min(eventsAtLocLen(event) * 72 - 10, 450)}px)`,
                            transformOrigin:`center left`,transform:`translate(${0}px, -50%) scale(0.6)`,overflowY:`${eventsAtLocLen(event) * 72 - 10 < 450 ? 'hidden' : 'scroll'}`}} onWheel={(e) => e.stopPropagation()}>
                          {eventsVisibleAt(event.location).map((eInList, j) => (
                            <React.Fragment key={eInList.id ?? j}>
                              <div ref={el => setRef(eventsPinDivRef, el, j)} className={`${timelineStyles.events} ${timelineStyles.eventspListEvent} ${timelineStyles[eInList.category]}`} style={{transform:`translate(0px, ${indexAtLoc(eInList) * 72}px)`,
                                  width:`calc(${labelWidth(measuredWidths.current.pins[j], eInList?.endDate)}px + 1rem)`}}
                                  onMouseDownCapture={mapMouseDown}
                                  onMouseUpCapture={(e) => {
                                    const {x, y} = tempMousePos.current;
                                    if (Math.abs(e.clientX - x) < 2 && Math.abs(e.clientY - y) < 2) {
                                      eventClick(eInList);
                                    }
                                  }}
                              >
                                <div className={timelineStyles.eventDiv} style={{overflow:'hidden',width:'100%',height:'100%'}}>
                                  <span className={timelineStyles.eventTitle} ref={el => setRef(eventsPinRef, el, j)} style={{marginTop:4,fontStyle:`${eInList.italics ? 'italic' : 'normal'}`}}>
                                    {eInList.displayName}
                                  </span>
                                  <div style={{position:'absolute',width:'100%',height:'1rem',top:'1rem',textAlign:'right'}}>
                                    {eInList?.endDate && (
                                      <p style={{position:'relative'}}>
                                        {` – ${dateFilterRender(eInList.endDate, eInList.specEndDate)}`}
                                      </p>
                                    )}
                                    <p style={{position:'relative',display:'inline-block'}} className={timelineStyles.startDate}>
                                      {dateFilterRender(eInList.startDate, eInList.specStartDate)}
                                    </p>
                                  </div>
                                  <FilterIcon className={timelineStyles.filterIcon} filter={eInList.filter} onCompleted={onCompleted} onError={onError}></FilterIcon>
                                </div>
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      </>
                    ))}
                  </div>
                )
              ))
            ))}

          </div>
        </DraggableCore>

        {/* INFO */}
        {(eventOpenSelected != null && openEvent) && (
          <div className={infoStyles.infoBox} style={{width:`${(((height - 64) * borderY) + (width / 4)) / 2}px`,height:`${(height - 64) * borderY}px`,left:`calc(${width}px - ${(((height - 64) * borderY) + (width / 4)) / 2}px)`}}>
            <div className={`${infoStyles.infoBoxDivBack}`} style={{width:`calc(100% - 2rem)`,height:`calc(${(height - 64) * borderY}px - 2rem)`}} onWheel={(e) => e.stopPropagation()}></div>
            <div className={`${infoStyles.infoBoxDiv}`} style={{width:`calc(100% - 2rem)`,height:`calc(${(height - 64) * borderY}px - 2rem)`}} onWheel={(e) => e.stopPropagation()}>

              <div className={`${infoStyles.infoBoxTabs}`}>
                {eventsOpen.map((eOpen, i) => {
                  const tabEvent = eventFromId(eOpen);
                  if (!tabEvent) return null;
                  const selected = eventOpenSelected == eOpen;
                  return (
                  <div key={eOpen ?? i} className={`${infoStyles.infoBoxTab} ${timelineStyles[tabEvent.category + 'Tab']} ${selected ? infoStyles.infoBoxTabSel : ''}`}>
                    <button type="button" className={infoStyles.infoBoxTabButton}
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => setEventOpenSelected(eOpen)}>
                      <span style={{fontStyle:`${tabEvent.italics ? 'italic' : 'normal'}`}}>
                        {tabEvent.displayName}
                      </span>
                    </button>
                    <button type="button" className={infoStyles.infoBoxClose}
                        aria-label={`Close ${tabEvent.displayName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const index = eventsOpen.indexOf(eOpen);
                          if(eOpen == eventOpenSelected) {
                            setEventOpenSelected(eventsOpen[index + 1] || eventsOpen[index - 1]);
                          }
                          if(eOpen == eventSelected) {
                            setEventSelected(null);
                            setLocSel(null);
                          }
                          setEventsOpen(prevEvents => prevEvents.filter(event => event != eOpen));
                        }}>
                      <MapSvg name={'close'} onCompleted={onCompleted} onError={onError} width={'1rem'} height={'1rem'} aria-hidden="true" />
                    </button>
                  </div>
                  );
                })}
              </div>

              <div className={`${infoStyles.infoBoxDivInner} ${utilStyles.scrollable}`}>
                <h2 className={`${infoStyles.infoBoxTitle} ${timelineStyles[openEvent.category + 'Text']}`} style={{fontStyle:`${openEvent.italics ? 'italic' : 'normal'}`}}>
                  {openEvent?.fullName || openEvent?.displayName}
                  {(openEvent?.aka) && (
                    <span className={infoStyles.infoBoxAka}>
                      A.K.A. {openEvent.aka}
                    </span>
                  )}
                </h2>
                
                <p className={`${infoStyles.infoBoxDate} ${timelineStyles[openEvent.category + 'Text']}`} onClick={() => eventClick(openEvent)}>
                  {convertDate(String(dateFilterRender(openEvent?.startDate, openEvent?.specStartDate)))}
                  {openEvent?.endDate && 
                    ` – ${convertDate(String(dateFilterRender(openEvent?.endDate, openEvent?.specEndDate)))}`
                  }
                </p>
                {(openEvent?.location) && (
                  <button type="button" className={infoStyles.infoBoxLocation}
                      onClick={() => locationClick(openEvent.location)}>
                    {isListedAsLoc(openEvent.location) && getLocation(openEvent.location)?.displayName}
                    {isListedAsState(openEvent.location) && (getCurrentState(openEvent.location)?.displayName || oopsieDaisies(openEvent.location)?.displayName)}
                    <MapSvg width={11} name={'pin'} onCompleted={onCompleted} onError={onError} aria-hidden="true" />
                  </button>
                )}

                <UrlToAbstract url={openEvent.wikiLink} className={infoStyles.infoBoxInfo} />
                <a target='_blank' rel='noopener noreferrer' href={openEvent.wikiLink}>
                  Wikipedia<span className={utilStyles.srOnly}> article for {openEvent.displayName}</span>
                </a>
              </div>

            </div>
          </div>
        )}

      </section>
      
      {}
      {/* DRAG BORDER */}
      <div style={{position:"absolute",top:"3.75rem",zIndex:150,width:"100%"}}>
        <DraggableCore onDrag={(e, data) => {setBorderY(((data.y - 5) < ((height - 64) * 0.25)) ? 0.25 :
            ((data.y - 5) > ((height - 64) * 0.75)) ? 0.75 : (data.y - 5) / (height - 64))}}>
          <div style={{position:"relative",top:((height - 64) * borderY),width:"100%",height:10,cursor:'ns-resize'}}></div>
        </DraggableCore>
      </div>
      
      {/* TIMELINE */}
      <input type='range' value={timeScale} min={30} max={350} onChange={(e) => queueZoom(Number(e.target.value))} className={timelineStyles.timeScale}
          aria-label='Timeline zoom' aria-valuetext={`${timeScale} pixels per year`}
          style={{top:`calc(${(height - 64) * borderY}px + 4rem)`,backgroundSize:`${((timeScale - 30) * 100) / 320}% 100%`,width:`${0.25 * (height - ((height - 64) * borderY))}px`}}/>
      <input type='search' placeholder='Search... &#x1F50D;' aria-label='Search events' onChange={handleSearch} onKeyDown={searchEnter}
          style={{top:`calc(${(height - 64) * borderY}px + 4rem)`,left:`calc(${width}px - 11.5rem)`}} className={timelineStyles.search}/>
      {(searchMatches != null && searchMatches != undefined && searchMatches.length > 0) && (
        <div style={{position:'absolute',width:'100%',left:`calc(${width}px - 11.5rem)`,height:`calc(${Math.min(searchMatches.length * 43 - 5, height - ((height - 64) * borderY) - 210)}px)`,
            marginLeft:'0.65rem',marginTop:'2.9rem'}}>
          <div className={`${utilStyles.scrollable} ${timelineStyles.searchResults}`} style={{width:`15.7rem`,pointerEvents:'auto',height:`${100 / 0.6}%`,transformOrigin:`top left`,transform:`scale(0.6)`,
                overflowY:`${searchMatches.length * 43 - 5 < height - ((height - 64) * borderY) - 210 ? 'hidden' : 'scroll'}`}}>
            {searchMatches.map((eInList, j) => (
              <div key={eInList.id ?? j} className={`${timelineStyles.events} ${timelineStyles.eventspListEvent} ${timelineStyles[eInList.category]}`} style={{transform:`translate(0px, ${j * 72}px)`,
                  width:`calc(${labelWidth(widths[j], eInList?.endDate)}px + 1rem)`,maxWidth:`15.7rem`}}
                  onMouseDownCapture={mapMouseDown}
                  onMouseUpCapture={(e) => {
                    const {x, y} = tempMousePos.current;
                    if (Math.abs(e.clientX - x) < 2 && Math.abs(e.clientY - y) < 2) {
                      eventClick(eInList);
                    }
                  }}
              >
                <div className={timelineStyles.eventDiv} style={{overflow:'hidden',width:'100%',height:'100%'}}>
                  <span className={timelineStyles.eventTitle} ref={el => searchResultsRef.current[j] = el} style={{marginTop:4,fontStyle:`${eInList.italics ? 'italic' : 'normal'}`}}>
                    {eInList.displayName}
                  </span>
                  <div style={{position:'absolute',width:'100%',height:'1rem',top:'1rem',textAlign:'right'}}>
                    {eInList?.endDate && (
                      <p style={{position:'relative'}}>
                        {` – ${dateFilterRender(eInList.endDate, eInList.specEndDate)}`}
                      </p>
                    )}
                    <p style={{position:'relative',display:'inline-block'}} className={timelineStyles.startDate}>
                      {dateFilterRender(eInList.startDate, eInList.specStartDate)}
                    </p>
                  </div>
                  <FilterIcon className={timelineStyles.filterIcon} filter={eInList.filter} onCompleted={onCompleted} onError={onError}></FilterIcon>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <section id={`timeline`} className={`${timelineStyles.timeline} ${utilStyles.scrollable}`} onScroll={onTimelineScroll} ref={timelineRef}
          tabIndex={0} role="region" aria-label="Timeline of events. Use the arrow keys to move between events and Enter to open one."
          onKeyDown={onTimelineKeyDown}
          style={{height:`calc(${height - ((height - 64) * borderY)}px - 7.1rem)`,position:'absolute'}}>
        <div className={introMarker(tlIntro, 'mapline-tl')} style={{position:"absolute",top:0,height:`${timeLimY}px`,width:`calc(${timeLimX}px - 0.9rem)`,overflow:'hidden'}} onMouseUpCapture={() => {if(!isDragging) { eventClick(null); setLocSel(null); }}}>
          {visibleTimelineEvents.map(({ event, index: i }) => (
            (
              (!event.period) ? (
                <div key={event.id ?? i} style={{...tlSweep(getEventX(event)),zIndex:50}} className={timelineStyles.eventDiv} onClick={(e) => e.stopPropagation()}>

                  <HoverVisibleDiv $length={labelWidth(measuredWidths.current.events[i], event?.endDate)} $opacity={(event.importance / 9) + 0.4} 
                        $isParent={isListedAsParent(event.id)} $expanded={(event?.parent ? (isParentSelected(event.parent)) : true)} $corners={event?.endDate} $isChild={event?.parent} 
                        $isParentExpanded={isParentSelected(event.id)} $isSelected={eventSelected == event.id || keyCursorId === event.id} id={event.id} onClick={(e) => eventClick(event)}
                        style={{marginTop:`${event?.parent ? (isParentSelected(event.parent) ? 0 : -0.5) : 0}rem`,
                            transform:`translate(calc(${getEventX(event)}px), calc(${getEventY(event)}px + 0.1rem))`,
                            WebkitTransform:`translate(calc(${getEventX(event)}px), calc(${getEventY(event)}px + 0.1rem))`,
                            msTransform:`translate(calc(${getEventX(event)}px), calc(${getEventY(event)}px + 0.1rem))`}}
                        className={`${timelineStyles.events} ${timelineStyles[event.category]} ${event?.parent && timelineStyles.childEvent} ${event.id == eventSelected && timelineStyles.selectedEvent}`}>
                    <div style={{overflow:'hidden',height:'2rem'}}>
                      <span className={timelineStyles.eventTitle} ref={el => setRef(eventsRef, el, i)} style={{fontStyle:`${event.italics ? 'italic' : 'normal'}`}}>
                        {event.displayName}
                      </span>
                      <div style={{width:`calc(100% - ${isListedAsParent(event.id) ? 1 : 0}rem)`,height:'2rem',overflow:'hidden',right:`${isListedAsParent(event.id) ? 1 : 0}rem`,position:'absolute'}}>
                        {event?.endDate && (
                          <p className={timelineStyles.endDate}>
                            {` – ${dateFilterRender(event.endDate, event.specEndDate)}`}
                          </p>
                        )}
                        <p>
                          {dateFilterRender(event.startDate, event.specStartDate)}
                        </p>
                      </div>
                      <FilterIcon className={timelineStyles.filterIcon} filter={event.filter} onCompleted={onCompleted} onError={onError}></FilterIcon>
                    </div>
                    {(event?.endDate) && (
                      <div style={{width:`calc(${(timeScale * eventSpan(event)) < 22 ? 22 : (timeScale * eventSpan(event))}px)`,
                          position:'absolute',top:'-0.29rem',left:'-0.3rem',height:'calc(32px)',borderTopRightRadius:'0.6rem',borderBottomLeftRadius:'0rem',borderBottomRightRadius:'0rem',overflow:'hidden'}}
                          className={`eventRange ${timelineStyles.eventRange}`}>
                        <div className={`${timelineStyles[event.category + 'l']}`} style={{width:'100%',height:'0.25rem'}}></div>
                      </div>
                    )}
                    {(isListedAsParent(event.id)) && (
                      <button type="button" className={`${timelineStyles.parentExpand} ${timelineStyles[event.category + 'e']}`}
                          aria-expanded={isParentSelected(event.id)}
                          aria-label={`${isParentSelected(event.id) ? 'Collapse' : 'Expand'} events under ${event.displayName}`}
                          onClick={(e) => {e.stopPropagation();toggleParentSelection(event.id)}}>
                        <Icon className={`${timelineStyles.arrow} ${timelineStyles[event.category + 'Arrow']}`} icon={"arrow"} onCompleted={onCompleted} onError={onError}
                            style={{transform:`rotate(${isParentSelected(event.id) ? 0 : 180}deg)`,WebkitTransform:`rotate(${isParentSelected(event.id) ? 0 : 180}deg)`,
                              msTransform:`rotate(${isParentSelected(event.id) ? 0 : 180}deg)`}}>
                        </Icon>
                      </button>
                    )}
                  </HoverVisibleDiv>

                  {(event?.endDate && !(event?.parent && !isParentSelected(event.parent))) && (
                    <>
                      <div className={`${timelineStyles.eventsl} ${timelineStyles[event.category + 'l']}`} style={{width:`calc(${timeScale * eventSpan(event)}px)`,
                          height:'calc(30px)',
                          transform:`translate(${getEventX(event)}px, calc(${getEventY(event)}px + 0.1rem))`,
                          WebkitTransform:`translate(${getEventX(event)}px), calc(${getEventY(event)}px + 0.1rem))`,
                          msTransform:`translate(${getEventX(event)}px), calc(${getEventY(event)}px + 0.1rem))`
                        }}>
                      </div>
                    </>
                  )}

                </div>
              ) : (
                <div key={event.id ?? i} style={{...tlSweep(getEventX(event)),zIndex:50}} className={timelineStyles.eventDiv} onClick={(e) => e.stopPropagation()}>

                  <div className={`${timelineStyles.period} ${timelineStyles[event.category + 'Period']} ${event.id == eventSelected && timelineStyles.selectedPeriod}`} style={{width:`calc(${timeScale * eventSpan(event)}px + 2rem)`,
                      height:'29px',transform:`translate(calc(${getEventX(event)}px - 1rem), calc(${getEventY(event)}px + 0.1rem))`,
                      WebkitTransform:`translate(${getEventX(event)}px), calc(${getEventY(event)}px + 0.1rem))`,
                      msTransform:`translate(${getEventX(event)}px), calc(${getEventY(event)}px + 0.1rem))`}} onClick={() => eventClick(event)}>
                  </div>
                  <div className={`${timelineStyles.periodText} ${timelineStyles[event.category + 'Period']}`} style={{backgroundColor:'transparent',
                        transform:`translate(calc(${(Math.max(getEventX(event), timeX) + Math.min(getEventXEnd(event), timeX + width)) / 2}px - 50%), calc(${getEventY(event)}px + 0.05rem))`}}>
                    <FilterIcon className={timelineStyles.filterIconPeriod} filter={event.filter} onCompleted={onCompleted} onError={onError}></FilterIcon>
                      <span className={timelineStyles.eventTitle} style={{fontStyle:`${event.italics ? 'italic' : 'normal'}`}}>
                        {event.displayName}
                      </span>
                      <p>
                        ({dateFilterRender(event.startDate, event.specStartDate)} – {dateFilterRender(event.endDate, event.specEndDate)})
                      </p>
                  </div>

                </div>
              )
            )
          ))}

          {/* VERTICAL LINES */}
          {verticalGridlines}

          {/* HORIZONTAL LINES */}
          {[...Array((8 * 2) + 1)].map((e, i) => (
            (Math.abs((i * timeScale) - timeY) < height * 2) && (
              <React.Fragment key={i}>
                <div style={{transform:`translate(0rem, calc(${(i * 65)}px - 0.1rem))`,WebkitTransform:`translate(0rem, calc(${(i * 65)}px - 0.1rem))`,msTransform:`translate(0rem, calc(${(i * 65)}px - 0.1rem))`,
                    opacity:`${i % 2 == 0 ? 0.5 : 0.15}`,position:'absolute',width:'100%',height:'0.2rem',top:0,backgroundColor:'#76768B'}}></div>
              </React.Fragment>
            )
          ))}
          {[...Array(2)].map((e, i) => (
            (Math.abs((i * timeScale) - timeY) < height * 2) && (
              <React.Fragment key={i}>
                <div style={{transform:`translate(0rem, calc(${((i + 0.5) * 65)}px - 0.1rem))`,WebkitTransform:`translate(0rem, calc(${((i + 0.5) * 65)}px - 0.1rem))`,msTransform:`translate(0rem, calc(${((i + 0.5) * 65)}px - 0.1rem))`,
                    opacity:`0.15`,position:'absolute',width:'100%',height:'0.2rem',top:0,backgroundColor:'#76768B'}}></div>
              </React.Fragment>
            )
          ))}

        </div>
      </section>

      {/* NUMBER LINE — YEARS */}
      <section className={`${timelineStyles.numberLine} ${utilStyles.scrollable}`} onScroll={onNumberLineScroll} ref={numberLineRef}>
        <div style={{position:'absolute',height:'100%',width:`calc(${timeLimX}px)`,overflow:'hidden'}}>
          {yearTicks}
        </div>
      </section>

      {/* MARKERS */}
      <div className={`${timelineStyles.markerYear}`}>
        <div style={{height:height - ((height - 64) * borderY),opacity:`${scrolling ? 1 : 0.5}`,transition:`opacity ${scrolling ? 0.1 : 1}s`,WebkitTransition:`opacity ${scrolling ? 0.1 : 1}s`,msTransition:`opacity ${scrolling ? 0.1 : 1}s`}}
            className={`${timelineStyles.markerLine}`}></div>
        <div style={{opacity:`${scrolling ? 1 : 0.5}`,transition:`opacity ${scrolling ? 0.1 : 1}s`,WebkitTransition:`opacity ${scrolling ? 0.1 : 1}s`,msTransition:`opacity ${scrolling ? 0.1 : 1}s`}} className={timelineStyles.marker}></div>
        <input type='text' maxLength={10} aria-label='Jump to a year or date' placeholder={convertDecimalYearToDate(timeYear)} style={{opacity:`${scrolling ? 1 : 0.5}`,width:'7.5rem',transition:`opacity ${scrolling ? 0.1 : 1}s`,WebkitTransition:`opacity ${scrolling ? 0.1 : 1}s`,
            msTransition:`opacity ${scrolling ? 0.1 : 1}s`}} onKeyDown={yearInput}/>
      </div>
    </Layout>
  );
}