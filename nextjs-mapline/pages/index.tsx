import React from 'react';
import Head from 'next/head';
import Image from 'next/image';
import ReactLink from 'next/link';

import Draggable, {DraggableCore} from 'react-draggable';
import { parseAsFloat, useQueryState } from 'next-usequerystate';
import styled from 'styled-components';
import { Link, Button, Element, Events, animateScroll as scroll, scrollSpy } from 'react-scroll';

import Date from '../components/date';
import useWindowDimensions from '../components/useWindowDimensions';
import Layout, { siteTitle } from '../components/layout';

import utilStyles from '../styles/utils.module.css';
import indexStyles from '../styles/index.module.css';
import mapStyles from '../styles/map/map.module.css';
import stateStyles from '../styles/map/states.module.css';
import timelineStyles from '../styles/timeline/timeline.module.css';

import { getStateList, getLocations, getTimeline } from '../libs/sheets';

import State from '../libs/State';
import MapSvg from '../libs/MapSvg';
import FilterIcon from '../libs/FilterIcon';
import Icon from '../libs/Icon';

import HoverVisibleDiv from '../libs/HoverVisibleDiv';

import DecimalYearToDate from '../libs/dateDecimal';
import categoryToIndex from '../libs/categoryIndex';
import dateFilterRender from '../libs/dateFilterRender';

import compassDimensions from '../libs/mapUtils';
import { latLonToX, latLonToY } from '../libs/coordinateUtils';

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

const convertDateToDecimal = (dateString) => {
  const month = Number(String(dateString).substring(0, 2));
  const day = Number(String(dateString).substring(3, 5));
  const year = Number(String(dateString).substring(6, 10));
  return year + (month / 12) + (day / 365);
}


