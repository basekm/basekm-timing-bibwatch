'use client';

import {
  FormEvent,
  useEffect,
  useRef,
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
  OverlayColors
} from '@basekm/@shared/constants';
import {
  formatVideoTime
} from '@basekm/@shared/utils/formatTime';
import {
  Box
} from '@basekm/dtos';

export type PersonToAdd = {
  t: number;
  box: Box;
};

type AddRunnerDialogProps = {
  person: PersonToAdd | null;
  video: HTMLVideoElement | null;
  onOpenChange: (isOpen: boolean) => void;
  onAdd: (bib: string) => void;
};

const PreviewHeight = 260;
const ContextPadding = 0.6;

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

const PersonPreview = ({
  video,
  box,
}: {
  video: HTMLVideoElement;
  box: Box;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (!canvas || !context || !videoWidth || !videoHeight) {
      return;
    }

    const [left, top, right, bottom] = box;
    const padX = (right - left) * ContextPadding;
    const padY = (bottom - top) * ContextPadding * 0.4;
    const cropLeft = clamp(left - padX) * videoWidth;
    const cropTop = clamp(top - padY) * videoHeight;
    const cropWidth = clamp(right + padX) * videoWidth - cropLeft;
    const cropHeight = clamp(bottom + padY) * videoHeight - cropTop;

    const pixelRatio = window.devicePixelRatio || 1;
    const scale = PreviewHeight / cropHeight;
    const width = cropWidth * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = 'auto';
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(PreviewHeight * pixelRatio);
    context.setTransform(pixelRatio * scale, 0, 0, pixelRatio * scale, 0, 0);
    context.drawImage(video, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    context.lineWidth = 3 / scale;
    context.strokeStyle = OverlayColors.Bib;
    context.strokeRect(left * videoWidth - cropLeft, top * videoHeight - cropTop, (right - left) * videoWidth, (bottom - top) * videoHeight);
  }, [video, box]);

  return (
    <div className="flex justify-center overflow-hidden rounded-lg bg-black">
      <canvas
        ref={canvasRef}
        className="max-w-full"
        aria-label="The person you clicked"
      />
    </div>
  );
};

const AddRunnerForm = ({
  person,
  video,
  onCancel,
  onAdd,
}: {
  person: PersonToAdd;
  video: HTMLVideoElement | null;
  onCancel: () => void;
  onAdd: (bib: string) => void;
}) => {
  const [value, setValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const bib = value.trim();

    if (!/^\d{1,9}$/.test(bib)) {
      setErrorMessage('Use digits only, e.g. 5176');
      return;
    }

    onAdd(bib);
  };

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={handleSubmit}
    >
      <DialogHeader>
        <DialogTitle>Add this runner</DialogTitle>
        <DialogDescription>
          Their bib wasn’t read here. Type the number you can see and they’re tracked like any other runner, finish time included.
        </DialogDescription>
      </DialogHeader>

      {video && (
        <PersonPreview
          video={video}
          box={person.box}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="add-runner-bib"
          className="text-xs"
        >
          Bib number of the person at {formatVideoTime(person.t, true)}
        </Label>
        <Input
          id="add-runner-bib"
          autoFocus
          autoComplete="off"
          inputMode="numeric"
          placeholder="5176"
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
        <Button type="submit">Add runner</Button>
      </DialogFooter>
    </form>
  );
};

export const AddRunnerDialog = ({
  person,
  video,
  onOpenChange,
  onAdd,
}: AddRunnerDialogProps) => {
  const isOpen = person !== null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        {isOpen && (
          <AddRunnerForm
            person={person}
            video={video}
            onCancel={() => onOpenChange(false)}
            onAdd={(bib) => {
              onAdd(bib);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
