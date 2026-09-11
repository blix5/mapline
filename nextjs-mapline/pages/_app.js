import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import '../styles/global.css';
import RouteSkeleton from '../components/skeletons/RouteSkeleton';

export default function App({ Component, pageProps }) {
    const router = useRouter();
    const [navigatingTo, setNavigatingTo] = useState(null);

    // Without this, clicking HISTORY sat on the old page while Next fetched the route's
    // chunk and data — the destination page's own placeholders only appear once it mounts.
    // Hooking the router puts the skeleton up on the click instead.
    useEffect(() => {
        const start = (url) => {
            // Re-clicking the tab you are already on should not flash the loader.
            if (url.split('?')[0] === router.asPath.split('?')[0]) return;
            setNavigatingTo(url);
        };
        const done = () => setNavigatingTo(null);
        router.events.on('routeChangeStart', start);
        router.events.on('routeChangeComplete', done);
        router.events.on('routeChangeError', done);
        return () => {
            router.events.off('routeChangeStart', start);
            router.events.off('routeChangeComplete', done);
            router.events.off('routeChangeError', done);
        };
    }, [router]);

    return (
        <>
            <RouteSkeleton navigatingTo={navigatingTo} />
            <Component {...pageProps} />
        </>
    );
}
