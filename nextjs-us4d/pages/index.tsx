import Head from 'next/head';
import Image from 'next/image';
import Layout, { siteTitle } from '../components/layout';
import utilStyles from '../styles/utils.module.css';
import Link from 'next/link';
import Date from '../components/date';

import React from 'react';
import { getStateList } from '../libs/sheets';
import State from '../libs/State';
import Draggable, {DraggableCore} from 'react-draggable';
import useWindowDimensions from '../components/useWindowDimensions';
import DecimalYearToDate from '../components/dateDecimal';

import { parseAsFloat, useQueryState } from 'next-usequerystate';

export async function getStaticProps(context) {
  const states = await getStateList();
  return {
    props: {
      states: states.slice(1, states.length),
    },
    revalidate: 1,
  };
}

export default function Home({ states, onCompleted, onError }) {
  const mapLimX = 2400;
  const mapLimY = 1280;

  const timeLimX = -52900;

  const [inHidden, setInHidden] = React.useState(-1);
  const { width, height } = useWindowDimensions();
  const [borderY, setBorderY] = React.useState(0.6);

  const [mapX, setMapX] = useQueryState('mpx', parseAsFloat.withDefault(-1450));
  const [mapY, setMapY] = useQueryState('mpy', parseAsFloat.withDefault(-275));
  const [mapScale, setMapScale] = useQueryState('mps', parseAsFloat.withDefault(1));

  const [timeX, setTimeX] = useQueryState('tpx', parseAsFloat.withDefault(0));
  const [timeY, setTimeY] = useQueryState('tpy', parseAsFloat.withDefault(0));
  const [timeScale, setTimeScale] = useQueryState('tps', parseAsFloat.withDefault(1));
  const [timeYear, setTimeYear] = useQueryState('tyear', parseAsFloat.withDefault(1492))

  const [timeSinceScroll, setTimeSinceScroll] = React.useState(0);
  React.useEffect(() => {
    const timer = setTimeout(() => (timeSinceScroll < 450) && setTimeSinceScroll(timeSinceScroll + 1), 10);
    return () => clearTimeout(timer);
  }, [timeSinceScroll]);
  
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

  const onTimeXScroll = (e) => {
    var newX = timeX - e.deltaY;
    if(newX > 0) newX = 0; else if(newX < timeLimX + width) newX = timeLimX + width;
    setTimeX(newX);
    setTimeYear(((-timeX + (width / 2)) / 100) + 1491.5);
    setTimeSinceScroll(0);
  }

  const convertDateToDecimal = (dateString) => {
    const month = Number(String(dateString).substring(0, 2));
    const day = Number(String(dateString).substring(3, 5));
    const year = Number(String(dateString).substring(6, 10));
    return year + (month / 12) + (day / 365);
  }

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
                    {(true /*inHidden == index*/) && (
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

      <div style={{position:"absolute",top:"3.5rem",zIndex:150,width:"100%"}}>
        <DraggableCore onDrag={(e, data) => {setBorderY(((data.y - 15) < ((height - 64) * 0.4)) ? 0.4 :
            ((data.y - 15) > ((height - 64) * 0.75)) ? 0.75 : (data.y - 15) / (height - 64))}}>
          <div style={{position:"relative",top:((height - 64) * borderY),width:"100%",height:20,cursor:'ns-resize'}}></div>
        </DraggableCore>
      </div>
      
      {/* TIMELINE */}
      <section className={utilStyles.timeline} onWheelCapture={onTimeXScroll}
          style={{height:height - ((height - 64) * borderY)}}>
        <div style={{position:"absolute",width:"100%",height:"100%",zIndex:100,
            transform:`translate(${timeX}px, ${timeY}px) scale(${timeScale})`,
            transformOrigin:"top left"}}>

          thas some content type shit

        </div>

        {/* MARKER LINE */}
        <div style={{opacity:`${(timeSinceScroll < 300) ? 1 : ((timeSinceScroll > 350) ? 0.5 : ((timeSinceScroll - 400) / -100))}`}}
            className={`${utilStyles.markerLine}`}>
          
        </div>
      </section>

      {/* NUMBER LINE — YEARS */}
      <section className={`${utilStyles.numberLine}`} onWheelCapture={onTimeXScroll}>
        <div style={{transform:`translate(${timeX}px)`}}>
          {[...Array(529)].map((e, i) => (
            <h2 style={{transform:`translate(${(i * 100) + 20}px, 0rem)`}}>
              {(i + 1492)}
            </h2>
          ))}
        </div>

        {/* MARKERS */}
        <div style={{opacity:`${(timeSinceScroll < 300) ? 1 : ((timeSinceScroll > 350) ? 0.5 : ((timeSinceScroll - 400) / -100))}`}}
              className={`${utilStyles.markerYear}`}>
          <div className={`${utilStyles.marker}`}>

          </div>
          <h3>
            {DecimalYearToDate(timeYear)}
          </h3>
        </div>

        {/* SCROLL */}
        <DraggableCore onDrag={(e, data) => {
            setTimeSinceScroll(0);
            setTimeX((timeX + (data.deltaX * (timeLimX / width))) > 0 ? 0 : ((timeX + (data.deltaX * (timeLimX / width))) < timeLimX + width)
                ? timeLimX + width: (timeX + (data.deltaX * (timeLimX / width))));
            setTimeYear(((-timeX + (width / 2)) / 100) + 1491.5);
            
        }} onStop={() => {setTimeSinceScroll(1);}}>
          <div className={`${utilStyles.scroll}`} style={{transform:`translate(${timeX / (timeLimX / width)}px)`}}></div>
        </DraggableCore>
        
      </section>
    </Layout>
  );
}