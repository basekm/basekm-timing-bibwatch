'use client';

import {
  ChevronRightIcon,
  EllipsisIcon
} from 'lucide-react';

import {
  Button
} from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Kbd
} from '@/components/ui/kbd';
import {
  Slider
} from '@/components/ui/slider';

import {
  formatSwipeSpeed
} from '@basekm/@shared/utils/swipeSpeed';

export type OverlaySettings = {
  isPeopleShown: boolean;
  isBibsShown: boolean;
  isEveryBibShown: boolean;
};

type ViewerMoreMenuProps = {
  isEventAvailable: boolean;
  bibNumbersSummary: string;
  bibDesignsSummary: string;
  hasVideo: boolean;
  canClearScans: boolean;
  isPeopleFirst: boolean;
  overlaySettings: OverlaySettings;
  swipeSpeed: number;
  isSwipeReversed: boolean;
  onOpenVideoFile: () => void;
  onImportResults: () => void;
  onOpenBibNumbers: () => void;
  onOpenBibDesigns: () => void;
  onSetRaceClock: () => void;
  onSplitCameraPosition: () => void;
  onDownloadSegments: () => void;
  onPeopleFirstChange: (isPeopleFirst: boolean) => void;
  onOverlaySettingsChange: (settings: OverlaySettings) => void;
  onSwipeSpeedChange: (speed: number) => void;
  onSwipeReversedChange: (isReversed: boolean) => void;
  onClearScans: () => void;
};

const KeyboardShortcuts = [
  ['Space', 'Play / pause'],
  ['← / →', 'Step 0.1 s'],
  ['⇧ ← / →', 'Step 1 s'],
  ['J / K / L', 'Back 1 s / pause / play faster'],
  ['[ / ]', 'Previous / next runner'],
  ['M', 'Mark finish line'],
  ['S', 'Split camera position'],
  ['1–4', 'Tag the selected runner'],
  ['Esc', 'Stop marking or picking'],
  ['⌥ + swipe', '10× faster scrubbing'],
];

const sectionLabelClassName = 'px-2 pt-2 pb-1 text-xs font-bold tracking-wider text-muted-foreground uppercase';

export const ViewerMoreMenu = ({
  isEventAvailable,
  bibNumbersSummary,
  bibDesignsSummary,
  hasVideo,
  canClearScans,
  isPeopleFirst,
  overlaySettings,
  swipeSpeed,
  isSwipeReversed,
  onOpenVideoFile,
  onImportResults,
  onOpenBibNumbers,
  onOpenBibDesigns,
  onSetRaceClock,
  onSplitCameraPosition,
  onDownloadSegments,
  onPeopleFirstChange,
  onOverlaySettingsChange,
  onSwipeSpeedChange,
  onSwipeReversedChange,
  onClearScans,
}: ViewerMoreMenuProps) => {
  const updateOverlaySettings = (patch: Partial<OverlaySettings>) => {
    onOverlaySettingsChange({
      ...overlaySettings,
      ...patch,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
          />
        )}
      >
        <EllipsisIcon data-icon="inline-start" />
        More
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-96 max-w-[calc(100vw-2rem)] p-1.5"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className={sectionLabelClassName}>Open files</DropdownMenuLabel>
          <DropdownMenuItem onClick={onOpenVideoFile}>Open video file…</DropdownMenuItem>
          <DropdownMenuItem onClick={onImportResults}>Import saved results…</DropdownMenuItem>
        </DropdownMenuGroup>

        {isEventAvailable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={sectionLabelClassName}>This event</DropdownMenuLabel>
              <DropdownMenuItem
                className="flex-col items-start gap-0.5"
                onClick={onOpenBibNumbers}
              >
                <span>Bib numbers…</span>
                <span className="text-xs text-muted-foreground">{bibNumbersSummary}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex-col items-start gap-0.5"
                onClick={onOpenBibDesigns}
              >
                <span>Bib designs…</span>
                <span className="text-xs text-muted-foreground">{bibDesignsSummary}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className={sectionLabelClassName}>This video</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!hasVideo}
            onClick={onSetRaceClock}
          >
            Set race clock…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasVideo}
            onClick={onSplitCameraPosition}
          >
            Split camera position here
            <DropdownMenuShortcut>
              <Kbd>S</Kbd>
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasVideo}
            onClick={onDownloadSegments}
          >
            Download a copy (segments.json)
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className={sectionLabelClassName}>Scanning</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={isPeopleFirst}
            closeOnClick={false}
            title="Experimental: find people first and read bibs only on their torsos. Changing it scans this video again from the start."
            onCheckedChange={onPeopleFirstChange}
          >
            Only look for people (faster)
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className={sectionLabelClassName}>Show on the video</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={overlaySettings.isPeopleShown}
            closeOnClick={false}
            onCheckedChange={(isPeopleShown) => updateOverlaySettings({
              isPeopleShown,
            })}
          >
            People boxes
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={overlaySettings.isBibsShown}
            closeOnClick={false}
            onCheckedChange={(isBibsShown) => updateOverlaySettings({
              isBibsShown,
            })}
          >
            Bib numbers
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={overlaySettings.isEveryBibShown}
            closeOnClick={false}
            onCheckedChange={(isEveryBibShown) => updateOverlaySettings({
              isEveryBibShown,
            })}
          >
            Show every bib, not just finished or watchlist
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className={sectionLabelClassName}>Trackpad scrubbing</DropdownMenuLabel>
          <div
            className="flex items-center gap-3 px-2 py-2"
            onKeyDown={(event) => event.stopPropagation()}
          >
            <span className="text-sm">Speed</span>
            <Slider
              className="flex-1"
              min={0}
              max={100}
              value={[swipeSpeed]}
              aria-label="Swipe speed"
              onValueChange={(value) => onSwipeSpeedChange(Array.isArray(value) ? value[0] : value)}
            />
            <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">{formatSwipeSpeed(swipeSpeed)}</span>
          </div>
          <DropdownMenuCheckboxItem
            checked={isSwipeReversed}
            closeOnClick={false}
            onCheckedChange={onSwipeReversedChange}
          >
            Reverse direction
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <Collapsible>
          <CollapsibleTrigger className="group/shortcuts flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-semibold hover:bg-accent">
            <ChevronRightIcon className="size-4 transition-transform group-data-panel-open/shortcuts:rotate-90" />
            Keyboard shortcuts
          </CollapsibleTrigger>
          <CollapsibleContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-2 pt-1 pb-2 text-xs">
              {KeyboardShortcuts.map(([keys, action]) => (
                <div
                  key={keys}
                  className="contents"
                >
                  <dt>
                    <Kbd>{keys}</Kbd>
                  </dt>
                  <dd className="text-muted-foreground">{action}</dd>
                </div>
              ))}
            </dl>
          </CollapsibleContent>
        </Collapsible>

        <DropdownMenuSeparator />
        <div className="m-1.5 flex flex-col gap-2 rounded-lg border border-destructive/40 p-3">
          <span className="text-sm font-bold text-destructive">Danger zone</span>
          <p className="text-xs text-muted-foreground">
            Clearing removes every runner, mark and camera split for this video. This can’t be undone.
          </p>
          <DropdownMenuItem
            variant="destructive"
            disabled={!canClearScans}
            className="w-fit rounded-full border border-destructive/40 px-3"
            onClick={onClearScans}
          >
            Clear scans…
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
