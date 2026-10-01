'use client';

import {
  ChevronDownIcon,
  Columns3Icon,
  LayoutGridIcon,
  Rows3Icon
} from 'lucide-react';

import {
  Button
} from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

import {
  CameraLayout,
  CameraLayoutMode,
  layoutLabelOf,
  layoutOfValue,
  layoutValueOf,
  MaxLayoutCount
} from '../utils/cameraGridLayout';

type CameraLayoutMenuProps = {
  layout: CameraLayout;
  cameraCount: number;
  onLayoutChange: (layout: CameraLayout) => void;
};

type LayoutOptionsProps = {
  mode: CameraLayoutMode;
  counts: number[];
};

const LayoutIconByMode = {
  [CameraLayoutMode.Auto]: LayoutGridIcon,
  [CameraLayoutMode.Columns]: Columns3Icon,
  [CameraLayoutMode.Rows]: Rows3Icon,
};

const LayoutOptions = ({
  mode,
  counts,
}: LayoutOptionsProps) => {
  return counts.map((count) => {
    const layout = {
      mode,
      count,
    };

    return (
      <DropdownMenuRadioItem
        key={layoutValueOf(layout)}
        value={layoutValueOf(layout)}
      >
        {layoutLabelOf(layout)}
      </DropdownMenuRadioItem>
    );
  });
};

export const CameraLayoutMenu = ({
  layout,
  cameraCount,
  onLayoutChange,
}: CameraLayoutMenuProps) => {
  const LayoutIcon = LayoutIconByMode[layout.mode];
  const countLimit = Math.min(Math.max(cameraCount, 1), MaxLayoutCount);
  const counts = Array.from({
    length: countLimit,
  }, (_, index) => index + 1);
  const layoutLabel = layoutLabelOf(layout);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(
          <Button
            variant="outline"
            size="sm"
            className="font-bold"
            title="How the cameras are laid out"
          />
        )}
      >
        <LayoutIcon data-icon="inline-start" />
        <span className="hidden sm:inline">{layoutLabel}</span>
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-48"
      >
        <DropdownMenuRadioGroup
          value={layoutValueOf(layout)}
          onValueChange={(value: string) => onLayoutChange(layoutOfValue(value))}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Layout</DropdownMenuLabel>
            <DropdownMenuRadioItem value={CameraLayoutMode.Auto}>Auto (largest videos)</DropdownMenuRadioItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Columns</DropdownMenuLabel>
            <LayoutOptions
              mode={CameraLayoutMode.Columns}
              counts={counts}
            />
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Rows</DropdownMenuLabel>
            <LayoutOptions
              mode={CameraLayoutMode.Rows}
              counts={counts}
            />
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
