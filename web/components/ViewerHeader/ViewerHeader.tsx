'use client';

import {
  ReactNode
} from 'react';

import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  FolderOpenIcon,
  LayoutGridIcon,
  ListChecksIcon,
  Loader2Icon
} from 'lucide-react';
import Link from 'next/link';

import {
  Button
} from '@/components/ui/button';
import {
  ButtonGroup,
  ButtonGroupSeparator
} from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

import {
  SaveState
} from '@basekm/@shared/constants';

import {
  AppHeader
} from './AppHeader';

export type ViewerHeaderVideo = {
  name: string;
  isScanned: boolean;
};

export type ViewerHeaderProps = {
  /** The open folder's name; null before one is opened. */
  folderName: string | null;
  isFolderButtonShown: boolean;
  videos: ViewerHeaderVideo[];
  selectedVideoName: string | null;
  saveState: SaveState;
  saveErrorMessage: string | null;
  scanStatusText: string | null;
  scanProgress: number | null;
  scanButtonLabel: string;
  isScanButtonShown: boolean;
  isScanButtonDisabled: boolean;
  isScanning: boolean;
  onOpenFolderClick: () => void;
  onSelectVideo: (name: string) => void;
  onScanClick: () => void;
  onScanSeveralClick: () => void;
  actions: ReactNode;
};

const SaveStateIndicator = ({
  saveState,
  saveErrorMessage,
}: {
  saveState: SaveState;
  saveErrorMessage: string | null;
}) => {
  if (saveState === SaveState.Saving) {
    return (
      <span className="hidden items-center gap-1 text-xs font-semibold text-muted-foreground md:flex">
        <Loader2Icon className="size-3.5 animate-spin" />
        Saving…
      </span>
    );
  }

  if (saveState === SaveState.Failed) {
    return (
      <span
        title={saveErrorMessage ?? undefined}
        className="hidden items-center gap-1 text-xs font-semibold text-destructive md:flex"
      >
        <AlertCircleIcon className="size-3.5" />
        Couldn’t save
      </span>
    );
  }

  if (saveState === SaveState.Saved) {
    return (
      <span className="hidden items-center gap-1 text-xs font-semibold text-emerald-600 md:flex">
        <CheckIcon className="size-3.5" />
        Saved automatically
      </span>
    );
  }

  return null;
};

export const ViewerHeader = ({
  folderName,
  isFolderButtonShown,
  videos,
  selectedVideoName,
  saveState,
  saveErrorMessage,
  scanStatusText,
  scanProgress,
  scanButtonLabel,
  isScanButtonShown,
  isScanButtonDisabled,
  isScanning,
  onOpenFolderClick,
  onSelectVideo,
  onScanClick,
  onScanSeveralClick,
  actions,
}: ViewerHeaderProps) => {
  const videoPickerLabel = selectedVideoName ?? 'Choose a video…';
  const hasVideoList = videos.length > 0;
  const scanProgressWidth = scanProgress === null ? null : `${Math.round(scanProgress * 100)}%`;

  return (
    <AppHeader
      actions={(
        <>
          <SaveStateIndicator
            saveState={saveState}
            saveErrorMessage={saveErrorMessage}
          />

          {scanStatusText && (
            <span className="hidden max-w-72 flex-col items-end gap-1 xl:flex">
              <span className="truncate text-xs font-medium text-muted-foreground">{scanStatusText}</span>
              {scanProgressWidth && (
                <span className="h-1 w-40 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{
                      width: scanProgressWidth,
                    }}
                  />
                </span>
              )}
            </span>
          )}

          {isScanButtonShown && (
            <ButtonGroup>
              <Button
                size="sm"
                variant={isScanning ? 'outline' : 'default'}
                disabled={isScanButtonDisabled}
                className="px-3.5 font-bold"
                onClick={onScanClick}
              >
                {isScanning && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
                {scanButtonLabel}
              </Button>
              {!isScanning && <ButtonGroupSeparator />}
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={!hasVideoList}
                  render={(
                    <Button
                      size="icon-sm"
                      variant={isScanning ? 'outline' : 'default'}
                      aria-label="More ways to scan"
                    />
                  )}
                >
                  <ChevronDownIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56"
                >
                  <DropdownMenuItem onClick={onScanSeveralClick}>
                    <ListChecksIcon />
                    {isScanning ? 'Add videos to the queue…' : 'Scan several videos…'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          )}

          <Button
            variant="outline"
            size="sm"
            className="font-bold"
            title="Every camera on one race clock"
            render={<Link href="/cameras" />}
            nativeButton={false}
          >
            <LayoutGridIcon data-icon="inline-start" />
            <span className="hidden sm:inline">All cameras</span>
          </Button>

          {actions}
        </>
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
        {isFolderButtonShown && (
          <Button
            variant="ghost"
            size="sm"
            className="max-w-48 shrink-0 font-bold"
            title={folderName ? 'Open another folder' : 'Open the folder with the race videos'}
            onClick={onOpenFolderClick}
          >
            <FolderOpenIcon data-icon="inline-start" />
            <span className="truncate">{folderName ?? 'Open folder…'}</span>
          </Button>
        )}

        <span className="hidden text-muted-foreground sm:inline">Video:</span>

        {hasVideoList && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(
                <Button
                  variant="outline"
                  size="sm"
                  className="max-w-56 justify-between gap-1.5 font-bold sm:max-w-72"
                />
              )}
            >
              <span className="truncate">{videoPickerLabel}</span>
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-96 w-80">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Videos in {folderName ?? 'the folder'}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={selectedVideoName ?? ''}
                  onValueChange={(value) => onSelectVideo(String(value))}
                >
                  {videos.map((video) => (
                    <DropdownMenuRadioItem
                      key={video.name}
                      value={video.name}
                    >
                      <span className="truncate">{video.name}</span>
                      {video.isScanned && <span className="ml-auto text-xs text-emerald-600">scanned</span>}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!hasVideoList && (
          <span className="truncate font-bold text-foreground">{videoPickerLabel}</span>
        )}
      </div>
    </AppHeader>
  );
};
