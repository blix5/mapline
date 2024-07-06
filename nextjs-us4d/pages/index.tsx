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

  const [inHidden, setInHidden] = React.useState(-1);
  const { width, height } = useWindowDimensions();
  const [borderY, setBorderY] = React.useState(0.6);

  const [mapPos, setMapPos] = React.useState({ x: -1450, y: -275, scale: 1 });
  const [timePos, setTimePos] = React.useState({ x: 0, y: 0, scale: 1, year: 1900 });
  
  const onMapScroll = (e) => {
    const delta = e.deltaY * -0.003;
    var newScale = mapPos.scale + delta;
    const ratio = 1 - newScale / mapPos.scale;
    const mapHeight = (height - 64) * borderY;

    var newX = mapPos.x + (e.clientX - mapPos.x) * ratio;
    var newY = mapPos.y + (e.clientY - mapPos.y) * ratio;
    if(newX > width / 2) newX = width / 2; else if(newX < width / 2 - mapLimX * mapPos.scale) newX = width / 2 - mapLimX * mapPos.scale;
    if(newY > mapHeight / 2) newY = mapHeight / 2; else if(newY < mapHeight / 2 - mapLimY * mapPos.scale) newY = mapHeight / 2 - mapLimY * mapPos.scale;
    
    if(newScale < 0.5) setMapPos({scale: 0.5, x: mapPos.x, y: mapPos.y});
    else if(newScale > 1.5) setMapPos({scale: 1.5, x: mapPos.x, y: mapPos.y});
    else setMapPos({scale: newScale, x: newX, y: newY});
  };

  const onMapDrag = (data) => {
    const mapHeight = (height - 64) * borderY;

    var newX = mapPos.x + data.deltaX;
    var newY = mapPos.y + data.deltaY;
    if(newX > width / 2) newX = width / 2; else if(newX < width / 2 - mapLimX * mapPos.scale) newX = width / 2 - mapLimX * mapPos.scale;
    if(newY > mapHeight / 2) newY = mapHeight / 2; else if(newY < mapHeight / 2 - mapLimY * mapPos.scale) newY = mapHeight / 2 - mapLimY * mapPos.scale;
    setMapPos({ x: newX, y: newY, scale: mapPos.scale });
  }

  const onTimeXScroll = (e) => {
    var newX = timePos.x - e.deltaY;
    setTimePos({ x: newX, y: timePos.y, scale: timePos.scale, year: timePos.year });
  }

  return (
    <Layout page="history">
      <Head>
        <title>{siteTitle}</title>
      </Head>
      <section className={utilStyles.map} onWheelCapture={onMapScroll}
          style={{height:((height - 64) * borderY)}}>
        <DraggableCore onDrag={(e, data) => {onMapDrag(data)}}>
          <div style={{cursor:"move",position:"absolute",width:"100%",height:"100%",zIndex:100,
              transform:`translate(${mapPos.x}px, ${mapPos.y}px) scale(${mapPos.scale})`,
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
                <State name={state.name} className={`${state.isState == "TRUE" ? utilStyles.state : utilStyles.nonState}
                    ${state.isState == "TRUE" && utilStyles.stateHover}`} width={Number(state.width) + 5} height={Number(state.height) + 5}
                    style={{left:state.x,top:state.y}} onCompleted={onCompleted} onError={onError} 
                    onMouseEnter={() => (setInHidden(index))}
                    onMouseLeave={() => inHidden == index && setInHidden(-1)}/>
                {(inHidden == index) && (
                  <div style={{
                    left:Number(state.x),
                    top:Number(state.y),
                    width:Number(state.width) + 5,
                    height:Number(state.height) + 5,
                    fontSize:((2/3) * Number(state.width) + (1/3) * Number(state.height)) / 15 + 10
                  }}>
                    <h2 className={`${utilStyles.state} ${state.isState == "TRUE" ? utilStyles.stateLabel : utilStyles.nonStateLabel}`}>
                      {state.displayName}
                    </h2>
                  </div>
                )}
              </>
            ))}
          </div>
        </DraggableCore>
      </section>

      <div style={{position:"absolute",top:"3.5rem",zIndex:150,width:"100%"}}>
        <DraggableCore onDrag={(e, data) => {setBorderY(((data.y - 15) < ((height - 64) * 0.4)) ? 0.4 :
            ((data.y - 15) > ((height - 64) * 0.75)) ? 0.75 : (data.y - 15) / (height - 64))}}>
          <div style={{position:"relative",top:((height - 64) * borderY),width:"100%",height:20,backgroundColor:'rgba(0,0,0,0.5)',cursor:'ns-resize'}}></div>
        </DraggableCore>
      </div>
      
      <section className={utilStyles.timeline} onWheelCapture={onTimeXScroll}
          style={{height:height - ((height - 64) * borderY)}}>
        <div style={{position:"absolute",width:"100%",height:"100%",zIndex:100,
            transform:`translate(${timePos.x}px, ${timePos.y}px) scale(${timePos.scale})`,
            transformOrigin:"top left"}}>

          {timePos.x}

        </div>
      </section>

      <section className={`${utilStyles.numberLine}`}>
        1892
      </section>
    </Layout>
  );
}