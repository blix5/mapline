import React from 'react';

export const dateFilterRender = (dateString, dateSpec) => {
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

export const convertDate = (dateStr) => {
    const dateParts = dateStr.split('/');
  
    let year, month = 0, day = 1; // Default values for month and day
  
    if (dateParts.length === 3) {
      [month, day, year] = dateParts;
    } else if (dateParts.length === 2) {
      [month, year] = dateParts;
    } else if (dateParts.length === 1) {
      [year] = dateParts;
    } else {
      throw new Error('Invalid date format');
    }
  
    year = parseInt(String(year), 10);
    month = parseInt(String(month), 10) - 1;
    day = parseInt(String(day), 10);
  
    const date = new Date(year, month >= 0 ? month : 0, day > 0 ? day : 1);
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: dateParts.length > 1 ? 'short' : undefined, day: dateParts.length === 3 ? 'numeric' : undefined };
    return date.toLocaleDateString('en-US', options);
  };