'use client';

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  ScissorsIcon
} from 'lucide-react';

import {
  Button
} from '@/components/ui/button';

type MarkAndAnnotateBarProps = {
  isMarkingFinishLine: boolean;
  hasRunners: boolean;
  onPreviousRunner: () => void;
  onNextRunner: () => void;
  onMarkFinishLine: () => void;
  onSplitCameraPosition: () => void;
};

export const MarkAndAnnotateBar = ({
  isMarkingFinishLine,
  hasRunners,
  onPreviousRunner,
  onNextRunner,
  onMarkFinishLine,
  onSplitCameraPosition,
}: MarkAndAnnotateBarProps) => {
  const markLabel = isMarkingFinishLine ? 'Cancel marking' : 'Mark finish line';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="mr-auto text-base font-bold">Mark and annotate</h2>

      <Button
        variant="outline"
        className="rounded-full"
        title="Previous runner ( [ )"
        disabled={!hasRunners}
        onClick={onPreviousRunner}
      >
        <ChevronLeftIcon data-icon="inline-start" />
        Previous runner
      </Button>

      <Button
        variant="outline"
        className="rounded-full"
        title="Next runner ( ] )"
        disabled={!hasRunners}
        onClick={onNextRunner}
      >
        Next runner
        <ChevronRightIcon data-icon="inline-end" />
      </Button>

      <Button
        variant={isMarkingFinishLine ? 'secondary' : 'default'}
        className="rounded-full"
        title="M — click the two ends of the finish line’s near edge"
        onClick={onMarkFinishLine}
      >
        <MapPinIcon data-icon="inline-start" />
        {markLabel}
      </Button>

      <Button
        variant="outline"
        className="rounded-full"
        title="S — start a new camera position at the playhead (e.g. after the camera was bumped)"
        onClick={onSplitCameraPosition}
      >
        <ScissorsIcon data-icon="inline-start" />
        Split camera position here
      </Button>
    </div>
  );
};
