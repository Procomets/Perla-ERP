export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatDate(val: any): string {
  if (!val) return '-';
  try {
    let d: Date;
    if (typeof val === 'object') {
      if (typeof val.toDate === 'function') {
        d = val.toDate();
      } else if (typeof val.seconds === 'number') {
        d = new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1000000);
      } else if (val instanceof Date) {
        d = val;
      } else {
        return '-';
      }
    } else if (typeof val === 'number') {
      d = new Date(val);
    } else if (typeof val === 'string') {
      d = new Date(val);
    } else {
      return '-';
    }

    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return '-';
  }
}

export function formatDateTime(val: any, includeSeconds: boolean = true): string {
  if (!val) return '-';
  try {
    let d: Date;
    if (typeof val === 'object') {
      if (typeof val.toDate === 'function') {
        d = val.toDate();
      } else if (typeof val.seconds === 'number') {
        d = new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1000000);
      } else if (val instanceof Date) {
        d = val;
      } else {
        return '-';
      }
    } else if (typeof val === 'number') {
      d = new Date(val);
    } else if (typeof val === 'string') {
      d = new Date(val);
    } else {
      return '-';
    }

    if (isNaN(d.getTime())) return '-';

    const formatted = new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true
    }).format(d);

    return formatted.replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
  } catch {
    return '-';
  }
}

export function formatQuantity(qty: number, unit: string = 'piece'): string {
  return `${qty.toLocaleString('en-IN')} ${unit}${qty > 1 ? 's' : ''}`;
}

export function numberToWordsIndian(num: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero Rupees Only';

  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'And ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? inWords(n % 10000000) : '');
  };

  const integerPart = Math.floor(num);
  const words = inWords(integerPart).trim();
  return `Rupees ${words} Only`;
}
