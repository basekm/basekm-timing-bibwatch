'use client';

import {
  FilmIcon,
  UploadIcon
} from 'lucide-react';

import {
  Button
} from '@/components/ui/button';
import {
  Card
} from '@/components/ui/card';

import {
  ViewerHeaderVideo
} from '@basekm/components/ViewerHeader';

type EmptyViewerStateProps = {
  videos: ViewerHeaderVideo[];
  isServerAvailable: boolean;
  onSelectVideo: (name: string) => void;
  onOpenVideoFile: () => void;
};

export const EmptyViewerState = ({
  videos,
  isServerAvailable,
  onSelectVideo,
  onOpenVideoFile,
}: EmptyViewerStateProps) => {
  return (
    <Card className="flex aspect-video items-center justify-center border-2 border-dashed bg-card/60 p-6 shadow-none ring-0">
      <div className="flex w-full max-w-lg flex-col items-center gap-5 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <UploadIcon className="size-5 text-muted-foreground" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-bold">Open a race video</h2>
          <p className="text-sm text-muted-foreground">
            Drop a video anywhere on this page. It stays on this computer.
          </p>
        </div>

        {isServerAvailable && videos.length > 0 && (
          <div className="flex max-h-56 w-full flex-col gap-1 overflow-y-auto rounded-lg border bg-background p-1 text-left">
            {videos.map((video) => (
              <button
                key={video.name}
                type="button"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
                onClick={() => onSelectVideo(video.name)}
              >
                <FilmIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-semibold">{video.name}</span>
                {video.isScanned && <span className="ml-auto text-xs font-semibold text-emerald-600">scanned</span>}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            onClick={onOpenVideoFile}
          >
            <FilmIcon data-icon="inline-start" />
            Open video file…
          </Button>
        </div>
      </div>
    </Card>
  );
};
