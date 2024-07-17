import Head from 'next/head';
import Image from 'next/image';
import Layout, { siteTitle } from '../components/layout';
import utilStyles from '../styles/utils.module.css';
import Link from 'next/link';
import Date from '../components/date';

import React from 'react';
import { getStateList, getTimeline } from '../libs/sheets';
import State from '../libs/State';
import FilterIcon from '../libs/FilterIcon';
import Icon from '../libs/Icon';
import Draggable, {DraggableCore} from 'react-draggable';
import useWindowDimensions from '../components/useWindowDimensions';
import DecimalYearToDate from '../components/dateDecimal';
import categoryToIndex from '../components/categoryIndex';

import { parseAsFloat, useQueryState } from 'next-usequerystate';
import styled from 'styled-components';
import dateFilterRender from '../components/dateFilterRender';

export async function getStaticProps(context) {
  const states = await getStateList();
  const events = await getTimeline();
  return {
    props: {
      states: states.slice(1, states.length),
      events: events.slice(1, events.length)
    },
    revalidate: 1,
  };
}

const isEvenIndexInCategory = (event, events) => {
  const categoryEvents = events.filter(e => e.category === event.category);
  const eventIndex = categoryEvents.findIndex(e => e.id === event.id);
  return eventIndex % 2 === 0;
};

const convertDateToDecimal = (dateString) => {
  const month = Number(String(dateString).substring(0, 2));
  const day = Number(String(dateString).substring(3, 5));
  const year = Number(String(dateString).substring(6, 10));
  return year + (month / 12) + (day / 365);
}

const HoverVisibleDiv = styled.div<{ $opacity: number, $length: number, $corners: boolean, $isParent: boolean, $expanded: boolean, $isChild: boolean, $translateX: number, $translateY: number, $isParentExpanded: boolean }>`
  opacity: calc(${(props) => (props.$opacity || 1)} * ${(props) => (props.$expanded || false) ? 1 : 0});
  pointer-events: ${(props) => (props.$expanded || false) ? '' : 'none'};
  border-top-right-radius: ${(props) => (props.$corners || false) ? 0 : 0.6}rem;
  border-bottom-right-radius: ${(props) => (props.$corners || false) ? 0 : 0.6}rem;
  width: calc(6rem + ${(props) => (props.$isParent || false) ? 2 : 1}rem);
  filter:blur(${(props) => (props.$isChild || false) ? ((props) => (props.$expanded || false) ? 0 : 0.2) : 0}rem)
        drop-shadow(0 0 0.3rem rgba(0,0,0,0.5))
        brightness(${(props) => (props.$isChild || false) ? 0.8 : 1});
  transform:
        translate(
            calc(${(props) => (props.$translateX || 0)}px),
            calc(${(props) => (props.$translateY || 0)}px + 0.1rem))
        scale(${(props) => (props.$isChild || false) ? 0.8 : 1});

  &:hover {
    opacity: calc(1 * ${(props) => (props.$expanded || false) ? 1 : 0});
    width: calc(${(props) => props.$length || 130}px + ${(props) => (props.$isParent || false) ? 2 : 1}rem);
    border-top-right-radius: 0.6rem;
    border-bottom-right-radius: 0.6rem;
    border-top-left-radius: 0.6rem;
    filter:blur(${(props) => (props.$isChild || false) ? ((props) => (props.$expanded || false) ? 0 : 0.2) : 0}rem)
          drop-shadow(0 0 0.3rem rgba(0,0,0,1))
          brightness(1);
    transform:
        translate(
            calc(${(props) => (props.$translateX || 0)}px),
            calc(${(props) => (props.$translateY || 0)}px + 0.1rem))
        scale(1);

    .eventRange {
      transform-origin: top left;
      transform: scale(1);
      border-top-left-radius: 0.6rem;
    }
  }

  .eventRange {
    transform-origin: top left;
    transform: scale(${(props) => (props.$isChild || false) ? 1.25 : 1});
    border-top-left-radius: ${(props) => (props.$isChild || false) ? 0 : 0.6}rem;
  }

`;

