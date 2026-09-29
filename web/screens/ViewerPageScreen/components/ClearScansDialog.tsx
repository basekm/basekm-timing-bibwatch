'use client';

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

type ClearScansDialogProps = {
  isOpen: boolean;
  videoName: string;
  durationSeconds: number;
  onOpenChange: (isOpen: boolean) => void;
  onClear: (keepSegments: boolean) => void;
};

const ScanMinutesPerVideoMinute = 0.6;

export const ClearScansDialog = ({
  isOpen,
  videoName,
  durationSeconds,
  onOpenChange,
  onClear,
}: ClearScansDialogProps) => {
  const estimatedMinutes = Math.max(1, Math.round((durationSeconds / 60) * ScanMinutesPerVideoMinute));

  const handleClear = (keepSegments: boolean) => {
    onClear(keepSegments);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Clear scans for {videoName}?</DialogTitle>
          <DialogDescription>
            This deletes the bibs and people read from this video and the finishes found. The next scan reads the whole video again (about {estimatedMinutes} min).
            Your finish lines and camera splits can be kept.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleClear(true)}
          >
            Clear results, keep finish lines
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleClear(false)}
          >
            Clear everything
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
