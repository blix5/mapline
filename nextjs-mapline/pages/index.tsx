import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import ReactLink from 'next/link';

import Draggable, {DraggableCore} from 'react-draggable';
import { parseAsFloat, useQueryState } from 'next-usequerystate';
import styled from 'styled-components';
import { Link, Button, Element, Events, animateScroll as scroll, scrollSpy } from 'react-scroll';
import Fuse from 'fuse.js';

import Date from '../components/date';
import useWindowDimensions from '../components/useWindowDimensions';
import Layout, { siteTitle } from '../components/layout';

import utilStyles from '../styles/utils.module.css';
import indexStyles from '../styles/index.module.css';
import mapStyles from '../styles/map/map.module.css';
import infoStyles from '../styles/map/info.module.css';
import stateStyles from '../styles/map/states.module.css';
import timelineStyles from '../styles/timeline/timeline.module.css';

import { getStateList, getLocations, getTimeline } from '../libs/sheets';

import State from '../libs/map/State';
import MapSvg from '../libs/map/MapSvg';
import { LowProjectionLCC, LowTopProjectionLCC, MediumProjectionLCC, MediumTopProjectionLCC, MediumTopLabelProjectionLCC, MediumTopRiverLabelProjectionLCC, HighTopLabelProjectionLCC, latLonToX, latLonToY } from '../libs/map/LambertConformalConicMap';
import FilterIcon from '../libs/FilterIcon';
import Icon from '../libs/Icon';

import HoverVisibleDiv from '../libs/HoverVisibleDiv';

import { convertDecimalYearToDate, convertDateToDecimal } from '../libs/dateDecimal';
import categoryToIndex from '../libs/categoryIndex';
import { dateFilterRender, convertDate } from '../libs/dateFilterRender';
import UrlToAbstract from '../libs/wikipediaAbstract';

import compassDimensions from '../libs/map/mapUtils';
import { p } from 'next-usequerystate/dist/serializer-C_l8WgvO';

export async function getStaticProps(context) {
  const states = await getStateList();
  const events = await getTimeline();
  const locations = await getLocations();
  return {
    props: {
      states: states.slice(1, states.length),
      locations: locations.slice(1, locations.length),
      events: events.slice(1, events.length)
    },
    revalidate: 1,
  };
}

const isEvenIndexInCategory = (event, events) => {
  const categoryEvents = events.filter(e => e.category === event.category && (e?.parent === event?.parent));
  const eventIndex = categoryEvents.findIndex(e => e.id === event.id);
  return eventIndex % 2 === 0;
};
const remainderQuadIndexPeriod = (event, events) => {
  const periodEvents = events.filter(e => e.period);
  const periodIndex = periodEvents.findIndex(e => e.id == event.id);
  return periodIndex % 4;
}


