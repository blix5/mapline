import React from 'react';

const categoryToIndex = (category) => {
    var index;
    switch(category) {
        case "event":
            index = 0;
            break;
        case "legislation":
            index = 1;
            break;
        case "foreign":
            index = 2;
            break;
        case "work":
            index = 3;
            break;
        case "court":
            index = 4;
            break;
        case "trend":
            index = 5;
            break;
        case "period":
            index = 6;
            break;
        case "ruling":
            index = 7;
            break;
        default:
            index = -1;
    }
    return index;
};

export default categoryToIndex;