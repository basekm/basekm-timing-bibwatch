'use client';

import {
  FormEvent,
  useState
} from 'react';

import {
  ArrowUpIcon,
  ChevronRightIcon,
  ClockIcon,
  FilmIcon,
  FolderIcon,
  HardDriveIcon,
  Loader2Icon
} from 'lucide-react';

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
  cn
} from '@/lib/utils';

import {
  FoldersQueries
} from '@basekm/api';
import {
  FolderDto
} from '@basekm/dtos';

type OpenFolderDialogProps = {
  isOpen: boolean;
  isOpening: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onOpenFolder: (path: string) => void;
};

const sideLabelClassName = 'px-2 pt-1 pb-1 text-[11px] font-bold tracking-wider text-muted-foreground uppercase';

const SideItem = ({
  folder,
  icon,
  isActive,
  isMissing,
  onClick,
}: {
  folder: FolderDto;
  icon: typeof FolderIcon;
  isActive: boolean;
  isMissing?: boolean;
  onClick: () => void;
}) => {
  const Icon = icon;

  return (
    <button
      type="button"
      title={isMissing ? `${folder.path} (not found — drive unplugged?)` : folder.path}
      disabled={isMissing}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent',
        isActive && 'bg-muted font-semibold',
      )}
      onClick={onClick}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{folder.name}</span>
    </button>
  );
};

const FolderBrowser = ({
  isOpening,
  onCancel,
  onOpenFolder,
}: {
  isOpening: boolean;
  onCancel: () => void;
  onOpenFolder: (path: string) => void;
}) => {
  const [browsePath, setBrowsePath] = useState<string | undefined>(undefined);
  const [typedPath, setTypedPath] = useState<string | null>(null);

  const {
    foldersGetQuery
  } = FoldersQueries.useGetFolders();
  const {
    folderBrowseGetQuery
  } = FoldersQueries.useBrowse({
    path: browsePath,
  });

  const folders = foldersGetQuery.data ?? null;
  const listing = folderBrowseGetQuery.data ?? null;
  const browseError = folderBrowseGetQuery.isError ? folderBrowseGetQuery.error.message : null;
  const isCurrent = listing !== null && listing.path === folders?.current?.path;

  const goTo = (path: string) => {
    setTypedPath(null);
    setBrowsePath(path);
  };

  const handlePathSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (typedPath?.trim()) {
      goTo(typedPath.trim());
    }
  };

  const videoCountText = listing && listing.videos.length
    ? `${listing.videos.length} video${listing.videos.length === 1 ? '' : 's'} in this folder`
    : 'No videos in this folder';

  return (
    <>
      <DialogHeader>
        <DialogTitle>Open a folder</DialogTitle>
        <DialogDescription>
          The folder with the race videos (one event). Scans, runners, tags and race clocks are saved inside it.
        </DialogDescription>
      </DialogHeader>

      <form
        className="flex gap-2"
        onSubmit={handlePathSubmit}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Up one folder"
          disabled={!listing?.parent}
          onClick={() => listing?.parent && goTo(listing.parent)}
        >
          <ArrowUpIcon />
        </Button>
        <Input
          aria-label="Folder path"
          className="font-mono text-xs"
          spellCheck={false}
          placeholder="/Volumes/SSD/race-day"
          title="Type or paste a path (in Finder: ⌥⌘C copies a folder’s path), then press Return"
          value={typedPath ?? listing?.path ?? ''}
          onChange={(event) => setTypedPath(event.target.value)}
        />
      </form>

      <div className="grid min-h-0 gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <nav className="hidden max-h-80 flex-col gap-0.5 overflow-y-auto sm:flex">
          {folders && folders.recent.length > 0 && (
            <>
              <span className={sideLabelClassName}>Recent</span>
              {folders.recent.map((folder) => (
                <SideItem
                  key={folder.path}
                  folder={folder}
                  icon={ClockIcon}
                  isActive={listing?.path === folder.path}
                  isMissing={!folder.exists}
                  onClick={() => goTo(folder.path)}
                />
              ))}
            </>
          )}
          {folders && (
            <>
              <span className={cn(sideLabelClassName, folders.recent.length > 0 && 'pt-3')}>Places</span>
              {folders.places.map((folder) => (
                <SideItem
                  key={folder.path}
                  folder={folder}
                  icon={folder.path.startsWith('/Volumes/') ? HardDriveIcon : FolderIcon}
                  isActive={listing?.path === folder.path}
                  onClick={() => goTo(folder.path)}
                />
              ))}
            </>
          )}
        </nav>

        <div
          className={cn(
            'flex h-80 flex-col overflow-y-auto rounded-lg border bg-background p-1 transition-opacity',
            folderBrowseGetQuery.isFetching && 'opacity-60',
          )}
        >
          {browseError && (
            <p className="p-3 text-sm text-destructive">{browseError}</p>
          )}

          {!browseError && listing?.folders.map((folder) => (
            <button
              key={folder.path}
              type="button"
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => goTo(folder.path)}
            >
              <FolderIcon className="size-4 shrink-0 fill-sky-500/20 text-sky-600" />
              <span className="truncate">{folder.name}</span>
              <ChevronRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}

          {!browseError && listing?.videos.map((video) => (
            <div
              key={video}
              className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-muted-foreground"
            >
              <FilmIcon className="size-4 shrink-0" />
              <span className="truncate">{video}</span>
            </div>
          ))}

          {!browseError && listing && !listing.folders.length && !listing.videos.length && (
            <p className="p-3 text-sm text-muted-foreground">This folder is empty.</p>
          )}
        </div>
      </div>

      <DialogFooter className="items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">
          {listing && !browseError && (isCurrent ? 'This folder is open now' : videoCountText)}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!listing || Boolean(browseError) || isCurrent || isOpening}
            className="max-w-64"
            onClick={() => listing && onOpenFolder(listing.path)}
          >
            {isOpening && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            <span className="truncate">Open “{listing?.name ?? '…'}”</span>
          </Button>
        </div>
      </DialogFooter>
    </>
  );
};

export const OpenFolderDialog = ({
  isOpen,
  isOpening,
  onOpenChange,
  onOpenFolder,
}: OpenFolderDialogProps) => {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-2xl">
        {isOpen && (
          <FolderBrowser
            isOpening={isOpening}
            onCancel={() => onOpenChange(false)}
            onOpenFolder={onOpenFolder}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
