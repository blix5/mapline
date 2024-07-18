import React from 'react';
import useDynamicMapSvgImport from './useDynamicMapSvgImport';

export default function MapSvg({ name, onCompleted, onError, ...rest }) {
    const { error, loading, SvgIcon } = useDynamicMapSvgImport(name, { onCompleted, onError });

    if(error) {
        return error.message;
    }
    if(loading) {
        return "Loading...";
    }
    if(SvgIcon) {
        return (
            <SvgIcon {...rest} />
        );
    }
    return null;
}