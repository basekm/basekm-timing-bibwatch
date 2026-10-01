'use client';

import {
  FormEvent,
  useState
} from 'react';

import {
  Button
} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Input
} from '@/components/ui/input';
import {
  Label
} from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption
} from '@/components/ui/native-select';

import {
  EventSettingsGetResponseDto,
  EventSettingsSaveRequestDto
} from '@basekm/dtos';

type BibNumbersDialogProps = {
  isOpen: boolean;
  eventSettings: EventSettingsGetResponseDto | null;
  isSaving: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (settings: EventSettingsSaveRequestDto) => void;
};

const DigitOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const toOptionalNumber = (text: string) => (text.trim() === '' ? null : Number(text));

const registeredNoteOf = (eventSettings: EventSettingsGetResponseDto) => {
  const registered = eventSettings.registered;

  if (registered.count) {
    return `registered.txt: ${registered.count} bibs (highest ${registered.highest}). With mixed lengths it tells a 5-digit bib from a 6-digit one with a digit hidden.`;
  }

  const folder = registered.file.replace(/\/registered\.txt$/, '');
  return `No participant list yet: put registered.txt (one bib per line) in ${folder}. It tells a 5-digit bib from a 6-digit one with a digit hidden.`;
};

const BibNumbersForm = ({
  eventSettings,
  isSaving,
  onCancel,
  onSave,
}: {
  eventSettings: EventSettingsGetResponseDto;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (settings: EventSettingsSaveRequestDto) => void;
}) => {
  const [minDigits, setMinDigits] = useState(String(eventSettings.minDigits));
  const [maxDigits, setMaxDigits] = useState(String(eventSettings.maxDigits));
  const [minBib, setMinBib] = useState(eventSettings.minBib === null ? '' : String(eventSettings.minBib));
  const [maxBib, setMaxBib] = useState(eventSettings.maxBib === null ? '' : String(eventSettings.maxBib));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({
      minDigits: Number(minDigits),
      maxDigits: Number(maxDigits),
      minBib: toOptionalNumber(minBib),
      maxBib: toOptionalNumber(maxBib),
    });
  };

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={handleSubmit}
    >
      <DialogHeader>
        <DialogTitle>Bib numbers at this event</DialogTitle>
        <DialogDescription>
          For every video in this folder. Races can mix lengths, e.g. 4-digit 5K bibs and 6-digit marathon bibs.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Fewest digits</Label>
          <NativeSelect
            className="w-full"
            value={minDigits}
            onChange={(event) => setMinDigits(event.target.value)}
          >
            {DigitOptions.map((digits) => (
              <NativeSelectOption
                key={digits}
                value={digits}
              >
                {digits}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Most digits</Label>
          <NativeSelect
            className="w-full"
            value={maxDigits}
            onChange={(event) => setMaxDigits(event.target.value)}
          >
            {DigitOptions.map((digits) => (
              <NativeSelectOption
                key={digits}
                value={digits}
              >
                {digits}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="bib-numbers-lowest"
            className="text-xs"
          >
            Lowest bib
          </Label>
          <Input
            id="bib-numbers-lowest"
            type="number"
            min={1}
            placeholder="1"
            value={minBib}
            onChange={(event) => setMinBib(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="bib-numbers-highest"
            className="text-xs"
          >
            Highest bib
          </Label>
          <Input
            id="bib-numbers-highest"
            type="number"
            min={1}
            placeholder="auto"
            value={maxBib}
            onChange={(event) => setMaxBib(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <p>{registeredNoteOf(eventSettings)}</p>
        <p>Videos scanned with other rules are read again from the start on their next scan.</p>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSaving}
        >
          Save
        </Button>
      </DialogFooter>
    </form>
  );
};

export const BibNumbersDialog = ({
  isOpen,
  eventSettings,
  isSaving,
  onOpenChange,
  onSave,
}: BibNumbersDialogProps) => {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-lg">
        {isOpen && eventSettings && (
          <BibNumbersForm
            eventSettings={eventSettings}
            isSaving={isSaving}
            onCancel={() => onOpenChange(false)}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
