'use client';

import {
  Fragment,
  useEffect,
  useRef
} from 'react';

import {
  SearchIcon,
  SlidersHorizontalIcon
} from 'lucide-react';

import {
  Button
} from '@/components/ui/button';
import {
  Card
} from '@/components/ui/card';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from '@/components/ui/input-group';
import {
  NativeSelect,
  NativeSelectOption
} from '@/components/ui/native-select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import {
  cn
} from '@/lib/utils';

import {
  AnyDirectionValue,
  RunnerDirection,
  RunnerDirectionLabels,
  RunnerListScope
} from '@basekm/@shared/constants';
import {
  isUnregistered,
  myTagsOf,
  sightingKey
} from '@basekm/@shared/utils/sightingTags';
import {
  SightingDto,
  SightingSearchResultDto,
  TagsBySightingKey
} from '@basekm/dtos';

import {
  RunnerListFilters
} from '../utils/runnerListFilters';

import {
  AllVideosResults
} from './AllVideosResults';
import {
  RunnerListItem
} from './RunnerListItem';
import {
  RunnerTagEditor
} from './RunnerTagEditor';

type RunnersSpottedPanelProps = {
  visibleSightings: SightingDto[];
  filters: RunnerListFilters;
  onFiltersChange: (filters: RunnerListFilters) => void;
  scope: RunnerListScope;
  onScopeChange: (scope: RunnerListScope) => void;
  isServerAvailable: boolean;
  currentTime: number;
  selectedKey: string | null;
  tags: TagsBySightingKey;
  registered?: string[];
  clockOffset: number | null;
  onSelectSighting: (sighting: SightingDto) => void;
  onToggleTag: (tag: string) => void;
  onRemoveRunner: (sighting: SightingDto) => void;
  onOpenSearchResult: (result: SightingSearchResultDto) => void;
};

const DirectionOrder = [RunnerDirection.Toward, RunnerDirection.Away, RunnerDirection.Still];
const NearbySeconds = 4;

export const RunnersSpottedPanel = ({
  visibleSightings,
  filters,
  onFiltersChange,
  scope,
  onScopeChange,
  isServerAvailable,
  currentTime,
  selectedKey,
  tags,
  registered,
  clockOffset,
  onSelectSighting,
  onToggleTag,
  onRemoveRunner,
  onOpenSearchResult,
}: RunnersSpottedPanelProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const isAllVideos = scope === RunnerListScope.AllVideos;
  const searchPlaceholder = isAllVideos ? 'Bib number or tag, in every video' : 'Search by bib number';
  const isFiltered = isAllVideos || filters.direction !== AnyDirectionValue;

  useEffect(() => {
    if (!selectedKey) {
      return;
    }

    const selectedRow = listRef.current?.querySelector(`[data-key="${CSS.escape(selectedKey)}"]`);
    selectedRow?.scrollIntoView({
      block: 'nearest',
    });
  }, [selectedKey]);

  const updateFilters = (patch: Partial<RunnerListFilters>) => {
    onFiltersChange({
      ...filters,
      ...patch,
    });
  };

  return (
    <Card className="h-full min-h-0 gap-0 py-0">
      <div className="flex items-center gap-2 border-b p-4">
        <InputGroup className="h-10 flex-1 bg-muted/60">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={filters.search}
            placeholder={searchPlaceholder}
            onChange={(event) => updateFilters({
              search: event.target.value,
            })}
          />
        </InputGroup>

        <Popover>
          <PopoverTrigger
            render={(
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="Search filters"
                title="Search filters"
                className="relative shrink-0"
              />
            )}
          >
            <SlidersHorizontalIcon />
            {isFiltered && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-sky-500" />
            )}
          </PopoverTrigger>

          <PopoverContent
            align="end"
            className="w-64 gap-3"
          >
            {!isAllVideos && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">Movement</span>
                <NativeSelect
                  className="w-full"
                  value={filters.direction}
                  aria-label="Movement"
                  onChange={(event) => updateFilters({
                    direction: event.target.value,
                  })}
                >
                  <NativeSelectOption value={AnyDirectionValue}>Any movement</NativeSelectOption>
                  {DirectionOrder.map((direction) => (
                    <NativeSelectOption
                      key={direction}
                      value={direction}
                    >
                      {RunnerDirectionLabels[direction]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            )}

            {isServerAvailable && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">Search in</span>
                <div className="flex w-fit rounded-md bg-muted p-0.5">
                  <button
                    type="button"
                    className={cn('h-7 rounded px-2.5 text-xs font-semibold text-muted-foreground', !isAllVideos && 'bg-background text-foreground shadow-xs')}
                    onClick={() => onScopeChange(RunnerListScope.ThisVideo)}
                  >
                    This video
                  </button>
                  <button
                    type="button"
                    className={cn('h-7 rounded px-2.5 text-xs font-semibold text-muted-foreground', isAllVideos && 'bg-background text-foreground shadow-xs')}
                    onClick={() => onScopeChange(RunnerListScope.AllVideos)}
                  >
                    All videos
                  </button>
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto p-2"
      >
        {isAllVideos && (
          <AllVideosResults
            search={filters.search}
            onOpenResult={onOpenSearchResult}
          />
        )}

        {!isAllVideos && visibleSightings.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No runners here yet.</p>
        )}

        {!isAllVideos && visibleSightings.map((sighting) => {
          const key = sightingKey(sighting);
          const isSelected = key === selectedKey;
          const isCurrent = currentTime >= sighting.from - NearbySeconds && currentTime <= sighting.to + NearbySeconds;
          const myTags = myTagsOf({
            tags,
            sighting,
          });
          const isRunnerUnregistered = isUnregistered({
            sighting,
            registered,
          });

          return (
            <Fragment key={key}>
              <div data-key={key}>
                <RunnerListItem
                  sighting={sighting}
                  isSelected={isSelected}
                  isCurrent={isCurrent}
                  isUnregistered={isRunnerUnregistered}
                  myTags={myTags}
                  clockOffset={clockOffset}
                  onSelect={onSelectSighting}
                />
              </div>

              {isSelected && (
                <RunnerTagEditor
                  sighting={sighting}
                  myTags={myTags}
                  onToggleTag={onToggleTag}
                  onRemove={() => onRemoveRunner(sighting)}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </Card>
  );
};
