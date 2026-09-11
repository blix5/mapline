import React from 'react';
import useDynamicFilterImport from './useDynamicFilterImport';

export default function FilterIcon({ filter, onCompleted = undefined, onError = undefined, ...rest }) {
    const { error, loading, SvgIcon } = useDynamicFilterImport(filter, { onCompleted, onError });

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