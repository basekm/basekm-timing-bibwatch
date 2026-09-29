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
  BibDesignDetails
} from '../hooks/useBibDesigns';

type BibDesignDetailsDialogProps = {
  isOpen: boolean;
  defaultMaxBib: number;
  onCancel: () => void;
  onSave: (details: BibDesignDetails) => void;
};

const BibDesignDetailsForm = ({
  defaultMaxBib,
  onCancel,
  onSave,
}: {
  defaultMaxBib: number;
  onCancel: () => void;
  onSave: (details: BibDesignDetails) => void;
}) => {
  const [name, setName] = useState('');
  const [minBib, setMinBib] = useState('1');
  const [maxBib, setMaxBib] = useState(String(defaultMaxBib));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    onSave({
      name: name.trim(),
      minBib: Number(minBib) || 1,
      maxBib: Number(maxBib) || defaultMaxBib,
    });
  };

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={handleSubmit}
    >
      <DialogHeader>
        <DialogTitle>New bib design</DialogTitle>
        <DialogDescription>Name it after the race it is used for, and give the bib numbers printed on it.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="bib-design-name"
          className="text-xs"
        >
          Name
        </Label>
        <Input
          id="bib-design-name"
          autoFocus
          placeholder="5K pink"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="bib-design-from"
            className="text-xs"
          >
            From bib
          </Label>
          <Input
            id="bib-design-from"
            type="number"
            min={1}
            value={minBib}
            onChange={(event) => setMinBib(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="bib-design-to"
            className="text-xs"
          >
            To bib
          </Label>
          <Input
            id="bib-design-to"
            type="number"
            min={1}
            value={maxBib}
            onChange={(event) => setMaxBib(event.target.value)}
          />
        </div>
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
          disabled={!name.trim()}
        >
          Add design
        </Button>
      </DialogFooter>
    </form>
  );
};

export const BibDesignDetailsDialog = ({
  isOpen,
  defaultMaxBib,
  onCancel,
  onSave,
}: BibDesignDetailsDialogProps) => {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isNowOpen) => {
        if (!isNowOpen) {
          onCancel();
        }
      }}
    >
      <DialogContent>
        {isOpen && (
          <BibDesignDetailsForm
            defaultMaxBib={defaultMaxBib}
            onCancel={onCancel}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