export default function Home({ states, events, onCompleted, onError }) {
  const startYear = 1750;
  const endYear = 2020;

  const [inHidden, setInHidden] = React.useState(-1);
  const { width, height } = useWindowDimensions();
  const [borderY, setBorderY] = useQueryState('div', parseAsFloat.withDefault(0.6));

  const [mapX, setMapX] = useQueryState('mpx', parseAsFloat.withDefault(-1450));
  const [mapY, setMapY] = useQueryState('mpy', parseAsFloat.withDefault(-275));
  const [mapScale, setMapScale] = useQueryState('mps', parseAsFloat.withDefault(1));

  const [timeX, setTimeX] = useQueryState('tpx', parseAsFloat.withDefault(0));
  const [timeY, setTimeY] = useQueryState('tpy', parseAsFloat.withDefault(0));
  const [timeScale, setTimeScale] = useQueryState('tps', parseAsFloat.withDefault(100));
  const [timeYear, setTimeYear] = useQueryState('year', parseAsFloat.withDefault(1492));

  const mapLimX = 2400;
  const mapLimY = 1280;

  const timeLimX = (endYear - startYear + 1) * timeScale;
  const timeLimY = (65 * (7 * 2));

  const numberLineRef = React.useRef(null);
  const timelineRef = React.useRef(null);
  const eventsRef = React.useRef<Array<HTMLDivElement | null>>([]);
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
    const oldTimeX = (timeYear - (startYear - 0.5)) * value - (width / 2)
    setTimeX(oldTimeX);
    setTimeScale(value);
    setScrolling(true);
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

      <section className={utilStyles.map} onWheelCapture={onMapScroll}
          style={{height:((height - 64) * borderY)}}>
        <DraggableCore onDrag={(e, data) => {onMapDrag(data)}}>
          <div style={{cursor:"move",position:"absolute",width:"100%",height:"100%",zIndex:100,
              transform:`translate(${mapX}px, ${mapY}px) scale(${mapScale})`,
              transformOrigin:"top left"}}>

            <svg className={utilStyles.ocean} width={`${mapLimX}px`} height={`${mapLimY}px`} style={{zIndex:"-100"}} ></svg>
            <svg className={utilStyles.mapShadow} width={`${mapLimX}px`} height={`${mapLimY * 2}px`} style={{zIndex:"102",
                transform:`translate(${-1 * mapLimX}px, ${-0.5 * mapLimY}px)`}}></svg>
            <svg className={utilStyles.mapShadow} width={`${mapLimX}px`} height={`${mapLimY * 2}px`} style={{zIndex:"102",
                transform:`translate(${mapLimX}px, ${-0.5 * mapLimY}px)`}}></svg>
            <svg className={utilStyles.mapShadow} width={`${mapLimX}px`} height={`${mapLimY}px`} style={{zIndex:"102",
                transform:`translate(0px, ${-1 * mapLimY}px)`}}></svg>
            <svg className={utilStyles.mapShadow} width={`${mapLimX}px`} height={`${mapLimY}px`} style={{zIndex:"102",
                transform:`translate(0px, ${mapLimY}px)`}}></svg>

            {states.map((state, index) => (
              <>
                {(convertDateToDecimal(state.startDate) <= timeYear && convertDateToDecimal(state.endDate) > timeYear) &&
                  <>
                    <State name={state.name} className={`${utilStyles.state} ${(Number(convertDateToDecimal(state.stateDate)) > timeYear) && utilStyles.nonState}
                        ${(Number(convertDateToDecimal(state.stateDate)) <= timeYear) && utilStyles.stateHover}`} width={Number(state.width) + 5} height={Number(state.height) + 5}
                        style={{left:state.x,top:state.y}} onCompleted={onCompleted} onError={onError}
                        onMouseEnter={() => (setInHidden(index))}
                        onMouseLeave={() => inHidden == index && setInHidden(-1)}/>
                    {(inHidden == index) && (
                      <div style={{
                        left:Number(state.x) + Number(state.xLabel),
                        top:Number(state.y) + Number(state.yLabel),
                        width:Number(state.width) + 5,
                        height:Number(state.height) + 5,
                        fontSize: 6 * Math.pow((2/3) * Number(state.width) + (1/3) * Number(state.height), 0.3)
                      }}>
                        <h2 className={`${utilStyles.state} ${utilStyles.stateLabel} ${(Number(convertDateToDecimal(state.stateDate)) > timeYear) && utilStyles.nonStateLabel}`}>
                          {state.displayName}
                        </h2>
                      </div>
                    )}
                  </>
                }
              </>
            ))}
          </div>
        </DraggableCore>
      </section>

      {/* DRAG BORDER */}

      <div style={{position:"absolute",top:"3.75rem",zIndex:150,width:"100%"}}>
        <DraggableCore onDrag={(e, data) => {setBorderY(((data.y - 15) < ((height - 64) * 0.25)) ? 0.25 :
            ((data.y - 15) > ((height - 64) * 0.75)) ? 0.75 : (data.y - 15) / (height - 64))}}>
          <div style={{position:"relative",top:((height - 64) * borderY),width:"100%",height:10,cursor:'ns-resize'}}></div>
        </DraggableCore>
      </div>
      
      {/* TIMELINE */}
      <input type='range' value={timeScale} min={50} max={250} onChange={(e) => onTimelineZoom(Number(e.target.value))} className={utilStyles.timeScale}
          style={{top:`calc(${(height - 64) * borderY}px + 4rem)`,backgroundSize:`100% ${100 - (((timeScale - 50) * 100) / 200)}%`}}/>
      <section className={`${utilStyles.timeline} ${utilStyles.scrollable}`} onScroll={onTimelineScroll} ref={timelineRef}
          style={{height:`calc(${height - ((height - 64) * borderY)}px - 7.1rem)`,width:'100%',position:'absolute'}}>
        <div style={{position:"absolute",top:0,height:`${timeLimY}px`,width:`calc(${timeLimX}px - 0.9rem)`}}>
          {events.map((event, i) => (
            <div style={{zIndex:50}} className={utilStyles.eventDiv}>

              <HoverVisibleDiv $length={(eventsRef.current[i]?.offsetWidth < (130 + (event?.endDate && 70))) ? (129 + (event?.endDate && 70)) : (eventsRef.current[i]?.offsetWidth - 0.01)} $opacity={(event.importance / 9) + 0.4} 
                    $isParent={isListedAsParent(event.id)} $expanded={(event?.parent ? (isParentSelected(event.parent)) : true)} $corners={event?.endDate} $isChild={event?.parent} 
                    $translateX={((convertDateToDecimal(event.startDate) - startYear) * timeScale) + 40} $translateY={(categoryToIndex(event.category) * 65 * 2) + (isEvenIndexInCategory(event, events) ? 0 : 65)}
                    $isParentExpanded={isParentSelected(event.id)} key={i}
                    style={{marginTop:`${event?.parent ? (isParentSelected(event.parent) ? 0 : -0.5) : 0}rem`,marginLeft:`${isParentSelected(event.id) ? -130 : 0}px`}}
                    className={`${utilStyles.events} ${utilStyles[event.category]} ${event?.parent && utilStyles.childEvent}`}>
                <div style={{overflow:'hidden',height:'2rem'}}>
                  <h6 ref={el => eventsRef.current[i] = el}>
                    {event.displayName}
                  </h6>
                  <div style={{width:`calc(100% - ${isListedAsParent(event.id) ? 1 : 0}rem)`,height:'2rem',overflow:'hidden',right:`${isListedAsParent(event.id) ? 1 : 0}rem`,position:'absolute'}}>
                    {event?.endDate && (
                      <p className={utilStyles.endDate}>
                        {` – ${dateFilterRender(event.endDate, event.specEndDate)}`}
                      </p>
                    )}
                    <p>
                      {dateFilterRender(event.startDate, event.specStartDate)}
                    </p>
                  </div>
                  <FilterIcon className={utilStyles.filterIcon} filter={event.filter} onCompleted={onCompleted} onError={onError}></FilterIcon>
                </div>
                {(event?.endDate) && (
                  <div style={{width:`calc(${(timeScale * (convertDateToDecimal(event.endDate) - convertDateToDecimal(event.startDate))) < 22 ? 22 : (timeScale * (convertDateToDecimal(event.endDate) - convertDateToDecimal(event.startDate)))}px
                          + ${isParentSelected(event.id) ? 130 : 0}px)`,
                      position:'absolute',top:'-0.29rem',left:'-0.3rem',height:'calc(32px)',borderTopRightRadius:'0.6rem',borderBottomLeftRadius:'0rem',borderBottomRightRadius:'0rem',overflow:'hidden'}}
                      className={`eventRange ${utilStyles.eventRange}`}>
                    <div className={`${utilStyles[event.category + 'l']}`} style={{width:'100%',height:'0.25rem'}}></div>
                  </div>
                )}
                {(isListedAsParent(event.id)) && (
                  <div style={{}} className={`${utilStyles.parentExpand} ${utilStyles[event.category + 'e']}`} onClick={() => toggleParentSelection(event.id)}>
                    <Icon className={`${utilStyles.arrow} ${utilStyles[event.category + 'Arrow']}`} icon={"arrow"} onCompleted={onCompleted} onError={onError}
                        style={{transform:`rotate(${isParentSelected(event.id) ? 0 : 180}deg)`}}>

                    </Icon>
                  </div>
                )}
              </HoverVisibleDiv>

              {(event?.endDate && !(event?.parent && !isParentSelected(event.parent))) && (
                <>
                  <div className={`${utilStyles.eventsl} ${utilStyles[event.category + 'l']}`} style={{width:`calc(${timeScale * (convertDateToDecimal(event.endDate) - convertDateToDecimal(event.startDate))}px)`,
                      height:'calc(30px)',transform:`translate(calc(${((convertDateToDecimal(event.startDate) - startYear) * timeScale) + 40}px),
                      calc(${categoryToIndex(event.category) * 65 * 2}px + ${isEvenIndexInCategory(event, events) ? 0 : 65}px + 0.1rem))`}}></div>
                </>
              )}

            </div>
          ))}

          {[...Array(endYear - startYear + 1)].map((e, i) => (
            (Math.abs((i * timeScale) - timeX) < width * 2) && (
            <>
              <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,position:'absolute',width:'0.3rem',height:'100%',top:0,backgroundColor:'#333443'}}></div>
              <div style={{transform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'100%',top:0,backgroundColor:'#333443'}}></div>
              <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'100%',top:0,backgroundColor:'#333443'}}></div>
              <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'100%',top:0,backgroundColor:'#333443'}}></div>
            </>)
          ))}

          {[...Array((7 * 2) + 1)].map((e, i) => (
            (Math.abs((i * timeScale) - timeY) < height * 2) && (
            <>
              <div style={{transform:`translate(0rem, calc(${(i * 65)}px - 0.1rem))`,opacity:`${i % 2 == 0 ? 0.5 : 0.15}`,position:'absolute',width:'100%',height:'0.2rem',top:0,backgroundColor:'#76768B'}}></div>
            </>)
          ))}

        </div>
      </section>

      {/* NUMBER LINE — YEARS */}
      <section className={`${utilStyles.numberLine} ${utilStyles.scrollable}`} onScroll={onNumberLineScroll} ref={numberLineRef}>
        <div style={{width:timeLimX}}>
          {[...Array(endYear - startYear + 1)].map((e, i) => (
            (Math.abs((i * timeScale) - timeX) < width * 2) && (
              <>
                <h2 style={{transform:`translate(${(i * timeScale)}px, 0rem)`,width:`${timeScale}px`,textAlign:'center'}}>
                  {(i + startYear)}
                </h2>
                <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 2)}px - 0.15rem), 0rem)`,position:'absolute',width:'0.3rem',height:'1rem',top:0,backgroundColor:'#E9EAF3'}}></div>
                <div style={{transform:`translate(calc(${(i * timeScale)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'0.7rem',top:0,backgroundColor:'#E9EAF3'}}></div>
                <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale / 4)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'0.4rem',top:0,backgroundColor:'#E9EAF3'}}></div>
                <div style={{transform:`translate(calc(${(i * timeScale) + (timeScale * 3/4)}px - 0.075rem), 0rem)`,position:'absolute',width:'0.15rem',height:'0.4rem',top:0,backgroundColor:'#E9EAF3'}}></div>
              </>
            )
          ))}
        </div>
      </section>

      {/* MARKERS */}

      <div className={`${utilStyles.markerYear}`}>
        <div style={{height:height - ((height - 64) * borderY),opacity:`${scrolling ? 1 : 0.5}`,transition:`opacity ${scrolling ? 0.1 : 1}s`}} className={`${utilStyles.markerLine}`}></div>
        <div style={{opacity:`${scrolling ? 1 : 0.5}`,transition:`opacity ${scrolling ? 0.1 : 1}s`}} className={utilStyles.marker}></div>
        <h3 style={{opacity:`${scrolling ? 1 : 0.5}`,transition:`opacity ${scrolling ? 0.1 : 1}s`}}>
          {DecimalYearToDate(timeYear)}
        </h3>
      </div>
    </Layout>
  );
}