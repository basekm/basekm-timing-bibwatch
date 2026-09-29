'use client';

import {
  FormEvent,
  useState
} from 'react';

import {
  Button
} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Input
} from '@/components/ui/input';
import {
  Label
} from '@/components/ui/label';

import {
  formatClockTime,
  formatVideoTime,
  parseClockTime
} from '@basekm/@shared/utils/formatTime';

type RaceClockDialogProps = {
  isOpen: boolean;
  videoTime: number;
  clockOffset: number | null;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (clockOffset: number) => void;
};

const RaceClockForm = ({
  videoTime,
  clockOffset,
  onCancel,
  onSave,
}: {
  videoTime: number;
  clockOffset: number | null;
  onCancel: () => void;
  onSave: (clockOffset: number) => void;
}) => {
  const initialValue = clockOffset === null ? '' : formatClockTime(clockOffset + videoTime);
  const [value, setValue] = useState(initialValue);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const readerSeconds = parseClockTime(value);

    if (readerSeconds === null || !value.trim()) {
      setErrorMessage('Use HH:MM:SS or HH:MM:SS.s');
      return;
    }

    onSave(readerSeconds - videoTime);
  };

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={handleSubmit}
    >
      <DialogHeader>
        <DialogTitle>Set race clock</DialogTitle>
        <DialogDescription>
          Pause on a known finish (e.g. a runner’s first chip read) and enter its reader time. Every runner in this video then gets a race time.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="race-clock-time"
          className="text-xs"
        >
          Race time at video {formatVideoTime(videoTime, true)}
        </Label>
        <Input
          id="race-clock-time"
          autoFocus
          autoComplete="off"
          placeholder="06:12:03.4"
          value={value}
          aria-invalid={errorMessage !== null}
          onChange={(event) => {
            setValue(event.target.value);
            setErrorMessage(null);
          }}
        />
        {errorMessage && <span className="text-xs text-destructive">{errorMessage}</span>}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
};

export const RaceClockDialog = ({
  isOpen,
  videoTime,
  clockOffset,
  onOpenChange,
  onSave,
}: RaceClockDialogProps) => {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        {isOpen && (
          <RaceClockForm
            videoTime={videoTime}
            clockOffset={clockOffset}
            onCancel={() => onOpenChange(false)}
            onSave={(nextClockOffset) => {
              onSave(nextClockOffset);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
