'use client';

import {
  KeyboardEvent,
  useState
} from 'react';

import {
  CheckIcon,
  Trash2Icon
} from 'lucide-react';

import {
  Button
} from '@/components/ui/button';
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
  SightingDto
} from '@basekm/dtos';

type RunnerTagEditorProps = {
  sighting: SightingDto;
  myTags: string[];
  onToggleTag: (tag: string) => void;
  onRemove: () => void;
};

type TagOptionProps = {
  label: string;
  shortcut?: number;
  isOn: boolean;
  onClick: () => void;
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const TagOption = ({
  label,
  shortcut,
  isOn,
  onClick,
}: TagOptionProps) => (
  <button
    type="button"
    aria-pressed={isOn}
    className={cn(
      'flex h-10 w-full items-center gap-2.5 rounded-lg border bg-background px-3 text-left text-sm font-semibold transition-colors hover:bg-muted',
      isOn && 'border-blue-600 bg-blue-600/10 text-blue-800 hover:bg-blue-600/15',
    )}
    onClick={onClick}
  >
    {shortcut !== undefined && <Kbd className="h-5 min-w-5">{shortcut}</Kbd>}
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {isOn && <CheckIcon className="size-4 shrink-0 text-blue-600" />}
  </button>
);

const SectionLabel = ({
  children,
}: {
  children: string;
}) => <p className="text-xs font-semibold text-muted-foreground">{children}</p>;

export const RunnerTagEditor = ({
  sighting,
  myTags,
  onToggleTag,
  onRemove,
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
    const isAlreadyOn = myTags.includes(tag);
    if (tag && !isAlreadyOn) {
      onToggleTag(tag);
    }
    setCustomTag('');
  };

  return (
    <div className="mx-2 mb-2 flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
      {details && <SectionLabel>{details}</SectionLabel>}

      <div className="flex flex-col gap-1.5">
        {PresetTags.map((tag, index) => (
          <TagOption
            key={tag}
            label={capitalize(tag)}
            shortcut={index + 1}
            isOn={myTags.includes(tag)}
            onClick={() => onToggleTag(tag)}
          />
        ))}
      </div>

      {customTags.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Your tags</SectionLabel>
          {customTags.map((tag) => (
            <TagOption
              key={tag}
              label={tag}
              isOn
              onClick={() => onToggleTag(tag)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <SectionLabel>Add your own</SectionLabel>
        <Input
          value={customTag}
          placeholder="e.g. the correct bib number"
          className="h-10 bg-background"
          onChange={(event) => setCustomTag(event.target.value)}
          onKeyDown={handleCustomTagKeyDown}
        />
        <p className="text-xs text-muted-foreground">Press Enter to add</p>
      </div>

      {sighting.manual && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2Icon />
          Remove this runner
        </Button>
      )}
    </div>
  );
};
