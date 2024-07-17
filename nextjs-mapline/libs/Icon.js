import React from 'react';
import useDynamicIconImport from './useDynamicIconImport';

export default function Icon({ icon, onCompleted, onError, ...rest }) {
    const { error, loading, SvgIcon } = useDynamicIconImport(icon, { onCompleted, onError });

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