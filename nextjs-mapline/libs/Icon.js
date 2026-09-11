import React from 'react';
import useDynamicIconImport from './useDynamicIconImport';

export default function Icon({ icon, onCompleted, onError, ...rest }) {
    const { error, loading, SvgIcon } = useDynamicIconImport(icon, { onCompleted, onError });

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