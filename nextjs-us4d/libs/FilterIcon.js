import React from 'react';
import useDynamicFilterImport from '../libs/useDynamicFilterImport';

export default function FilterIcon({ filter, onCompleted, onError, ...rest }) {
    const { error, loading, SvgIcon } = useDynamicFilterImport(filter, { onCompleted, onError });

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