export default function Home({ states, locations, events, onCompleted, onError }) {
  const startYear = 1480;
  const endYear = 2020;

  const [inHidden, setInHidden] = useState(-1);
  const { width, height } = useWindowDimensions();
  const [borderY, setBorderY] = useQueryState('div', parseAsFloat.withDefault(0.6));

  const [mapX, setMapX] = useQueryState('mpx', parseAsFloat.withDefault(-1450));
  const [mapY, setMapY] = useQueryState('mpy', parseAsFloat.withDefault(-275));
  const [mapScale, setMapScale] = useQueryState('mps', parseAsFloat.withDefault(1));
  const [isDragging, setIsDragging] = useState(false);
  const [mousePos, setMousePos] = useState({ x: null, y: null });

  const [originalMousePos, setOriginalMousePos] = useState({ x: null, y: null });
  const [originalMapPos, setOriginalMapPos] = useState({ x: null, y: null });

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

  const [timeX, setTimeX] = useQueryState('tpx', parseAsFloat.withDefault(0));
  const [timeY, setTimeY] = useQueryState('tpy', parseAsFloat.withDefault(0));
  const [timeScale, setTimeScale] = useQueryState('tps', parseAsFloat.withDefault(100));
  const [timeYear, setTimeYear] = useQueryState('year', parseAsFloat.withDefault(1776.5));

  const mapLimX = 2400;
  const mapLimY = 1280;

  const timeLimX = useMemo(() => (endYear - startYear + 1) * timeScale, [endYear, startYear, timeScale]);
  const timeLimY = 65 * (8 * 2);

  const numberLineRef = useRef(null);
  const timelineRef = useRef(null);
  const eventsRef = useRef<Array<HTMLDivElement | null>>([]);
  const eventsPinRef = useRef<Array<HTMLDivElement | null>>([]);
  const eventsPinDivRef = useRef<Array<HTMLDivElement | null>>([]);

  const [refsUpdated, setRefsUpdated] = useState(false);

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
    if (eventSelected !== null) {
      if(!eventsOpen.includes(eventSelected)) {
        setEventsOpen(prevEvents => [...prevEvents, eventSelected]);
      }
      setEventOpenSelected(eventSelected);
    }
  }, [eventSelected]);
  useEffect(() => {
  }, [events.length]);
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
  useEffect(() => {
    if (refsUpdated) {
      setRefsUpdated(false);
    }
  }, [refsUpdated]);
  const setRef = (refArray, el, i) => {
    refArray.current[i] = el;
    setRefsUpdated(true);
  };

  const yearInput = (e) => {
    if (e.key === 'Enter') {
      const decimalYear = convertDateToDecimal(e.target.value);
      if (decimalYear != null) {
        setTimeYear(decimalYear);
        const newTime = (timeScale * (decimalYear - startYear + 0.5)) - (width / 2);
        setTimeX(newTime);
        setScrolling(true);
        scroll.scrollTo(newTime, { smooth: true, containerId: 'timeline', duration: 500, horizontal: true });
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
    const uniqueParents = Array.from(uniqueParentsSet).map(parent => ({ parent, expanded: false }));
    setParents(uniqueParents);
  }, []);
  const toggleParentSelection = (parentName) => {
    setParents(prevParents =>
      prevParents.map((event) =>
        event.parent === parentName ? { ...event, expanded: !event.expanded } : event
      )
    );
  }
  const getCurrentState = (id) => {
    const allStatesWithId = states
        .filter(state => state !== null && state !== undefined && state.id === id);
    return allStatesWithId.find(state => convertDateToDecimal(state.endDate) >= timeYear && convertDateToDecimal(state.startDate) <= timeYear);
  }
  const oopsieDaisies = (id) => {
    return states.find(state => state.id == id);
  }
  const getLocation = (id) => {
    return locations.find(location => location.id == id);
  }
  const isParentSelected = (parent) => {
    const parentObj = parents.find(p => p.parent === parent);
    return parentObj ? parentObj.expanded : false;
  }
  const isListedAsParent = (id) => {
    return parents.some(parent => parent.parent === id);
  }
  const isListedAsState = (id) => {
    return states.some(state => state.id === id);
  }
  const isListedAsLoc = (id) => {
    return locations.some(location => location.id === id);
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

  const onNumberLineScroll = useCallback((e) => {
    const xScroll = numberLineRef.current?.scrollLeft;
  
    let newX = xScroll;
    timelineRef.current.scrollLeft = xScroll;
  
    setTimeX(newX);
    setTimeYear((((newX) + width / 2) / timeScale) + (startYear - 0.5));
    setScrolling(true);
  }, [numberLineRef, timelineRef, width, timeScale, startYear]);
  const onTimelineScroll = useCallback((e) => {
    const xScroll = timelineRef.current?.scrollLeft;
    const yScroll = timelineRef.current?.scrollTop;
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const scrollRatio = scrollTop / (scrollHeight - clientHeight);

    var newX = xScroll;
    var newY = yScroll;
    numberLineRef.current.scrollLeft = xScroll;

    setTimeX(newX);
    setTimeY(newY);
    setTimeYear((((timeX) + width / 2) / timeScale) + (startYear - 0.5));
    setScrolling(true);
  }, [timelineRef, numberLineRef, width, timeScale, startYear]);
  const onTimelineZoom = useCallback((value) => {
    const xTime = (timeX + (width / 2)) / timeScale;

    setTimeScale(value);

    const newX = (xTime * value) - (width / 2);

    numberLineRef.current.scrollLeft = newX;
    timelineRef.current.scrollLeft = newX;

    setTimeX(newX);
    setScrolling(true);
  }, [timelineRef, numberLineRef, width, timeScale, timeX]);

  const getLocX = (event) => {
    if(event?.location) {
      if(isListedAsState(event.location)) {
        const locSel = getCurrentState(event.location) || oopsieDaisies(event.location);
        return Number(locSel.x) + Number(locSel.xLabel) + (Number(locSel.width) / 2);
      } else if(isListedAsLoc(event.location)) {
        const locSel = getLocation(event.location);
        return latLonToX(Number(locSel.lat), Number(locSel.long));
      } else {
        return null;
      }
    } else {
      return null;;
    }
  }
  const getLocY = (event) => {
    if(event?.location) {
      if(isListedAsState(event.location)) {
        const locSel = getCurrentState(event.location) || oopsieDaisies(event.location);
        return Number(locSel.y) + Number(locSel.yLabel) + (Number(locSel.height) / 2);
      } else if(isListedAsLoc(event.location)) {
        const locSel = getLocation(event.location);
        return latLonToY(Number(locSel.lat), Number(locSel.long));
      } else {
        return null;
      }
    } else {
      return null;;
    }
  }
  const getEventX = (event) => { return ((convertDateToDecimal(event.startDate) - startYear + 0.5) * timeScale); }
  const getEventXEnd = (event) => { return ((!event?.endDate || ((convertDateToDecimal(event.endDate) - convertDateToDecimal(event.startDate)) * timeScale < 130)) ? ((convertDateToDecimal(event.startDate) - startYear) * timeScale + 130) :
      ((convertDateToDecimal(event.endDate) - startYear) * timeScale)) + (timeScale * 0.4); }
  const getEventY = (event) => { return ((event.period) ? (remainderQuadIndexPeriod(event, events) * (65 / 2)) : ((categoryToIndex(event.category) * 65 * 2) + (isEvenIndexInCategory(event, events) ? 0 : 65))); }
  const eventClick = (event) => {
    if(event?.id) {
      const clickX = getEventX(event);
      const clickY = getEventY(event) - ((height - ((height - 64) * borderY) - 200) / 2);

      scroll.scrollTo(clickX - width / 2, { smooth: true, containerId: 'timeline', duration: 500, horizontal: true });
      scroll.scrollTo(clickY, { smooth: true, containerId: 'timeline', duration: 500, horizontal: false })
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
    return (Math.abs(getEventX(event) - (timeX + (width / 2))) < (width / 2 + 65)) || (Math.abs(getEventXEnd(event) - (timeX + (width / 2))) < (width / 2 + 65));
  }
  const indexAtLoc = (event) => {
    const eventsVisible = events.filter(e => e !== null && e !== undefined && eventVisible(e) && e.location == event.location);
    return eventsVisible.indexOf(event);
  }
  const eventFromId = (eventId) => {
    return events.find(e => e.id == eventId);
  }
  const eventsAtLocLen = (event) => {
    const eventsVisible = events.filter(e => e !== null && e !== undefined && eventVisible(e) && e.location == event.location);
    return eventsVisible.length;
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      timelineRef.current.scrollLeft = timeX;
      timelineRef.current.scrollTop = timeY;
      numberLineRef.current.scrollLeft = timeX;
    }, 300);
    return () => clearTimeout(timer);
  }, [timeX, timeY]);

  return (
    <Layout page="history">
      <Head>
        <title>{siteTitle}</title>
      </Head>

      {/* MAP */}

      <section id={`map`} className={mapStyles.map} onWheel={onMapScroll} style={{height:`${(height - 64) * borderY}px`}}>
        <svg width={'10rem'} height={'100%'} style={{background:`linear-gradient(90deg, rgba(0,0,0,0.8), transparent)`,zIndex:109}}></svg>
        <Image className={mapStyles.compass} src="/images/compass.png" height={256} width={256} alt="compass" style={{height:`${compassDimensions(height, borderY)}px`,width:`${compassDimensions(height, borderY)}px`,
            top:`calc(${((height - 64) * borderY)}px - ${compassDimensions(height, borderY)}px - 1.2rem)`}}/>
        <DraggableCore onDrag={(e, data) => {onMapDrag(data)}} onMouseDown={(e) => {setOriginalMousePos({ x: e.clientX, y: e.clientY });setOriginalMapPos({ x: mapX, y: mapY })}} onStart={() => setIsDragging(true)} onStop={() => setIsDragging(false)}>
          <div onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })} style={{position:"absolute",width:"100%",height:"100%",zIndex:100,transform:`translate(${mapX}px, ${mapY}px) scale(${mapScale})`,WebkitTransform:`translate(${mapX}px, ${mapY}px) scale(${mapScale})`,
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
                <LowProjectionLCC width={8000} height={7000} style={{zIndex:'-50',left:-2800,top:-3100}}/>
                <LowTopProjectionLCC width={8000} height={7000} style={{transition:`opacity 0.5s linear`,opacity:`${mapScale < 0.6 ? 1 : 0}`,zIndex:'110',pointerEvents:'none',left:-2800,top:-3100}}/>
              </>
            ) : (
              <>
                <MediumProjectionLCC width={8000} height={7000} style={{zIndex:'-50',pointerEvents:'none',left:-2800,top:-3100}}/>
                <MediumTopProjectionLCC width={8000} height={7000} style={{transition:`opacity 0.5s linear`,opacity:`${(mapScale >= 0.6) ? 1 : 0}`,zIndex:'110',pointerEvents:'none',left:-2800,top:-3100}}/>
                {(mapScale > 4) ? (
                  <HighTopLabelProjectionLCC width={8000} height={7000} style={{transition:`opacity 0.5s linear`,opacity:`${mapScale > 4 ? 1 : 0}`,zIndex:'110',pointerEvents:'none',left:-2800,top:-3100}}/>
                ) : (
                  (mapScale >= 1.5) && (
                    <MediumTopLabelProjectionLCC width={8000} height={7000} style={{transition:`opacity 0.5s linear`,opacity:`${(mapScale >= 1.5 && mapScale <= 4) ? 1 : 0}`,zIndex:'110',pointerEvents:'none',left:-2800,top:-3100}}/>
                  )
                )}
                {(mapScale >= 3) && (
                  <MediumTopRiverLabelProjectionLCC width={8000} height={7000} style={{transition:`opacity 0.5s linear`,opacity:`${(mapScale >= 3) ? 1 : 0}`,zIndex:'110',pointerEvents:'none',left:-2800,top:-3100}}/>
                )}
              </>
            )}
            
            {states.map((state, index) => (
              <>
                {(convertDateToDecimal(state.startDate) <= timeYear && convertDateToDecimal(state.endDate) > timeYear) &&
                  <>
                    <State name={state.name} className={`${stateStyles.state} ${locSel == state.id && ((Number(convertDateToDecimal(state.stateDate)) > timeYear) ? stateStyles.nonStateHover : stateStyles.stateHover)}
                        ${(Number(convertDateToDecimal(state.stateDate)) > timeYear) && stateStyles.nonState}`}
                        width={Number(state.width) + 5} height={Number(state.height) + 5}
                        style={{left:Number(state.x),top:Number(state.y),strokeWidth:`${0.4 / mapScale + 0.2}rem`}}
                        onCompleted={onCompleted} onError={onError} id={state.id}
                        onMouseEnter={() => (setInHidden(index))}
                        onMouseLeave={() => inHidden == index && setInHidden(-1)}
                    />
                    <div style={{left:Number(state.x) + Number(state.xLabel), top:Number(state.y) + Number(state.yLabel), width:Number(state.width) + 5, height:Number(state.height) + 5,
                        fontSize: 6 * Math.pow((2/3) * Number(state.width) + (1/3) * Number(state.height), 0.3)}}>
                      <h2 className={`${stateStyles.state} ${stateStyles.stateLabel} ${(Number(convertDateToDecimal(state.stateDate)) > timeYear) && stateStyles.nonStateLabel}`}
                            style={{transformOrigin:`center center`,transform:`scale(${0.4 / mapScale + 0.3})`,opacity: `${(inHidden == index || locSel == state.id) ? 0.6 : 0}`}}>
                        {state.displayName + ((Number(convertDateToDecimal(state.stateDate)) > timeYear) ? ' Territory' : '')}
                      </h2>
                    </div>
                  </>
                }
              </>
            ))}

            {locations.map((location, index) => (((convertDateToDecimal(location.foundDate) <= timeYear) &&
                ((location.size == 5) || (location.size == 4 && mapScale > 0.4) || (location.size == 3 && mapScale > 1) || (location.size == 2 && mapScale > 1.7) || (location.size == 1 && mapScale > 2.5))) || (location.id == locSel)) && (
              <>
                <div style={{transformOrigin:`top left`,transform:`scale(${(location.size / 10 + 0.3) / mapScale + 0.1})`,pointerEvents:'none',position:'absolute',width:'13rem',zIndex:115,left:`${latLonToX(location.lat, location.long)}px`,top:`${latLonToY(location.lat, location.long)}px`}}>
                  <div className={`${mapStyles.locationDot}`} style={{opacity:(locHoverNear(latLonToX(location.lat, location.long), latLonToY(location.lat, location.long)) || locSel == location.id) ? 1 : (0.3 + (location.size / 10))}}></div>
                  <h3 className={`${mapStyles.locationLabel} ${(!locHoverNear(latLonToX(location.lat, location.long), latLonToY(location.lat, location.long)) && locSel != location.id) && mapStyles.locationLabelHidden}`}>{location.displayName}</h3>
                </div>
              </>
            ))}

            {events.map((event, i) => ((getLocX(event) != null && event.location != null && (eventVisible(event) || event.id == eventSelected || eventsOpen.find(e => e == event.id) != null)) &&
              ((eventsAtLocLen(event) <= 1 || event.id == eventSelected) ? (
                <MapSvg className={`${timelineStyles.eventsp} ${timelineStyles[event.category + 'p']} ${eventSelected == event.id && timelineStyles.selectedPin}`} width={40} height={30} style={{transformOrigin:`bottom center`,
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
                  <div className={`${timelineStyles.eventspMulti} ${locSel == event.location && timelineStyles.selectedPin}`} style={{transformOrigin:`bottom center`,
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
                      <h3>
                        {eventsAtLocLen(event)}
                      </h3>
                    </div>

                    {/* EVENT LIST AT LOC */}
                    {(locSel == event.location && (
                      <>
                        <div className={timelineStyles.eventspListArrow} style={{transformOrigin:`center left`,transform:`translate(${0}px, -50%) scale(0.6)`}}></div>
                        <div className={`${utilStyles.scrollable} ${timelineStyles.eventspList}`} style={{width:`calc(${Math.max(...eventsPinDivRef.current.map(el => el ? el.offsetWidth : 0))}px +
                            ${eventsAtLocLen(event) * 72 - 10 > 450 ? 0.9 : 0}rem)`,pointerEvents:'auto',height:`calc(${Math.min(eventsAtLocLen(event) * 72 - 10, 450)}px)`,
                            transformOrigin:`center left`,transform:`translate(${0}px, -50%) scale(0.6)`,overflowY:`${eventsAtLocLen(event) * 72 - 10 < 450 ? 'hidden' : 'scroll'}`}} onWheel={(e) => e.stopPropagation()}>
                          {events.filter(e => e !== null && e !== undefined && eventVisible(e) && e.location == event.location).map((eInList, j) => (
                            <>
                              <div ref={el => setRef(eventsPinDivRef, el, j)} className={`${timelineStyles.events} ${timelineStyles.eventspListEvent} ${timelineStyles[eInList.category]}`} style={{transform:`translate(0px, ${indexAtLoc(eInList) * 72}px)`,
                                  width:`calc(${(eventsPinRef.current[j]?.offsetWidth < (130 + (eInList?.endDate && 70))) ? (129 + (eInList?.endDate && 70)) : (eventsPinRef.current[j]?.offsetWidth - 0.01)}px + 1rem)`}}
                                  onMouseDownCapture={mapMouseDown}
                                  onMouseUpCapture={(e) => {
                                    const {x, y} = tempMousePos.current;
                                    if (Math.abs(e.clientX - x) < 2 && Math.abs(e.clientY - y) < 2) {
                                      eventClick(eInList);
                                    }
                                  }}
                              >
                                <div className={timelineStyles.eventDiv} style={{overflow:'hidden',width:'100%',height:'100%'}}>
                                  <h6 ref={el => setRef(eventsPinRef, el, j)} style={{marginTop:4,fontStyle:`${eInList.italics ? 'italic' : 'normal'}`}}>
                                    {eInList.displayName}
                                  </h6>
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
                            </>
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
        {(eventOpenSelected != null) && (
          <div className={infoStyles.infoBox} style={{width:`${(((height - 64) * borderY) + (width / 4)) / 2}px`,height:`${(height - 64) * borderY}px`,left:`calc(${width}px - ${(((height - 64) * borderY) + (width / 4)) / 2}px)`}}>
            <div className={`${infoStyles.infoBoxDivBack}`} style={{width:`calc(100% - 2rem)`,height:`calc(${(height - 64) * borderY}px - 2rem)`}} onWheel={(e) => e.stopPropagation()}></div>
            <div className={`${infoStyles.infoBoxDiv}`} style={{width:`calc(100% - 2rem)`,height:`calc(${(height - 64) * borderY}px - 2rem)`}} onWheel={(e) => e.stopPropagation()}>

              <div className={`${infoStyles.infoBoxTabs}`}>
                {eventsOpen.map((eOpen, i) => (
                  <div className={`${infoStyles.infoBoxTab} ${timelineStyles[eventFromId(eOpen).category + 'Tab']} ${eventOpenSelected == eOpen && infoStyles.infoBoxTabSel}`} onClick={() => setEventOpenSelected(eOpen)}>
                    <p style={{fontStyle:`${eventFromId(eOpen).italics ? 'italic' : 'normal'}`}}>
                      {eventFromId(eOpen).displayName}
                    </p>
                    <MapSvg name={'close'} onCompleted={onCompleted} onError={onError} width={'1rem'} height={'1rem'} className={`${infoStyles.infoBoxClose}`} onClick={(e) => {
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
                    }}/>
                  </div>
                ))}
              </div>

              <div className={`${infoStyles.infoBoxDivInner} ${utilStyles.scrollable}`}>
                <h1 className={`${timelineStyles[eventFromId(eventOpenSelected).category + 'Text']}`} style={{fontStyle:`${eventFromId(eventOpenSelected).italics ? 'italic' : 'normal'}`}}>
                  {eventFromId(eventOpenSelected)?.fullName || eventFromId(eventOpenSelected)?.displayName}
                  {(eventFromId(eventOpenSelected)?.aka) && (
                    <h3>
                      A.K.A. {eventFromId(eventOpenSelected).aka}
                    </h3>
                  )}
                </h1>
                
                <h2 className={`${timelineStyles[eventFromId(eventOpenSelected).category + 'Text']}`} onClick={() => eventClick(eventFromId(eventOpenSelected))}>
                  {convertDate(String(dateFilterRender(eventFromId(eventOpenSelected)?.startDate, eventFromId(eventOpenSelected)?.specStartDate)))}
                  {eventFromId(eventOpenSelected)?.endDate && 
                    ` – ${convertDate(String(dateFilterRender(eventFromId(eventOpenSelected)?.endDate, eventFromId(eventOpenSelected)?.specEndDate)))}`
                  }
                </h2>
                {(eventFromId(eventOpenSelected)?.location) && (
                  <h4 onClick={() => locationClick(eventFromId(eventOpenSelected).location)}>
                    {isListedAsLoc(eventFromId(eventOpenSelected).location) && getLocation(eventFromId(eventOpenSelected).location)?.displayName}
                    {isListedAsState(eventFromId(eventOpenSelected).location) && (getCurrentState(eventFromId(eventOpenSelected).location)?.displayName || oopsieDaisies(eventFromId(eventOpenSelected).location)?.displayName)}
                    <MapSvg width={11} name={'pin'} onCompleted={onCompleted} onError={onError}/>
                  </h4>
                )}

                <UrlToAbstract url={eventFromId(eventOpenSelected).wikiLink} className={infoStyles.infoBoxInfo} />
                <a target='_blank' href={eventFromId(eventOpenSelected).wikiLink}>Wikipedia</a>
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
      <input type='range' value={timeScale} min={30} max={350} onChange={(e) => onTimelineZoom(Number(e.target.value))} className={timelineStyles.timeScale}
          style={{top:`calc(${(height - 64) * borderY}px + 4rem)`,backgroundSize:`${((timeScale - 30) * 100) / 320}% 100%`,width:`${0.25 * (height - ((height - 64) * borderY))}px`}}/>
      <input type='text' placeholder='Search... &#x1F50D;' onChange={handleSearch} onKeyDown={searchEnter}
          style={{top:`calc(${(height - 64) * borderY}px + 4rem)`,left:`calc(${width}px - 11.5rem)`}} className={timelineStyles.search}/>
      {(searchMatches != null && searchMatches != undefined && searchMatches.length > 0) && (
        <div style={{position:'absolute',width:'100%',left:`calc(${width}px - 11.5rem)`,height:`calc(${Math.min(searchMatches.length * 43 - 5, height - ((height - 64) * borderY) - 210)}px)`,
            marginLeft:'0.65rem',marginTop:'2.9rem'}}>
          <div className={`${utilStyles.scrollable} ${timelineStyles.searchResults}`} style={{width:`15.7rem`,pointerEvents:'auto',height:`${100 / 0.6}%`,transformOrigin:`top left`,transform:`scale(0.6)`,
                overflowY:`${searchMatches.length * 43 - 5 < height - ((height - 64) * borderY) - 210 ? 'hidden' : 'scroll'}`}}>
            {searchMatches.map((eInList, j) => (
              <div className={`${timelineStyles.events} ${timelineStyles.eventspListEvent} ${timelineStyles[eInList.category]}`} style={{transform:`translate(0px, ${j * 72}px)`,
                  width:`calc(${(searchResultsRef.current[j]?.offsetWidth < (130 + (eInList?.endDate && 70))) ? (129 + (eInList?.endDate && 70)) : (searchResultsRef.current[j]?.offsetWidth - 0.01)}px + 1rem)`,maxWidth:`15.7rem`}}
                  onMouseDownCapture={mapMouseDown}
                  onMouseUpCapture={(e) => {
                    const {x, y} = tempMousePos.current;
                    if (Math.abs(e.clientX - x) < 2 && Math.abs(e.clientY - y) < 2) {
                      eventClick(eInList);
                    }
                  }}
              >
                <div className={timelineStyles.eventDiv} style={{overflow:'hidden',width:'100%',height:'100%'}}>
                  <h6 ref={el => searchResultsRef.current[j] = el} style={{marginTop:4,fontStyle:`${eInList.italics ? 'italic' : 'normal'}`}}>
                    {eInList.displayName}
                  </h6>
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
          style={{height:`calc(${height - ((height - 64) * borderY)}px - 7.1rem)`,position:'absolute'}}>
        <div style={{position:"absolute",top:0,height:`${timeLimY}px`,width:`calc(${timeLimX}px - 0.9rem)`,overflow:'hidden'}} onMouseUpCapture={() => {if(!isDragging) { eventClick(null); setLocSel(null); }}}>
          {events.map((event, i) => (
            ((getEventX(event) < timeX + (width * 1.1)) && (getEventXEnd(event) > timeX)) && (
              (!event.period) ? (
                <div style={{zIndex:50}} className={timelineStyles.eventDiv} onClick={(e) => e.stopPropagation()}>

                  <HoverVisibleDiv $length={(eventsRef.current[i]?.offsetWidth < (130 + (event?.endDate && 70))) ? (129 + (event?.endDate && 70)) : (eventsRef.current[i]?.offsetWidth - 0.01)} $opacity={(event.importance / 9) + 0.4} 
                        $isParent={isListedAsParent(event.id)} $expanded={(event?.parent ? (isParentSelected(event.parent)) : true)} $corners={event?.endDate} $isChild={event?.parent} 
                        $translateX={getEventX(event)} $translateY={getEventY(event)}
                        $isParentExpanded={isParentSelected(event.id)} $isSelected={eventSelected == event.id} key={i} id={event.id} onClick={(e) => eventClick(event)}
                        style={{marginTop:`${event?.parent ? (isParentSelected(event.parent) ? 0 : -0.5) : 0}rem`}}
                        className={`${timelineStyles.events} ${timelineStyles[event.category]} ${event?.parent && timelineStyles.childEvent} ${event.id == eventSelected && timelineStyles.selectedEvent}`}>
                    <div style={{overflow:'hidden',height:'2rem'}}>
                      <h6 ref={el => setRef(eventsRef, el, i)} style={{fontStyle:`${event.italics ? 'italic' : 'normal'}`}}>
                        {event.displayName}
                      </h6>
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
                      <div style={{width:`calc(${(timeScale * (convertDateToDecimal(event.endDate) - convertDateToDecimal(event.startDate))) < 22 ? 22 : (timeScale * (convertDateToDecimal(event.endDate) - convertDateToDecimal(event.startDate)))}px)`,
                          position:'absolute',top:'-0.29rem',left:'-0.3rem',height:'calc(32px)',borderTopRightRadius:'0.6rem',borderBottomLeftRadius:'0rem',borderBottomRightRadius:'0rem',overflow:'hidden'}}
                          className={`eventRange ${timelineStyles.eventRange}`}>
                        <div className={`${timelineStyles[event.category + 'l']}`} style={{width:'100%',height:'0.25rem'}}></div>
                      </div>
                    )}
                    {(isListedAsParent(event.id)) && (
                      <div style={{}} className={`${timelineStyles.parentExpand} ${timelineStyles[event.category + 'e']}`} onClick={(e) => {e.stopPropagation();toggleParentSelection(event.id)}}>
                        <Icon className={`${timelineStyles.arrow} ${timelineStyles[event.category + 'Arrow']}`} icon={"arrow"} onCompleted={onCompleted} onError={onError}
                            style={{transform:`rotate(${isParentSelected(event.id) ? 0 : 180}deg)`,WebkitTransform:`rotate(${isParentSelected(event.id) ? 0 : 180}deg)`,
                              msTransform:`rotate(${isParentSelected(event.id) ? 0 : 180}deg)`}}>
                        </Icon>
                      </div>
                    )}
                  </HoverVisibleDiv>

                  {(event?.endDate && !(event?.parent && !isParentSelected(event.parent))) && (
                    <>
                      <div className={`${timelineStyles.eventsl} ${timelineStyles[event.category + 'l']}`} style={{width:`calc(${timeScale * (convertDateToDecimal(event.endDate) - convertDateToDecimal(event.startDate))}px)`,
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
                <div style={{zIndex:50}} className={timelineStyles.eventDiv} onClick={(e) => e.stopPropagation()}>

                  <div className={`${timelineStyles.period} ${timelineStyles[event.category + 'Period']} ${event.id == eventSelected && timelineStyles.selectedPeriod}`} style={{width:`calc(${timeScale * (convertDateToDecimal(event.endDate) - convertDateToDecimal(event.startDate))}px + 2rem)`,
                      height:'29px',transform:`translate(calc(${getEventX(event)}px - 1rem), calc(${getEventY(event)}px + 0.1rem))`,
                      WebkitTransform:`translate(${getEventX(event)}px), calc(${getEventY(event)}px + 0.1rem))`,
                      msTransform:`translate(${getEventX(event)}px), calc(${getEventY(event)}px + 0.1rem))`}} onClick={() => eventClick(event)}>
                  </div>
                  <div className={`${timelineStyles.periodText} ${timelineStyles[event.category + 'Period']}`} style={{backgroundColor:'transparent',
                        transform:`translate(calc(${(Math.max(getEventX(event), timeX) + Math.min(getEventXEnd(event), timeX + width)) / 2}px - 50%), calc(${getEventY(event)}px + 0.05rem))`}}>
                    <FilterIcon className={timelineStyles.filterIconPeriod} filter={event.filter} onCompleted={onCompleted} onError={onError}></FilterIcon>
                      <h6 style={{fontStyle:`${event.italics ? 'italic' : 'normal'}`}}>
                        {event.displayName}
                      </h6>
                      <p>
                        ({dateFilterRender(event.startDate, event.specStartDate)} – {dateFilterRender(event.endDate, event.specEndDate)})
                      </p>
                  </div>

                </div>
              )
            )
          ))}

          {/* VERTICAL LINES */}
          {[...Array(endYear - startYear + 1)].map((e, i) => (
            (Math.abs((i * timeScale) - timeX) < width * 2) && (
              <>
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
              </>
            )
          ))}

          {/* HORIZONTAL LINES */}
          {[...Array((8 * 2) + 1)].map((e, i) => (
            (Math.abs((i * timeScale) - timeY) < height * 2) && (
              <>
                <div style={{transform:`translate(0rem, calc(${(i * 65)}px - 0.1rem))`,WebkitTransform:`translate(0rem, calc(${(i * 65)}px - 0.1rem))`,msTransform:`translate(0rem, calc(${(i * 65)}px - 0.1rem))`,
                    opacity:`${i % 2 == 0 ? 0.5 : 0.15}`,position:'absolute',width:'100%',height:'0.2rem',top:0,backgroundColor:'#76768B'}}></div>
              </>
            )
          ))}
          {[...Array(2)].map((e, i) => (
            (Math.abs((i * timeScale) - timeY) < height * 2) && (
              <>
                <div style={{transform:`translate(0rem, calc(${((i + 0.5) * 65)}px - 0.1rem))`,WebkitTransform:`translate(0rem, calc(${((i + 0.5) * 65)}px - 0.1rem))`,msTransform:`translate(0rem, calc(${((i + 0.5) * 65)}px - 0.1rem))`,
                    opacity:`0.15`,position:'absolute',width:'100%',height:'0.2rem',top:0,backgroundColor:'#76768B'}}></div>
              </>
            )
          ))}

        </div>
      </section>

      {/* NUMBER LINE — YEARS */}
      <section className={`${timelineStyles.numberLine} ${utilStyles.scrollable}`} onScroll={onNumberLineScroll} ref={numberLineRef}>
        <div style={{position:'absolute',height:'100%',width:`calc(${timeLimX}px)`,overflow:'hidden'}}>
          {[...Array(endYear - startYear + 1)].map((e, i) => (
            (Math.abs((i * timeScale) - timeX) < width * 2) && (
              <>
                {(timeScale > 100 || (i % 2 == 0 && (timeScale > 40 || i % 4 == 0))) && (
                  <h2 style={{transform:`translate(${(i * timeScale) - (timeScale > 100 ? 0 : (timeScale * 0.5))}px, 0rem)`,WebkitTransform:`translate(${(i * timeScale) - (timeScale > 100 ? 0 : (timeScale * 0.5))}px, 0rem)`,
                      msTransform:`translate(${(i * timeScale) - (timeScale > 100 ? 0 : (timeScale * 0.5))}px, 0rem)`,width:`${timeScale > 100 ? timeScale : (timeScale * 2)}px`,textAlign:'center'}}>
                    {(i + startYear)}
                  </h2>
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
              </>
            )
          ))}
        </div>
      </section>

      {/* MARKERS */}
      <div className={`${timelineStyles.markerYear}`}>
        <div style={{height:height - ((height - 64) * borderY),opacity:`${scrolling ? 1 : 0.5}`,transition:`opacity ${scrolling ? 0.1 : 1}s`,WebkitTransition:`opacity ${scrolling ? 0.1 : 1}s`,msTransition:`opacity ${scrolling ? 0.1 : 1}s`}}
            className={`${timelineStyles.markerLine}`}></div>
        <div style={{opacity:`${scrolling ? 1 : 0.5}`,transition:`opacity ${scrolling ? 0.1 : 1}s`,WebkitTransition:`opacity ${scrolling ? 0.1 : 1}s`,msTransition:`opacity ${scrolling ? 0.1 : 1}s`}} className={timelineStyles.marker}></div>
        <input type='text' maxLength={10} placeholder={convertDecimalYearToDate(timeYear)} style={{opacity:`${scrolling ? 1 : 0.5}`,width:'7.5rem',transition:`opacity ${scrolling ? 0.1 : 1}s`,WebkitTransition:`opacity ${scrolling ? 0.1 : 1}s`,
            msTransition:`opacity ${scrolling ? 0.1 : 1}s`}} onKeyDown={yearInput}/>
      </div>
    </Layout>
  );
}