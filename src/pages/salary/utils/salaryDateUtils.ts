export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

export const isSunday = (year: number, month: number, day: number): boolean => {
  return new Date(year, month, day).getDay() === 0;
};

export const getSundaysCount = (year: number, month: number): number => {
  const days = getDaysInMonth(year, month);
  let count = 0;
  for (let d = 1; d <= days; d++) {
    if (new Date(year, month, d).getDay() === 0) count++;
  }
  return count;
};

export const formatDateDDMMYY = (year: number, month: number, day: number): string => {
  const dd = String(day).padStart(2, '0');
  const mm = String(month + 1).padStart(2, '0');
  const yy = String(year).slice(-2);
  return `${dd}.${mm}.${yy}`;
};

export const formatDateDDMMYYYY = (year: number, month: number, day: number): string => {
  const dd = String(day).padStart(2, '0');
  const mm = String(month + 1).padStart(2, '0');
  return `${dd}-${mm}-${year}`;
};

export const formatDateYYYYMMDD = (year: number, month: number, day: number): string => {
  const dd = String(day).padStart(2, '0');
  const mm = String(month + 1).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
};

export const getMonthName = (month: number): string => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return monthNames[month] || '';
};
