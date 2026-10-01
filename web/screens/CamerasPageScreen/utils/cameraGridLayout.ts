import {
  BestGrid
} from '../hooks/useBestGrid';

export const CameraLayoutMode = {
  Auto: 'auto',
  Columns: 'columns',
  Rows: 'rows',
} as const;

export type CameraLayoutMode = (typeof CameraLayoutMode)[keyof typeof CameraLayoutMode];

export type CameraLayout = {
  mode: CameraLayoutMode;
  count: number;
};

type GridForLayoutParams = {
  layout: CameraLayout;
  cameraCount: number;
  bestGrid: BestGrid;
};

export const MaxLayoutCount = 4;

export const AutoLayout: CameraLayout = {
  mode: CameraLayoutMode.Auto,
  count: 0,
};

export const layoutValueOf = (layout: CameraLayout) => {
  if (layout.mode === CameraLayoutMode.Auto) {
    return CameraLayoutMode.Auto;
  }

  return `${layout.mode}-${layout.count}`;
};

export const layoutOfValue = (value: string): CameraLayout => {
  const [mode, countText] = value.split('-');
  const count = Number(countText);
  const isFixedMode = mode === CameraLayoutMode.Columns || mode === CameraLayoutMode.Rows;
  const isValidCount = Number.isInteger(count) && count >= 1 && count <= MaxLayoutCount;

  if (!isFixedMode || !isValidCount) {
    return AutoLayout;
  }

  return {
    mode,
    count,
  };
};

export const layoutLabelOf = (layout: CameraLayout) => {
  if (layout.mode === CameraLayoutMode.Auto) {
    return 'Auto';
  }

  const unit = layout.mode === CameraLayoutMode.Columns ? 'column' : 'row';
  const plural = layout.count === 1 ? '' : 's';
  return `${layout.count} ${unit}${plural}`;
};

export const gridForLayout = ({
  layout,
  cameraCount,
  bestGrid,
}: GridForLayoutParams): BestGrid => {
  const count = Math.max(cameraCount, 1);
  const fixedCount = Math.min(layout.count, count);

  if (layout.mode === CameraLayoutMode.Columns) {
    return {
      columns: fixedCount,
      rows: Math.ceil(count / fixedCount),
    };
  }

  if (layout.mode === CameraLayoutMode.Rows) {
    return {
      columns: Math.ceil(count / fixedCount),
      rows: fixedCount,
    };
  }

  return bestGrid;
};
