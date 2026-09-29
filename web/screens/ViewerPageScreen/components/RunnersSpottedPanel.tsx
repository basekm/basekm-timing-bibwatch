'use client';

import {
  Fragment,
  useEffect,
  useRef
} from 'react';

import {
  DownloadIcon,
  SearchIcon
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
  cn
} from '@/lib/utils';

import {
  AnyDirectionValue,
  RunnerDirection,
  RunnerDirectionLabels,
  RunnerListFilter,
  RunnerListFilterLabels,
  RunnerListScope
} from '@basekm/@shared/constants';
import {
  formatVideoTime
} from '@basekm/@shared/utils/formatTime';
import {
  isUnregistered,
  labelTag,
  myTagsOf,
  sightingKey
} from '@basekm/@shared/utils/sightingTags';
import {
  CameraSegmentDto,
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
  totalCount: number;
  visibleSightings: SightingDto[];
  filters: RunnerListFilters;
  onFiltersChange: (filters: RunnerListFilters) => void;
  scope: RunnerListScope;
  onScopeChange: (scope: RunnerListScope) => void;
  isServerAvailable: boolean;
  currentSegment: CameraSegmentDto | null;
  currentTime: number;
  selectedKey: string | null;
  tags: TagsBySightingKey;
  registered?: string[];
  clockOffset: number | null;
  onSelectSighting: (sighting: SightingDto) => void;
  onToggleTag: (tag: string) => void;
  onExportCsv: () => void;
  onMarkFinishLine: () => void;
  onOpenSearchResult: (result: SightingSearchResultDto) => void;
};

const FilterOrder = [RunnerListFilter.All, RunnerListFilter.Finished, RunnerListFilter.Watchlist, RunnerListFilter.NotFinished];
const DirectionOrder = [RunnerDirection.Toward, RunnerDirection.Away, RunnerDirection.Still];
const NearbySeconds = 4;

export const RunnersSpottedPanel = ({
  totalCount,
  visibleSightings,
  filters,
  onFiltersChange,
  scope,
  onScopeChange,
  isServerAvailable,
  currentSegment,
  currentTime,
  selectedKey,
  tags,
  registered,
  clockOffset,
  onSelectSighting,
  onToggleTag,
  onExportCsv,
  onMarkFinishLine,
  onOpenSearchResult,
}: RunnersSpottedPanelProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const isAllVideos = scope === RunnerListScope.AllVideos;
  const isFinishLineMissing = currentSegment !== null && !currentSegment.mat;
  const segmentText = currentSegment
    ? `Camera position ${currentSegment.index} · ${formatVideoTime(currentSegment.from)}–${formatVideoTime(currentSegment.to)}`
    : 'No camera positions yet';
  const searchPlaceholder = isAllVideos ? 'Bib number or tag, in every video' : 'Search by bib number';

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
      <div className="flex flex-col gap-3 border-b p-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-bold">Runners spotted</h2>
          <span className="text-xs font-bold text-muted-foreground">{totalCount} found</span>
          <span className="text-xs text-muted-foreground">{segmentText}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FilterOrder.map((filter) => (
            <button
              key={filter}
              type="button"
              className={cn(
                'h-8 rounded-full border px-3 text-sm font-semibold transition-colors hover:bg-muted',
                filters.filter === filter && 'border-foreground bg-foreground text-background hover:bg-foreground/90',
              )}
              onClick={() => updateFilters({
                filter,
              })}
            >
              {RunnerListFilterLabels[filter]}
            </button>
          ))}
        </div>

        <InputGroup className="h-10 bg-muted/60">
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

        <div className="flex flex-wrap items-center gap-2">
          {isServerAvailable && (
            <div className="flex rounded-md bg-muted p-0.5">
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
          )}

          {!isAllVideos && (
            <NativeSelect
              size="sm"
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
          )}

          {!isAllVideos && (
            <Button
              variant="outline"
              size="sm"
              title="Download every runner with its tags as a CSV"
              onClick={onExportCsv}
            >
              <DownloadIcon data-icon="inline-start" />
              CSV
            </Button>
          )}
        </div>

        {isFinishLineMissing && !isAllVideos && (
          <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-900">
            No finish line marked for this camera position yet.{' '}
            <button
              type="button"
              className="font-semibold text-blue-700 underline underline-offset-2"
              onClick={onMarkFinishLine}
            >
              Mark finish line
            </button>
          </div>
        )}
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
          const myTagLabels = myTags.map((tag) => labelTag({
            tags,
            tag,
          }));
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
                  myTagLabels={myTagLabels}
                  clockOffset={clockOffset}
                  onSelect={onSelectSighting}
                />
              </div>

              {isSelected && (
                <RunnerTagEditor
                  sighting={sighting}
                  tags={tags}
                  myTags={myTags}
                  onToggleTag={onToggleTag}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </Card>
  );
};
