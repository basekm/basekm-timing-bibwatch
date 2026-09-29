import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import {
  SaveState
} from '@basekm/@shared/constants';

type ScheduleSaveParams = {
  key: string;
  delayMs: number;
  task: () => Promise<unknown>;
  failureMessage: string;
};

export const useAutosave = () => {
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const runningRef = useRef(0);
  const [status, setStatus] = useState<SaveState>(SaveState.Idle);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasPendingSaves = useCallback(() => timersRef.current.size > 0 || runningRef.current > 0, []);

  const scheduleSave = useCallback(({
    key,
    delayMs,
    task,
    failureMessage,
  }: ScheduleSaveParams) => {
    const timers = timersRef.current;
    const existingTimer = timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    setStatus(SaveState.Saving);

    const timer = setTimeout(async () => {
      timers.delete(key);
      runningRef.current += 1;

      try {
        await task();
        setErrorMessage(null);
        setStatus(SaveState.Saved);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        setErrorMessage(`${failureMessage}: ${reason}`);
        setStatus(SaveState.Failed);
      } finally {
        runningRef.current -= 1;
      }
    }, delayMs);

    timers.set(key, timer);
  }, []);

  const cancelSaves = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (hasPendingSaves()) {
        event.preventDefault();
      }
    };

    window.addEventListener('beforeunload', warnBeforeLeaving);

    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeaving);
    };
  }, [hasPendingSaves]);

  return {
    autosaveStatus: status,
    autosaveErrorMessage: errorMessage,
    scheduleSave,
    cancelSaves,
  };
};
