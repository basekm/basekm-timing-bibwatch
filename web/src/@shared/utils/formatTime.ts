const pad = (value: number) => String(value).padStart(2, '0');

const isMissingTime = (seconds: number | null | undefined): seconds is null | undefined => {
  return seconds === null || seconds === undefined || Number.isNaN(seconds);
};

export const formatClockTime = (seconds: number | null | undefined, withTenths = true): string => {
  if (isMissingTime(seconds)) {
    return '—';
  }

  const sign = seconds < 0 ? '-' : '';
  const absolute = Math.abs(seconds);
  const whole = Math.floor(absolute);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  const secondsPart = whole % 60;
  const base = `${pad(hours)}:${pad(minutes)}:${pad(secondsPart)}`;

  if (!withTenths) {
    return `${sign}${base}`;
  }

  const tenths = Math.floor((absolute - whole) * 10);
  return `${sign}${base}.${tenths}`;
};

export const formatVideoTime = (seconds: number | null | undefined, withTenths = false): string => {
  if (isMissingTime(seconds)) {
    return '—';
  }

  const absolute = Math.max(0, seconds);
  const whole = Math.floor(absolute);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  const secondsPart = whole % 60;
  const tenthsSuffix = withTenths ? `.${Math.floor((absolute - whole) * 10)}` : '';

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secondsPart)}${tenthsSuffix}`;
  }

  return `${minutes}:${pad(secondsPart)}${tenthsSuffix}`;
};

export const parseClockTime = (text: string): number | null => {
  const parts = String(text).trim().split(':').map(Number);

  if (parts.length === 0 || parts.some(Number.isNaN)) {
    return null;
  }

  return parts.reduce((total, value) => total * 60 + value, 0);
};
