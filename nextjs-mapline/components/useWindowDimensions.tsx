import { useEffect, useRef, useState } from 'react';

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

    useEffect(() => {
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
