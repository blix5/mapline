import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// useLayoutEffect warns during SSR; fall back to useEffect on the server. Reading the
// size in a layout effect rather than a passive one means width/height are defined on
// the first *painted* commit - as a passive effect it left one frame where they were
// undefined and every calc(${height - 64}px) on the map and timeline was NaN.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type WindowDimentions = {
    width: number | undefined;
    height: number | undefined;
};

const useWindowDimensions = (): WindowDimentions => {
    const [windowDimensions, setWindowDimensions] = useState<WindowDimentions>({
        width: undefined,
        height: undefined,
    });
    const frame = useRef<number | null>(null);

    useIsomorphicLayoutEffect(() => {
        // Coalesce resize events to one update per frame, and keep the previous object
        // when the size has not actually changed so React can bail out of the render.
        function read(): void {
            setWindowDimensions((previous) =>
                previous.width === window.innerWidth && previous.height === window.innerHeight
                    ? previous
                    : { width: window.innerWidth, height: window.innerHeight },
            );
        }
        function handleResize(): void {
            if (frame.current !== null) return;
            frame.current = window.requestAnimationFrame(() => {
                frame.current = null;
                read();
            });
        }
        read();
        window.addEventListener('resize', handleResize, { passive: true });
        return (): void => {
            if (frame.current !== null) window.cancelAnimationFrame(frame.current);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return windowDimensions;
};

export default useWindowDimensions;
