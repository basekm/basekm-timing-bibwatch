'use client';

import {
  useEffect,
  useRef
} from 'react';

import {
  SearchIcon
} from 'lucide-react';

import {
  Card
} from '@/components/ui/card';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from '@/components/ui/input-group';

import {
  RunnerListItem
} from '@basekm/screens/ViewerPageScreen/components/RunnerListItem';

import {
  CameraSighting
} from '../utils/mergeCameraSightings';

type CamerasRunnersPanelProps = {
  shownSightings: CameraSighting[];
  totalCount: number;
  unlinkedCameraCount: number;
  errorMessage: string | null;
  search: string;
  onSearchChange: (search: string) => void;
  raceTime: number;
  selectedKey: string | null;
  onSelect: (cameraSighting: CameraSighting) => void;
};

const NearbySeconds = 4;

export const CamerasRunnersPanel = ({
  shownSightings,
  totalCount,
  unlinkedCameraCount,
  errorMessage,
  search,
  onSearchChange,
  raceTime,
  selectedKey,
  onSelect,
}: CamerasRunnersPanelProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const isSearching = search.trim().length > 0;
  const allCountText = `${totalCount} sightings, every camera`;
  const searchCountText = `${shownSightings.length} of ${totalCount} sightings`;
  const countText = (isSearching && searchCountText) || allCountText;
  const unlinkedText = `${unlinkedCameraCount} camera${unlinkedCameraCount === 1 ? '' : 's'} without a race clock not included`;
  const emptyText = (isSearching && 'Not seen by any camera.') || 'No runners found yet. Scan the videos in the viewer.';

  useEffect(() => {
    if (!selectedKey) {
      return;
    }

    const selectedRow = listRef.current?.querySelector(`[data-key="${CSS.escape(selectedKey)}"]`);
    selectedRow?.scrollIntoView({
      block: 'nearest',
    });
  }, [selectedKey]);

  return (
    <Card className="h-full min-h-0 gap-0 py-0">
      <div className="flex flex-col gap-2 border-b p-4">
        <InputGroup className="h-10 bg-muted/60">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={search}
            placeholder="Search by bib number"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </InputGroup>

        <p className="text-xs font-semibold text-muted-foreground tabular-nums">{countText}</p>
        {errorMessage && (
          <p className="text-xs text-destructive">Couldn’t load the runners: {errorMessage}</p>
        )}
        {unlinkedCameraCount > 0 && (
          <p className="text-xs text-muted-foreground">{unlinkedText}</p>
        )}
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto p-2"
      >
        {shownSightings.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        )}

        {shownSightings.map((cameraSighting) => {
          const isCurrent = Math.abs(raceTime - cameraSighting.raceTime) <= NearbySeconds;

          return (
            <div
              key={cameraSighting.key}
              data-key={cameraSighting.key}
            >
              <RunnerListItem
                sighting={cameraSighting.sighting}
                isSelected={cameraSighting.key === selectedKey}
                isCurrent={isCurrent}
                isUnregistered={cameraSighting.isUnregistered}
                myTags={cameraSighting.tags}
                clockOffset={cameraSighting.clockOffset}
                sourceText={cameraSighting.video}
                onSelect={() => onSelect(cameraSighting)}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
};
