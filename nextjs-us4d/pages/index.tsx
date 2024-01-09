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
  const [inHidden, setInHidden] = React.useState(-1);
  const { width, height } = useWindowDimensions();
  const [borderY, setBorderY] = React.useState(0.7);
  const [mapPos, setMapPos] = React.useState({ x: 0, y: 0, scale: 1 });
  
  const onScroll = (e) => {
    const delta = e.deltaY * -0.01;
    var newScale = mapPos.scale + delta;
    const ratio = 1 - newScale / mapPos.scale;
    const mapHeight = (height - 64) * borderY;

    var newX = mapPos.x + (e.clientX - mapPos.x) * ratio;
    var newY = mapPos.y + (e.clientY - mapPos.y) * ratio;
    if(newX > 0) newX = 0; else if(newX < width - 2500 * mapPos.scale) newX = width - 2500 * mapPos.scale;
    if(newY > 0) newY = 0; else if(newY < mapHeight - 1700 * mapPos.scale) newY = mapHeight - 1700 * mapPos.scale;
    
    if(newScale < 0.5) setMapPos({scale: 0.5, x: mapPos.x, y: mapPos.y});
    else if(newScale > 1.5) setMapPos({scale: 1.5, x: mapPos.x, y: mapPos.y});
    else setMapPos({scale: newScale, x: newX, y: newY});
  };

  const onDrag = (data) => {
    const mapHeight = (height - 64) * borderY;

    var newX = mapPos.x + data.deltaX;
    var newY = mapPos.y + data.deltaY;
    if(newX > 0) newX = 0; else if(newX < width - 2500 * mapPos.scale) newX = width - 2500 * mapPos.scale;
    if(newY > 0) newY = 0; else if(newY < mapHeight - 1700 * mapPos.scale) newY = mapHeight - 1700 * mapPos.scale;
    setMapPos({ x: newX, y: newY, scale: mapPos.scale });
  }

  return (
    <Layout page="timeline">
      <Head>
        <title>{siteTitle}</title>
      </Head>
      <section className={utilStyles.map} onWheelCapture={onScroll}
          style={{height:((height - 64) * borderY)}}>
        <DraggableCore onDrag={(e, data) => {onDrag(data)}}>
          <div style={{position:"absolute",width:"100%",height:"100%",zIndex:100,
              transform:`translate(${mapPos.x}px, ${mapPos.y}px) scale(${mapPos.scale})`,
              transformOrigin:"top left"}}>
            <svg className={utilStyles.ocean} width="2500px" height="1700px" style={{zIndex:"-100"}} ></svg>
            {states.map((state, index) => (
              <>
                <State name={state.name} className={`${utilStyles.state} ${utilStyles.stateHover}`} width={Number(state.width) + 5} height={Number(state.height) + 5}
                  style={{left:state.x,top:state.y}} onCompleted={onCompleted} onError={onError} 
                    onMouseEnter={() => (setInHidden(index))}
                    onMouseLeave={() => inHidden == index && setInHidden(-1)}/>
                {(inHidden != index) ? (
                  <>
                    <State name={state.name} className={utilStyles.stateShadow} width={Number(state.width) + 5} height={Number(state.height) + 5}
                      style={{left:state.x,top:state.y}} onCompleted={onCompleted} onError={onError} />
                  </>) : (
                  <div style={{left:Number(state.x),top:Number(state.y),width:Number(state.width) + 5,height:Number(state.height) + 5}}>
                    <h2 className={`${utilStyles.state} ${utilStyles.stateLabel}`}>{state.displayName}</h2>
                  </div>
                )}
              </>
            ))}
          </div>
        </DraggableCore>
      </section>
      <div style={{position:"absolute",top:"4rem",zIndex:150,width:"100%"}}>
        <DraggableCore onDrag={(e, data) => {setBorderY(((data.y - 15) < ((height - 64) * 0.15)) ? 0.15 : ((data.y - 15) > ((height - 64) * 0.85)) ? 0.85 : (data.y - 15) / (height - 64))}}>
          <div style={{position:"absolute",top:((height - 64) * borderY),width:"100%",backgroundColor:"#ccc",height:20}}></div>
        </DraggableCore>
      </div>
      
      <section className={utilStyles.timeline}>
      </section>
    </Layout>
  );
}