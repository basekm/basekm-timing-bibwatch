'use client';

import {
  FilmIcon,
  FolderOpenIcon,
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
  /** The open folder's name: null when the server is up but no folder is open yet. */
  folderName: string | null;
  isServerUp: boolean;
  onSelectVideo: (name: string) => void;
  onOpenFolder: () => void;
  onOpenVideoFile: () => void;
};

const textOf = ({
  folderName,
  isServerUp,
  hasVideos,
}: {
  folderName: string | null;
  isServerUp: boolean;
  hasVideos: boolean;
}) => {
  if (!isServerUp) {
    return {
      title: 'Open a race video',
      description: 'Drop a video anywhere on this page. It stays on this computer.',
    };
  }

  if (!folderName) {
    return {
      title: 'Open a folder',
      description: 'Pick the folder with the race videos. Scans, runners and tags are saved in it.',
    };
  }

  if (!hasVideos) {
    return {
      title: `No videos in “${folderName}”`,
      description: 'Add .mp4 or .mov files to it (symlinks are fine), or open another folder.',
    };
  }

  return {
    title: 'Pick a video',
    description: `From “${folderName}”, or drop a video anywhere on this page.`,
  };
};

export const EmptyViewerState = ({
  videos,
  folderName,
  isServerUp,
  onSelectVideo,
  onOpenFolder,
  onOpenVideoFile,
}: EmptyViewerStateProps) => {
  const text = textOf({
    folderName,
    isServerUp,
    hasVideos: videos.length > 0,
  });
  const isFolderFirst = isServerUp && !folderName;

  return (
    <Card className="flex aspect-video items-center justify-center border-2 border-dashed bg-card/60 p-6 shadow-none ring-0">
      <div className="flex w-full max-w-lg flex-col items-center gap-5 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          {isServerUp
            ? <FolderOpenIcon className="size-5 text-muted-foreground" />
            : <UploadIcon className="size-5 text-muted-foreground" />}
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-bold">{text.title}</h2>
          <p className="text-sm text-muted-foreground">{text.description}</p>
        </div>

        {videos.length > 0 && (
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
          {isServerUp && (
            <Button
              variant={isFolderFirst ? 'default' : 'outline'}
              onClick={onOpenFolder}
            >
              <FolderOpenIcon data-icon="inline-start" />
              {folderName ? 'Open another folder…' : 'Open folder…'}
            </Button>
          )}
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
