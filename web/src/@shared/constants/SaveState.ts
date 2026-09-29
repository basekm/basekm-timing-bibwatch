export const SaveState = {
  Idle: 'idle',
  Saving: 'saving',
  Saved: 'saved',
  Failed: 'failed',
} as const;
export type SaveState = (typeof SaveState)[keyof typeof SaveState];
