import React from 'react';

const convertDecimalYearToDate = (decimalYear) => {
    const year = Math.floor(decimalYear);
    const fractionalYear = decimalYear - year;

    const daysInYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0) ? 366 : 365;
    const totalDays = Math.round(fractionalYear * daysInYear);

    const daysInMonths = [31, (daysInYear === 366 ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    let month = 0;
    let daysRemaining = totalDays;

    while (daysRemaining > daysInMonths[month]) {
        daysRemaining -= daysInMonths[month];
        month++;
    }

    const day = daysRemaining;

    const formattedDate = `${(month + 1).toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;

    return formattedDate;
};

export default convertDecimalYearToDate;