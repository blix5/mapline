import React from 'react';
import useDynamicStateImport from './useDynamicStateImport';

export default function State({ name, onCompleted, onError, ...rest }) {
    const { error, loading, SvgIcon } = useDynamicStateImport(name, { onCompleted, onError });

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