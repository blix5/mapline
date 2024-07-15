import React from 'react';

const dateFilterRender = (dateString, dateSpec) => {
    const month = Number(String(dateString).substring(0, 2));
    const year = Number(String(dateString).substring(6, 10));
    
    switch(dateSpec) {
        case 'day':
            return dateString;
        case 'month':
            return month + '/' + year;
        case 'year':
            return year;
        default:
            return dateString;
    }
};

export default dateFilterRender;