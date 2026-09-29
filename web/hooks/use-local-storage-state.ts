import {
  useCallback,
  useMemo,
  useSyncExternalStore
} from 'react';

type LocalStorageStateParams<T> = {
  key: string;
  defaultValue: T;
};

const LocalStorageChangeEvent = 'local-storage-change';

const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  window.addEventListener(LocalStorageChangeEvent, onChange);

  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(LocalStorageChangeEvent, onChange);
  };
};

const readRawValue = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const parseStoredValue = <T>(raw: string | null, defaultValue: T): T => {
  if (raw === null) {
    return defaultValue;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
};

export const useLocalStorageState = <T>({
  key,
  defaultValue,
}: LocalStorageStateParams<T>) => {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRawValue(key),
    () => null,
  );
  const value = useMemo(() => parseStoredValue(raw, defaultValue), [raw, defaultValue]);

  const setStoredValue = useCallback((next: T) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(LocalStorageChangeEvent));
  }, [key]);

  return [value, setStoredValue] as const;
};
