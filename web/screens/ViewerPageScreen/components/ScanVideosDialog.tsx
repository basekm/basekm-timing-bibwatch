'use client';

import {
  useState
} from 'react';

import {
  Button
} from '@/components/ui/button';
import {
  Checkbox
} from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  cn
} from '@/lib/utils';

export type ScanVideosDialogVideo = {
  name: string;
  isScanned: boolean;
};

type ScanVideosDialogProps = {
  isOpen: boolean;
  videos: ScanVideosDialogVideo[];
  /** The video being scanned now, if any. */
  scanningVideoName: string | null;
  queuedVideoNames: string[];
  onOpenChange: (isOpen: boolean) => void;
  onScan: (videoNames: string[]) => void;
};

export const ScanVideosDialog = ({
  isOpen,
  videos,
  scanningVideoName,
  queuedVideoNames,
  onOpenChange,
  onScan,
}: ScanVideosDialogProps) => {
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [wasOpen, setWasOpen] = useState(false);

  const isWaiting = (name: string) => name === scanningVideoName || queuedVideoNames.includes(name);
  const pickableVideos = videos.filter((video) => !isWaiting(video.name));
  const notScannedNames = pickableVideos.filter((video) => !video.isScanned).map((video) => video.name);
  const isScanRunning = scanningVideoName !== null || queuedVideoNames.length > 0;

  // Each time it opens, start with the videos that still need a scan picked.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setSelectedNames(notScannedNames);
    }
  }

  const toggle = (name: string, isChecked: boolean) => {
    setSelectedNames((current) => (isChecked ? [...current, name] : current.filter((selected) => selected !== name)));
  };

  const handleScan = () => {
    // In the folder's order, so they scan the way they're listed.
    onScan(videos.map((video) => video.name).filter((name) => selectedNames.includes(name)));
    onOpenChange(false);
  };

  const statusOf = (video: ScanVideosDialogVideo) => {
    if (video.name === scanningVideoName) {
      return 'scanning now';
    }

    if (queuedVideoNames.includes(video.name)) {
      return `queued #${queuedVideoNames.indexOf(video.name) + 1}`;
    }

    return video.isScanned ? 'scanned' : 'not scanned';
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan several videos</DialogTitle>
          <DialogDescription>
            They’re scanned one after another (one scan already uses the whole Mac), each from its start with its own
            camera positions, race clock and people-only setting. Videos already scanned only read what’s missing.
            {isScanRunning && ' These are added after the scans already waiting.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs font-semibold">
          <Button
            size="xs"
            variant="outline"
            onClick={() => setSelectedNames(pickableVideos.map((video) => video.name))}
          >
            All
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setSelectedNames(notScannedNames)}
          >
            Not scanned
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setSelectedNames([])}
          >
            None
          </Button>
          <span className="ml-auto text-muted-foreground">{selectedNames.length} selected</span>
        </div>

        <div className="max-h-80 min-w-0 overflow-y-auto rounded-md border">
          <ul className="divide-y">
            {videos.map((video) => (
              <li key={video.name}>
                <label className="flex min-w-0 cursor-pointer items-center gap-3 px-3 py-2 text-sm has-disabled:cursor-default has-disabled:opacity-60">
                  <Checkbox
                    checked={isWaiting(video.name) || selectedNames.includes(video.name)}
                    disabled={isWaiting(video.name)}
                    onCheckedChange={(isChecked) => toggle(video.name, isChecked)}
                  />
                  <span
                    className="min-w-0 flex-1 truncate font-medium"
                    title={video.name}
                  >
                    {video.name}
                  </span>
                  <span className={cn('shrink-0 text-xs whitespace-nowrap', video.isScanned && !isWaiting(video.name) ? 'text-emerald-600' : 'text-muted-foreground')}>
                    {statusOf(video)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={!selectedNames.length}
            onClick={handleScan}
          >
            {isScanRunning ? 'Add' : 'Scan'} {selectedNames.length} {selectedNames.length === 1 ? 'video' : 'videos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
