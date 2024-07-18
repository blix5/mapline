import React from 'react';

export default function compassDimensions(height, borderY) {
    return (height * borderY * 0.4) > 130 ? 130 : (height * borderY * 0.4);
}