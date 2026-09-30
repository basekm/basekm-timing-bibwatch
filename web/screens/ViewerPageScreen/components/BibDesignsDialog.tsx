'use client';

import {
  ChangeEvent,
  useRef
} from 'react';

import {
  CrosshairIcon,
  ImagePlusIcon,
  Trash2Icon
} from 'lucide-react';

import {
  Button
} from '@/components/ui/button';
import {
  Checkbox
} from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Label
} from '@/components/ui/label';

import {
  TemplateGetResponseDto
} from '@basekm/dtos';

type BibDesignsDialogProps = {
  isOpen: boolean;
  templates: TemplateGetResponseDto[];
  templateIdsInUse: string[];
  isPeopleFirst: boolean;
  isFinderShown: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onTemplateInUseChange: (params: { templateId: string; isInUse: boolean }) => void;
  onCalibrate: (template: TemplateGetResponseDto) => void;
  onRemove: (template: TemplateGetResponseDto) => void;
  onAddFromImage: (file: File) => void;
  onAddFromVideo: () => void;
  onFinderShownChange: (isShown: boolean) => void;
};

const calibrationTextOf = (template: TemplateGetResponseDto) => {
  if (!template.calibrated) {
    return 'not calibrated yet';
  }

  return `calibrated on ${template.calibrated}`;
};

export const BibDesignsDialog = ({
  isOpen,
  templates,
  templateIdsInUse,
  isPeopleFirst,
  isFinderShown,
  onOpenChange,
  onTemplateInUseChange,
  onCalibrate,
  onRemove,
  onAddFromImage,
  onAddFromVideo,
  onFinderShownChange,
}: BibDesignsDialogProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      onAddFromImage(file);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bib designs</DialogTitle>
          <DialogDescription>
            With designs ticked, a scan only reads numbers on those bibs — faster and far less noise from shirts and signs. Not needed for most races.
            {isPeopleFirst && ' While a design is ticked, “Only look for people” is off: the designs choose where to read.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          {templates.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No designs yet — add one from the bib artwork or from a bib in the video.
            </p>
          )}

          {templates.map((template) => {
            const isInUse = templateIdsInUse.includes(template.id);
            const swatchColor = template.hue === null ? 'var(--muted)' : `hsl(${template.hue}, 85%, 50%)`;

            return (
              <div
                key={template.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
              >
                <Checkbox
                  checked={isInUse}
                  aria-label={`Use ${template.name} in scans`}
                  onCheckedChange={(checked) => onTemplateInUseChange({
                    templateId: template.id,
                    isInUse: Boolean(checked),
                  })}
                />
                <span
                  className="size-4 shrink-0 rounded border"
                  style={{
                    background: swatchColor,
                  }}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">{template.name}</span>
                  <span className="text-xs text-muted-foreground">
                    bibs {template.minBib}–{template.maxBib ?? '…'} · {calibrationTextOf(template)}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  title="Click clear bibs of this design in the video to tune it"
                  onClick={() => onCalibrate(template)}
                >
                  Calibrate
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${template.name}`}
                  onClick={() => onRemove(template)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleImageChange}
          />
          <Button
            variant="outline"
            onClick={() => imageInputRef.current?.click()}
          >
            <ImagePlusIcon data-icon="inline-start" />
            From design image
          </Button>
          <Button
            variant="outline"
            title="Then click the number of a clear bib in the video"
            onClick={onAddFromVideo}
          >
            <CrosshairIcon data-icon="inline-start" />
            From a bib in the video
          </Button>
        </div>

        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={isFinderShown}
            onCheckedChange={(checked) => onFinderShownChange(Boolean(checked))}
          />
          Show what the designs find (when paused)
        </Label>
      </DialogContent>
    </Dialog>
  );
};
