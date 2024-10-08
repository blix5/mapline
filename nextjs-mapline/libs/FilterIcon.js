import React from 'react';
import useDynamicFilterImport from './useDynamicFilterImport';

export default function FilterIcon({ filter, onCompleted, onError, ...rest }) {
    const { error, loading, SvgIcon } = useDynamicFilterImport(filter, { onCompleted, onError });

    if(error) {
        return error.message;
    }
    if(loading) {
        return "";
    }
    if(SvgIcon) {
        return (
            <SvgIcon {...rest} />
        );
    }
    return null;
}