export default function Home({ states, locations, events, onCompleted, onError }) {
  const startYear = 1750;
  const endYear = 2020;

  const [inHidden, setInHidden] = React.useState(-1);
  const { width, height } = useWindowDimensions();
  const [borderY, setBorderY] = useQueryState('div', parseAsFloat.withDefault(0.6));

  const [mapX, setMapX] = useQueryState('mpx', parseAsFloat.withDefault(-1450));
  const [mapY, setMapY] = useQueryState('mpy', parseAsFloat.withDefault(-275));
  const [mapScale, setMapScale] = useQueryState('mps', parseAsFloat.withDefault(1));
  const [isDragging, setIsDragging] = React.useState(false);
  const [mousePos, setMousePos] = React.useState({ x: null, y: null });

  const [timeX, setTimeX] = useQueryState('tpx', parseAsFloat.withDefault(0));
  const [timeY, setTimeY] = useQueryState('tpy', parseAsFloat.withDefault(0));
  const [timeScale, setTimeScale] = useQueryState('tps', parseAsFloat.withDefault(100));
  const [timeYear, setTimeYear] = useQueryState('year', parseAsFloat.withDefault(1492));
  const [hoverTimeline, setHoverTimeline] = React.useState(false);

  const mapLimX = 2400;
  const mapLimY = 1280;

  const timeLimX = (endYear - startYear + 1) * timeScale;
  const timeLimY = (65 * (7 * 2));

  const numberLineRef = React.useRef(null);
  const timelineRef = React.useRef(null);
  const eventsRef = React.useRef<Array<HTMLDivElement | null>>([]);
  const [eventSelected, setEventSelected] = React.useState(null);
  React.useEffect(() => {
    eventsRef.current = eventsRef.current.slice(0, events.length);
  }, [events]);

  const [parents, setParents] = React.useState([]);
  React.useEffect(() => {
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
  const isParentSelected = (parent) => {
    const parentObj = parents.find(p => p.parent === parent);
    return parentObj ? parentObj.expanded : false;
  }
  const isListedAsParent = (id) => {
    return parents.some(parent => parent.parent === id);
  }

  const [scrolling, setScrolling] = React.useState(true);
  React.useEffect(() => {
    const timer = setTimeout(() => setScrolling(false), 3000);
    return () => clearTimeout(timer);
  }, [scrolling]);
  
  const onMapScroll = (e) => {
    const delta = e.deltaY * -0.003;
    var newScale = mapScale + delta;
    const ratio = 1 - newScale / mapScale;
    const mapHeight = (height - 64) * borderY;

    var newX = mapX + (e.clientX - mapX) * ratio;
    var newY = mapY + (e.clientY - mapY) * ratio;
    if(newX > width / 2) newX = width / 2; else if(newX < width / 2 - mapLimX * mapScale) newX = width / 2 - mapLimX * mapScale;
    if(newY > mapHeight / 2) newY = mapHeight / 2; else if(newY < mapHeight / 2 - mapLimY * mapScale) newY = mapHeight / 2 - mapLimY * mapScale;
    
    if(newScale < 0.5) setMapScale(0.5);
    else if(newScale > 1.5) setMapScale(1.5);
    else {
      setMapX(newX);
      setMapY(newY);
      setMapScale(newScale);
    }
  };

  React.useEffect(() => {
    Events.scrollEvent.register('begin', (to, element) => {
      console.log('begin', to, element);
    });
    Events.scrollEvent.register('end', (to, element) => {
      console.log('end', to, element);
    });
    scrollSpy.update();
    return () => {
      Events.scrollEvent.remove('begin');
      Events.scrollEvent.remove('end');
    };
  }, []);

  const onMapDrag = (data) => {
    const mapHeight = (height - 64) * borderY;

    var newX = mapX + data.deltaX;
    var newY = mapY + data.deltaY;
    if(newX > width / 2) newX = width / 2; else if(newX < width / 2 - mapLimX * mapScale) newX = width / 2 - mapLimX * mapScale;
    if(newY > mapHeight / 2) newY = mapHeight / 2; else if(newY < mapHeight / 2 - mapLimY * mapScale) newY = mapHeight / 2 - mapLimY * mapScale;
    setMapX(newX);
    setMapY(newY);
  }

  const onNumberLineScroll = (e) => {
    const xScroll = numberLineRef.current?.scrollLeft;

    var newX = xScroll;
    timelineRef.current.scrollLeft = xScroll;

    setTimeX(newX);
    setTimeYear(((timeX + width / 2) / timeScale) + (startYear - 0.5));
    setScrolling(true);
  }

  const onTimelineScroll = (e) => {
    const xScroll = timelineRef.current?.scrollLeft;
    const yScroll = timelineRef.current?.scrollTop;
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const scrollRatio = scrollTop / (scrollHeight - clientHeight);

    var newX = xScroll;
    var newY = yScroll;
    numberLineRef.current.scrollLeft = xScroll;

    setTimeX(newX);
    setTimeY(newY);
    setTimeYear(((timeX + width / 2) / timeScale) + (startYear - 0.5));
    setScrolling(true);
  }

  const onTimelineZoom = (value) => {
    const xTime = (timeX + (width / 2)) / timeScale;

    setTimeScale(value);

    const newX =( xTime * value) - (width / 2);

    numberLineRef.current.scrollLeft = newX;
    timelineRef.current.scrollLeft = newX;

    setTimeX(newX);
    setScrolling(true);
  }

  const eventClick = (event, timeX = 0, timeY = 0) => {
    if(event?.id) {
      scroll.scrollTo(timeX - width / 2, { smooth: true, containerId: 'timeline', duration: 500, horizontal: true });
      scroll.scrollTo(timeY, { smooth: true, containerId: 'timeline', duration: 500, horizontal: false })
      setEventSelected(event.id);

      setMapX(0);
    } else {
      setEventSelected(null);
    }
  }

  const locHoverNear = (posX, posY) => {
    return Math.sqrt(Math.pow(Math.abs(posX - (mousePos.x - mapX) / mapScale), 2) + Math.pow(Math.abs(posY - (mousePos.y - mapY - 78) / mapScale), 2)) < (25 / mapScale);
  }

  React.useEffect(() => {
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

      <section id={`map`} className={mapStyles.map} onWheelCapture={onMapScroll} style={{height:`${(height - 64) * borderY}px`}}>
        <svg width={'10rem'} height={'100%'} style={{background:`linear-gradient(90deg, rgba(0,0,0,0.8), transparent)`,zIndex:109}}></svg>
        <Image className={mapStyles.compass} src="/images/compass.png" height={256} width={256} alt="compass" style={{height:`${compassDimensions(height, borderY)}px`,width:`${compassDimensions(height, borderY)}px`,
            top:`calc(${((height - 64) * borderY)}px - ${compassDimensions(height, borderY)}px - 1.2rem)`}}/>
        <DraggableCore onDrag={(e, data) => {onMapDrag(data)}} onStart={() => setIsDragging(true)} onStop={() => setIsDragging(false)}>
          <div onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })} style={{position:"absolute",width:"100%",height:"100%",zIndex:100,transform:`translate(${mapX}px, ${mapY}px) scale(${mapScale})`,WebkitTransform:`translate(${mapX}px, ${mapY}px) scale(${mapScale})`,
              msTransform:`translate(${mapX}px, ${mapY}px) scale(${mapScale})`,transformOrigin:"top left",WebkitTransformOrigin:"top left",msTransformOrigin:"top left"}}
              className={(hoverTimeline && !isDragging) ? mapStyles.draggableMapSlow : mapStyles.draggableMap}>

            <svg className={mapStyles.ocean} width={`${mapLimX}px`} height={`${mapLimY}px`} style={{zIndex:"-100"}} ></svg>
            <svg className={mapStyles.mapShadow} width={`${mapLimX}px`} height={`${mapLimY * 2}px`} style={{zIndex:"102",transform:`translate(${-1 * mapLimX}px, ${-0.5 * mapLimY}px)`,
                WebkitTransform:`translate(${-1 * mapLimX}px, ${-0.5 * mapLimY}px)`,msTransform:`translate(${-1 * mapLimX}px, ${-0.5 * mapLimY}px)`}}></svg>
            <svg className={mapStyles.mapShadow} width={`${mapLimX}px`} height={`${mapLimY * 2}px`} style={{zIndex:"102",transform:`translate(${mapLimX}px, ${-0.5 * mapLimY}px)`,
                WebkitTransform:`translate(${mapLimX}px, ${-0.5 * mapLimY}px)`,msTransform:`translate(${mapLimX}px, ${-0.5 * mapLimY}px)`}}></svg>
            <svg className={mapStyles.mapShadow} width={`${mapLimX}px`} height={`${mapLimY}px`} style={{zIndex:"102",transform:`translate(${mapLimX}px, ${-0.5 * mapLimY}px)`,
                WebkitTransform:`translate(0px, ${-1 * mapLimY}px)`,msTransform:`translate(${mapLimX}px, ${-0.5 * mapLimY}px)`}}></svg>
            <svg className={mapStyles.mapShadow} width={`${mapLimX}px`} height={`${mapLimY}px`} style={{zIndex:"102",transform:`translate(${mapLimX}px, ${-0.5 * mapLimY}px)`,
                WebkitTransform:`translate(0px, ${mapLimY}px)`,msTransform:`translate(${mapLimX}px, ${-0.5 * mapLimY}px)`}}></svg>
            <MapSvg name={"mainland"} className={`${stateStyles.state} ${stateStyles.mainland}`} onCompleted={onCompleted} onError={onError} width={2197.2 + 5} height={1427.8 + 5} style={{left:288.2,top:-148.8}}/>
            
            {states.map((state, index) => (
              <>
                {(convertDateToDecimal(state.startDate) <= timeYear && convertDateToDecimal(state.endDate) > timeYear) &&
                  <>
                    <State name={state.name} className={`${stateStyles.state} ${(Number(convertDateToDecimal(state.stateDate)) > timeYear) && stateStyles.nonState}
                        ${(Number(convertDateToDecimal(state.stateDate)) <= timeYear) && stateStyles.stateHover}`} width={Number(state.width) + 5} height={Number(state.height) + 5}
                        style={{left:Number(state.x),top:Number(state.y)}} onCompleted={onCompleted} onError={onError} id={state.id}
                        onMouseEnter={() => (setInHidden(index))}
                        onMouseLeave={() => inHidden == index && setInHidden(-1)}
                    />
                    <div style={{left:Number(state.x) + Number(state.xLabel), top:Number(state.y) + Number(state.yLabel), width:Number(state.width) + 5, height:Number(state.height) + 5,
                        fontSize: 6 * Math.pow((2/3) * Number(state.width) + (1/3) * Number(state.height), 0.3)}}>
                      <h2 className={`${stateStyles.state} ${stateStyles.stateLabel} ${(Number(convertDateToDecimal(state.stateDate)) > timeYear) && stateStyles.nonStateLabel}`}
                            style={{opacity: `${inHidden == index ? 1 : 0}`}}>
                        {state.displayName + ((Number(convertDateToDecimal(state.stateDate)) > timeYear) ? ' Territory' : '')}
                      </h2>
                    </div>
                  </>
                }
              </>
            ))}

            {locations.map((location, index) => (
              <>
                <div style={{transformOrigin:`top left`,transform:`scale(${0.6 / mapScale + 0.4})`,pointerEvents:'none',position:'absolute',width:'13rem',zIndex:110,left:`${latLonToX(location.lat, location.long)}px`,top:`${latLonToY(location.lat, location.long)}px`}}>
                  <div className={mapStyles.locationDot}></div>
                  <h3 className={`${mapStyles.locationLabel} ${!locHoverNear(latLonToX(location.lat, location.long), latLonToY(location.lat, location.long)) && mapStyles.locationLabelHidden}`}>{location.displayName}</h3>
                </div>
              </>
            ))}

          </div>
        </DraggableCore>
      </section>

      {/* DRAG BORDER */}
      <div style={{position:"absolute",top:"3.75rem",zIndex:150,width:"100%"}}>
        <DraggableCore onDrag={(e, data) => {setBorderY(((data.y - 5) < ((height - 64) * 0.25)) ? 0.25 :
            ((data.y - 5) > ((height - 64) * 0.75)) ? 0.75 : (data.y - 5) / (height - 64))}}>
          <div style={{position:"relative",top:((height - 64) * borderY),width:"100%",height:10,cursor:'ns-resize'}}></div>
        </DraggableCore>
      </div>
      
      {/* TIMELINE */}
      <input type='range' value={timeScale} min={50} max={250} onChange={(e) => onTimelineZoom(Number(e.target.value))} className={timelineStyles.timeScale}
          style={{top:`calc(${(height - 64) * borderY}px + 4rem)`,backgroundSize:`${((timeScale - 50) * 100) / 200}% 100%`,width:`${0.25 * (height - ((height - 64) * borderY))}px`}}/>
      <section id={`timeline`} className={`${timelineStyles.timeline} ${utilStyles.scrollable}`} onScroll={onTimelineScroll} ref={timelineRef}
          style={{height:`calc(${height - ((height - 64) * borderY)}px - 7.1rem)`,width:'100%',position:'absolute'}} onMouseEnter={() => setHoverTimeline(true)} onMouseLeave={() => setHoverTimeline(false)}>
        <div style={{position:"absolute",top:0,height:`${timeLimY}px`,width:`calc(${timeLimX}px - 0.9rem)`}} onClick={() => eventClick(null)}>
          {events.map((event, i) => (
            <div style={{zIndex:50}} className={timelineStyles.eventDiv} onClick={(e) => e.stopPropagation()}>

              <HoverVisibleDiv $length={(eventsRef.current[i]?.offsetWidth < (130 + (event?.endDate && 70))) ? (129 + (event?.endDate && 70)) : (eventsRef.current[i]?.offsetWidth - 0.01)} $opacity={(event.importance / 9) + 0.4} 
                    $isParent={isListedAsParent(event.id)} $expanded={(event?.parent ? (isParentSelected(event.parent)) : true)} $corners={event?.endDate} $isChild={event?.parent} 
                    $translateX={((convertDateToDecimal(event.startDate) - startYear) * timeScale) + (timeScale * 0.4)} $translateY={(categoryToIndex(event.category) * 65 * 2) + (isEvenIndexInCategory(event, events) ? 0 : 65)}
                    $isParentExpanded={isParentSelected(event.id)} $isSelected={eventSelected == event.id} key={i} id={event.id} onClick={(e) => eventClick(event, ((convertDateToDecimal(event.startDate) - startYear) * timeScale) + (timeScale * 0.4),
                      (categoryToIndex(event.category) * 65 * 2) + (isEvenIndexInCategory(event, events) ? 0 : 65) - ((height - ((height - 64) * borderY) - 200) / 2))}
                    style={{marginTop:`${event?.parent ? (isParentSelected(event.parent) ? 0 : -0.5) : 0}rem`}}
                    className={`${timelineStyles.events} ${timelineStyles[event.category]} ${event?.parent && timelineStyles.childEvent} ${event.id == eventSelected && timelineStyles.selectedEvent}`}>
                <div style={{overflow:'hidden',height:'2rem'}}>
                  <h6 ref={el => eventsRef.current[i] = el}>
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
                      transform:`translate(calc(${((convertDateToDecimal(event.startDate) - startYear) * timeScale) + (timeScale * 0.4)}px), calc(${categoryToIndex(event.category) * 65 * 2}px + ${isEvenIndexInCategory(event, events) ? 0 : 65}px + 0.1rem))`,
                      WebkitTransform:`translate(calc(${((convertDateToDecimal(event.startDate) - startYear) * timeScale) + (timeScale * 0.4)}px), calc(${categoryToIndex(event.category) * 65 * 2}px + ${isEvenIndexInCategory(event, events) ? 0 : 65}px + 0.1rem))`,
                      msTransform:`translate(calc(${((convertDateToDecimal(event.startDate) - startYear) * timeScale) + (timeScale * 0.4)}px), calc(${categoryToIndex(event.category) * 65 * 2}px + ${isEvenIndexInCategory(event, events) ? 0 : 65}px + 0.1rem))`
                    }}>
                  </div>
                </>
              )}

            </div>
          ))}

          {[...Array(endYear - startYear + 1)].map((e, i) => (
            (Math.abs((i * timeScale) - timeX) < width * 2) && (
            <>
              <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,
                  msTransform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,position:'absolute',width:'0.3rem',height:'100%',top:0,backgroundColor:'#333443'}}></div>
              <div style={{transform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,
                  msTransform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'100%',top:0,backgroundColor:'#333443'}}></div>
              <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,
                  msTransform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'100%',top:0,backgroundColor:'#333443'}}></div>
              <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,
                  msTransform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'100%',top:0,backgroundColor:'#333443'}}></div>
            </>)
          ))}

          {[...Array((7 * 2) + 1)].map((e, i) => (
            (Math.abs((i * timeScale) - timeY) < height * 2) && (
            <>
              <div style={{transform:`translate(0rem, calc(${(i * 65)}px - 0.1rem))`,WebkitTransform:`translate(0rem, calc(${(i * 65)}px - 0.1rem))`,msTransform:`translate(0rem, calc(${(i * 65)}px - 0.1rem))`,
                  opacity:`${i % 2 == 0 ? 0.5 : 0.15}`,position:'absolute',width:'100%',height:'0.2rem',top:0,backgroundColor:'#76768B'}}></div>
            </>)
          ))}

        </div>
      </section>

      {/* NUMBER LINE — YEARS */}
      <section className={`${timelineStyles.numberLine} ${utilStyles.scrollable}`} onScroll={onNumberLineScroll} ref={numberLineRef}>
        <div style={{width:timeLimX}}>
          <div style={{position:'absolute',transform:`translate(${((endYear - startYear) * timeScale)}px)`,WebkitTransform:`translate(${((endYear - startYear) * timeScale)}px)`,
              msTransform:`translate(${((endYear - startYear) * timeScale)}px)`,opacity:0}}>
                safari sucks
          </div>
          {[...Array(endYear - startYear + 1)].map((e, i) => (
            (Math.abs((i * timeScale) - timeX) < width * 2) && (
              <>
                <h2 style={{transform:`translate(${(i * timeScale)}px, 0rem)`,WebkitTransform:`translate(${(i * timeScale)}px, 0rem)`,msTransform:`translate(${(i * timeScale)}px, 0rem)`,width:`${timeScale}px`,textAlign:'center'}}>
                  {(i + startYear)}
                </h2>
                <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,
                    msTransform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,position:'absolute',width:'0.3rem',height:'1rem',top:0,backgroundColor:'#E9EAF3'}}></div>
                <div style={{transform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,
                    msTransform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'0.7rem',top:0,backgroundColor:'#E9EAF3'}}></div>
                <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,
                    msTransform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'0.4rem',top:0,backgroundColor:'#E9EAF3'}}></div>
                <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,WebkitTransform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,
                    msTransform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'0.4rem',top:0,backgroundColor:'#E9EAF3'}}></div>
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
        <h3 style={{opacity:`${scrolling ? 1 : 0.5}`,transition:`opacity ${scrolling ? 0.1 : 1}s`,WebkitTransition:`opacity ${scrolling ? 0.1 : 1}s`,msTransition:`opacity ${scrolling ? 0.1 : 1}s`}}>
          {DecimalYearToDate(timeYear)}
        </h3>
      </div>
    </Layout>
  );
}