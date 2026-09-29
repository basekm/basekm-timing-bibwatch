'use client';

import {
  KeyboardEvent,
  useState
} from 'react';

import {
  XIcon
} from 'lucide-react';

import {
  Input
} from '@/components/ui/input';
import {
  Kbd
} from '@/components/ui/kbd';
import {
  cn
} from '@/lib/utils';

import {
  PresetTags,
  RunnerZoneLabels
} from '@basekm/@shared/constants';
import {
  labelTag
} from '@basekm/@shared/utils/sightingTags';
import {
  SightingDto,
  TagsBySightingKey
} from '@basekm/dtos';

type RunnerTagEditorProps = {
  sighting: SightingDto;
  tags: TagsBySightingKey;
  myTags: string[];
  onToggleTag: (tag: string) => void;
};

export const RunnerTagEditor = ({
  sighting,
  tags,
  myTags,
  onToggleTag,
}: RunnerTagEditorProps) => {
  const [customTag, setCustomTag] = useState('');
  const customTags = myTags.filter((tag) => !PresetTags.includes(tag));
  const zoneLabel = sighting.zone ? RunnerZoneLabels[sighting.zone] ?? sighting.zone : null;
  const details = [zoneLabel, sighting.template, sighting.note].filter(Boolean).join(' · ');

  const handleCustomTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    const tag = customTag.trim().toLowerCase();
    if (tag) {
      onToggleTag(tag);
    }
    setCustomTag('');
  };

  return (
    <div className="mx-2 mb-2 flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
      {details && <p className="text-xs text-muted-foreground">{details}</p>}

      <div className="flex flex-wrap gap-1.5">
        {PresetTags.map((tag, index) => {
          const isOn = myTags.includes(tag);

          return (
            <button
              key={tag}
              type="button"
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border bg-background px-2.5 text-xs font-semibold transition-colors hover:bg-muted',
                isOn && 'border-blue-600 bg-blue-600 text-white hover:bg-blue-600/90',
              )}
              onClick={() => onToggleTag(tag)}
            >
              <Kbd className={cn('h-4 min-w-4', isOn && 'bg-white/20 text-white')}>{index + 1}</Kbd>
              {labelTag({
                tags,
                tag,
              })}
            </button>
          );
        })}

        {customTags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-full border border-blue-600 bg-blue-600 px-2.5 text-xs font-semibold text-white hover:bg-blue-600/90"
            onClick={() => onToggleTag(tag)}
          >
            {labelTag({
              tags,
              tag,
            })}
            <XIcon className="size-3" />
          </button>
        ))}
      </div>

      <Input
        value={customTag}
        placeholder="Add a tag… (Enter)"
        className="h-8 bg-background text-xs"
        onChange={(event) => setCustomTag(event.target.value)}
        onKeyDown={handleCustomTagKeyDown}
      />
    </div>
  );
};
