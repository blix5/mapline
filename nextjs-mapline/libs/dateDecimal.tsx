import React from 'react';

export function convertDecimalYearToDate(decimalYear) {
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
}

const isLeapYear = (year) => {
  if (year < 1582) {
    return year % 4 === 0;
  } else {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }
};

const daysInYear = (year) => {
  return isLeapYear(year) ? 366 : 365;
};

const dayOfYear = (year, month, day) => {
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day + daysInMonth.slice(0, month).reduce((a, b) => a + b, 0);
};

export function convertDateToDecimal(dateStr) {
  let year, month = 0, day = 1; // Default month and day if not provided

  const parts = dateStr.split('/');
  if (parts.length === 3) { // MM/DD/YYYY
    [month, day, year] = parts.map(Number);
    month -= 1; // Convert month to 0-indexed
  } else if (parts.length === 2) { // MM/YYYY
    [month, year] = parts.map(Number);
    month -= 1; // Convert month to 0-indexed
  } else if (parts.length === 1) { // YYYY
    year = Number(parts[0]);
    if(parts[0].length == 0) {
      return null;
    }
  } else {
    return null; // Return null for invalid date format
  }

  // Calculate the decimal year
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }

  const totalDays = daysInYear(year);
  const currentDayOfYear = dayOfYear(year, month, day);

  return year + (currentDayOfYear - 1) / totalDays;
};