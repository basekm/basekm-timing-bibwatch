'use client';

import {
  memo
} from 'react';

import {
  Badge
} from '@/components/ui/badge';
import {
  cn
} from '@/lib/utils';

import {
  RunnerDirection,
  RunnerDirectionLabels,
  SightingLabel
} from '@basekm/@shared/constants';
import {
  sightingTime
} from '@basekm/@shared/utils/decideSightings';
import {
  formatClockTime,
  formatVideoTime
} from '@basekm/@shared/utils/formatTime';
import {
  currentSightingLabel
} from '@basekm/@shared/utils/sightingTags';
import {
  SightingDto
} from '@basekm/dtos';

type RunnerListItemProps = {
  sighting: SightingDto;
  isSelected: boolean;
  isCurrent: boolean;
  isUnregistered: boolean;
  myTagLabels: string[];
  clockOffset: number | null;
  onSelect: (sighting: SightingDto) => void;
};

const detailTextOf = (sighting: SightingDto) => {
  const label = currentSightingLabel(sighting);

  if (label === SightingLabel.Duplicate) {
    return sighting.note || 'Duplicate read';
  }

  if (label === SightingLabel.NeedsScan) {
    return 'Not read here yet — scan again';
  }

  if (label === SightingLabel.NearMat) {
    return 'Near the finish line';
  }

  if (label === SightingLabel.Passing) {
    return 'Passing by';
  }

  const directionLabel = RunnerDirectionLabels[sighting.direction as RunnerDirection];
  return directionLabel ?? 'Seen';
};

export const RunnerListItem = memo(({
  sighting,
  isSelected,
  isCurrent,
  isUnregistered,
  myTagLabels,
  clockOffset,
  onSelect,
}: RunnerListItemProps) => {
  const label = currentSightingLabel(sighting);
  const isFinished = label === SightingLabel.Crossed;
  const isMuted = label === SightingLabel.Duplicate || label === SightingLabel.NeedsScan;
  const time = sightingTime(sighting);
  const actionText = isFinished ? 'Finished at' : 'Seen at';
  const readerTimeText = clockOffset === null ? null : formatClockTime(clockOffset + time);

  const bibClassName = cn(
    'flex h-8 min-w-16 items-center justify-center rounded-md border-2 border-foreground/80 bg-background px-1.5 text-sm font-extrabold tabular-nums',
    isFinished && 'border-emerald-600 text-emerald-700',
    sighting.target && 'border-red-600 text-red-700',
    isMuted && 'border-muted-foreground/40 text-muted-foreground',
  );

  return (
    <button
      type="button"
      className={cn(
        'relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/70',
        isCurrent && 'bg-blue-500/5',
        isSelected && 'bg-blue-500/10 ring-1 ring-blue-500/40 hover:bg-blue-500/10',
      )}
      onClick={() => onSelect(sighting)}
    >
      {isCurrent && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-blue-500" />}

      <span className={bibClassName}>{sighting.bib}</span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('text-sm tabular-nums', isFinished && 'font-semibold text-emerald-700')}>
          {actionText} {formatVideoTime(time, true)}
          {readerTimeText && <span className="ml-1.5 text-xs text-muted-foreground">{readerTimeText}</span>}
        </span>

        <span className="truncate text-xs text-muted-foreground">{detailTextOf(sighting)}</span>

        {(sighting.target || isUnregistered || myTagLabels.length > 0) && (
          <span className="flex flex-wrap gap-1 pt-0.5">
            {sighting.target && (
              <Badge variant="destructive">Watchlist</Badge>
            )}
            {isUnregistered && (
              <Badge className="bg-amber-500/15 text-amber-800">Not registered</Badge>
            )}
            {myTagLabels.map((tagLabel) => (
              <Badge
                key={tagLabel}
                variant="secondary"
              >
                {tagLabel}
              </Badge>
            ))}
          </span>
        )}
      </span>
    </button>
  );
});

RunnerListItem.displayName = 'RunnerListItem';
