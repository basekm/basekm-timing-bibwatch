'use client';

import {
  Loader2Icon
} from 'lucide-react';

import {
  cn
} from '@/lib/utils';

import {
  SightingLabel
} from '@basekm/@shared/constants';
import {
  formatClockTime,
  formatVideoTime
} from '@basekm/@shared/utils/formatTime';
import {
  SightingsQueries
} from '@basekm/api';
import {
  SightingSearchResultDto
} from '@basekm/dtos';
import {
  useDebouncedValue
} from '@basekm/hooks/use-debounced-value';

type AllVideosResultsProps = {
  search: string;
  onOpenResult: (result: SightingSearchResultDto) => void;
};

const MaxShownResults = 200;

export const AllVideosResults = ({
  search,
  onOpenResult,
}: AllVideosResultsProps) => {
  const query = useDebouncedValue(search.trim(), 250);
  const isBibQuery = /^\d+$/.test(query);
  const {
    sightingsSearchQuery
  } = SightingsQueries.useSearch({
    bib: isBibQuery ? query : undefined,
    tag: !isBibQuery && query ? query : undefined,
  });

  if (!query) {
    return (
      <p className="px-2 py-6 text-center text-sm text-muted-foreground">
        Type a bib number (147 finds 0147) or a tag (e.g. finisher) to find it in every video.
      </p>
    );
  }

  if (sightingsSearchQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Searching every video…
      </div>
    );
  }

  if (sightingsSearchQuery.isError) {
    return <p className="px-2 py-6 text-center text-sm text-destructive">{sightingsSearchQuery.error.message}</p>;
  }

  const results = sightingsSearchQuery.data ?? [];
  const videoCount = new Set(results.map((result) => result.video)).size;

  if (!results.length) {
    return <p className="px-2 py-6 text-center text-sm text-muted-foreground">Not seen in any video.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 pb-1 text-xs font-semibold text-muted-foreground">
        {results.length} sighting(s) in {videoCount} video(s)
      </p>

      {results.slice(0, MaxShownResults).map((result) => {
        const isFinished = result.label === SightingLabel.Crossed;
        const readerTimeText = result.readerTime === null ? '' : ` · ${formatClockTime(result.readerTime)}`;
        const tagText = result.tags.length ? ` · ${result.tags.join(', ')}` : '';

        return (
          <button
            key={`${result.video}-${result.key}`}
            type="button"
            className="flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/70"
            onClick={() => onOpenResult(result)}
          >
            <span className={cn('flex h-8 min-w-16 items-center justify-center rounded-md border-2 border-foreground/80 px-1.5 text-sm font-extrabold tabular-nums', isFinished && 'border-emerald-600 text-emerald-700')}>
              {result.bib}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm">{result.autoTag}{tagText}</span>
              <span className="truncate text-xs text-muted-foreground tabular-nums">
                {result.video} · {formatVideoTime(result.at, true)}{readerTimeText}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
