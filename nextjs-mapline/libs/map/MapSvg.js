import React from 'react';
import useDynamicMapSvgImport from './useDynamicMapSvgImport';

export default function MapSvg({ name, onCompleted, onError, ...rest }) {
    const { error, loading, SvgIcon } = useDynamicMapSvgImport(name, { onCompleted, onError });

    if(error) {
        // Never paint a raw exception into the UI; the icon is decorative.
        return null;
    }
    if(loading) {
        return null;
    }
    if(SvgIcon) {
        return (
            <SvgIcon {...rest} />
        );
    }
    return null;
}