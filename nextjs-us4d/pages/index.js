import Head from 'next/head';
import Image from 'next/image';
import Layout, { siteTitle } from '../components/layout';
import utilStyles from '../styles/utils.module.css';
import Link from 'next/link';
import Date from '../components/date';

import React from 'react';
import { getStateList } from '../libs/sheets'
import State from '../libs/State'
import Draggable, {DraggableCore} from 'react-draggable';

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
  const [y, setY] = React.useState(500);

  return (
    <Layout page="timeline">
      <Head>
        <title>{siteTitle}</title>
      </Head>
      <section className={utilStyles.map} style={{height:y}} >
        <svg className={utilStyles.ocean} width="2500px" height="1700px" style={{zIndex:"-100"}} ></svg>
        {states.map((state, index) => (
          <State name={state.name} className={utilStyles.state} width={Number(state.width) + 5} height={Number(state.height) + 5}
            style={{left:state.x,top:state.y}} onCompleted={onCompleted} onError={onError} 
              onMouseEnter={() => (setInHidden(index))}
              onMouseLeave={() => inHidden == index && setInHidden(-1)}/>
        ))
        }
        {states.map((state, index) => (
          (inHidden != index) && (
            <State name={state.name} className={utilStyles.stateShadow} width={Number(state.width) + 5} height={Number(state.height) + 5}
              style={{left:state.x,top:state.y}} onCompleted={onCompleted} onError={onError} />)
        ))}
      </section>
      <div style={{position:"absolute",top:"4rem",zIndex:150,width:"100%"}}>
        <DraggableCore onDrag={(e, data) => {setY((data.y - 15) > 700 ? 700 : ((data.y - 15) < 0 ? 0 : (data.y - 15)))}} axis="y">
          <div style={{position:"absolute",top:y,width:"100%",backgroundColor:"#ccc",height:20}}></div>
        </DraggableCore>
      </div>
      
      <section className={utilStyles.timeline}>
            
      </section>
    </Layout>
  );
}