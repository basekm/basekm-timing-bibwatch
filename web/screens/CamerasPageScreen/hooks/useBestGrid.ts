import {
  RefObject,
  useLayoutEffect,
  useState
} from 'react';

type BestGridParams = {
  containerRef: RefObject<HTMLElement | null>;
  count: number;
  gapPx: number;
  aspectRatio?: number;
};

export type BestGrid = {
  columns: number;
  rows: number;
};

export const bestGridFor = ({
  width,
  height,
  count,
  gapPx,
  aspectRatio = 16 / 9,
}: {
  width: number;
  height: number;
  count: number;
  gapPx: number;
  aspectRatio?: number;
}): BestGrid => {
  let best: BestGrid = {
    columns: 1,
    rows: Math.max(count, 1),
  };
  let bestTileWidth = 0;

  for (let columns = 1; columns <= Math.max(count, 1); columns += 1) {
    const rows = Math.ceil(count / columns);
    const cellWidth = (width - gapPx * (columns - 1)) / columns;
    const cellHeight = (height - gapPx * (rows - 1)) / rows;
    const tileWidth = Math.min(cellWidth, cellHeight * aspectRatio);

    if (tileWidth > bestTileWidth) {
      bestTileWidth = tileWidth;
      best = {
        columns,
        rows,
      };
    }
  }

  return best;
};

export const useBestGrid = ({
  containerRef,
  count,
  gapPx,
  aspectRatio,
}: BestGridParams) => {
  const [grid, setGrid] = useState<BestGrid>({
    columns: Math.min(count, 2) || 1,
    rows: Math.ceil(count / 2) || 1,
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const update = () => {
      const next = bestGridFor({
        width: container.clientWidth,
        height: container.clientHeight,
        count,
        gapPx,
        aspectRatio,
      });
      setGrid((previous) => (
        previous.columns === next.columns && previous.rows === next.rows ? previous : next
      ));
    };

    const observer = new ResizeObserver(update);
    observer.observe(container);
    update();

    return () => {
      observer.disconnect();
    };
  }, [aspectRatio, containerRef, count, gapPx]);

  return grid;
};
