import {
  OverlayColors
} from '@basekm/@shared/constants';
import {
  CameraSegmentKind
} from '@basekm/@shared/utils/cameraSegments';
import {
  formatClockTime,
  formatVideoTime
} from '@basekm/@shared/utils/formatTime';
import {
  nearestFrame,
  segmentAt
} from '@basekm/@shared/utils/frameGeometry';
import {
  Box,
  CameraSegmentDto,
  DetectionFrameDto,
  SightingDto,
  TemplateFinderResponseDto,
  TemplateGetResponseDto
} from '@basekm/dtos';

import {
  BibDesignPickMode,
  BibDesignPicking
} from '../hooks/useBibDesigns';
import {
  FramePoint
} from '../hooks/useViewerSession';

export type OverlayScene = {
  frames: DetectionFrameDto[];
  segments: CameraSegmentDto[];
  sightings: SightingDto[];
  crossedBibs: Set<string>;
  targets: Set<string>;
  isPeopleShown: boolean;
  isBibsShown: boolean;
  isEveryBibShown: boolean;
  finishLinePoints: FramePoint[] | null;
  picking: BibDesignPicking | null;
  finder: (TemplateFinderResponseDto & { t: number }) | null;
  templates: TemplateGetResponseDto[];
  clockOffset: number | null;
  swipeFlashUntil: number;
};

export type ContentRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const SansFont = 'Mulish, ui-sans-serif, system-ui, sans-serif';

export const contentRectOf = ({
  canvas,
  video,
}: {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement | null;
}): ContentRect => {
  const canvasWidth = canvas.clientWidth;
  const canvasHeight = canvas.clientHeight;
  const videoWidth = video?.videoWidth || 16;
  const videoHeight = video?.videoHeight || 9;
  const scale = Math.min(canvasWidth / videoWidth, canvasHeight / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;

  return {
    x: (canvasWidth - width) / 2,
    y: (canvasHeight - height) / 2,
    width,
    height,
  };
};

const toPixels = (rect: ContentRect, fractionX: number, fractionY: number) => [rect.x + fractionX * rect.width, rect.y + fractionY * rect.height];

const drawPill = ({
  context,
  text,
  centerX,
  centerY,
  background,
  foreground = '#ffffff',
  fontSize = 13,
  isItalic = false,
}: {
  context: CanvasRenderingContext2D;
  text: string;
  centerX: number;
  centerY: number;
  background: string;
  foreground?: string;
  fontSize?: number;
  isItalic?: boolean;
}) => {
  context.font = `${isItalic ? 'italic ' : ''}800 ${fontSize}px ${SansFont}`;
  const width = context.measureText(text).width + fontSize;
  const height = fontSize + 10;
  const left = centerX - width / 2;
  const top = centerY - height / 2;

  context.fillStyle = background;
  context.beginPath();
  context.roundRect(left, top, width, height, 5);
  context.fill();

  context.fillStyle = foreground;
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.fillText(text, centerX, centerY + 0.5);
};

const drawBox = ({
  context,
  rect,
  box,
}: {
  context: CanvasRenderingContext2D;
  rect: ContentRect;
  box: Box;
}) => {
  const [left, top] = toPixels(rect, box[0], box[1]);
  const [right, bottom] = toPixels(rect, box[2], box[3]);
  context.strokeRect(left, top, right - left, bottom - top);
};

const bibColorOf = ({
  isTarget,
  isCrossed,
}: {
  isTarget: boolean;
  isCrossed: boolean;
}) => {
  if (isTarget) {
    return OverlayColors.Watchlist;
  }

  if (isCrossed) {
    return OverlayColors.Finished;
  }

  return OverlayColors.Bib;
};

const readerSuffix = (clockOffset: number | null, time: number) => (clockOffset === null ? '' : ` · ${formatClockTime(clockOffset + time)}`);

export const drawVideoOverlay = ({
  context,
  rect,
  scene,
  time,
  previewTime,
}: {
  context: CanvasRenderingContext2D;
  rect: ContentRect;
  scene: OverlayScene;
  time: number;
  previewTime: number | null;
}) => {
  const segment = segmentAt({
    segments: scene.segments,
    time,
  });

  if (segment && segment.kind === CameraSegmentKind.Fixed && segment.mat) {
    const [startX, startY] = toPixels(rect, segment.mat.x0, segment.mat.y0);
    const [endX, endY] = toPixels(rect, segment.mat.x1, segment.mat.y1);
    context.save();
    context.setLineDash([12, 8]);
    context.lineWidth = 3;
    context.strokeStyle = OverlayColors.FinishLine;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    context.restore();
  }

  const frame = nearestFrame({
    frames: scene.frames,
    time,
  });

  if (frame?.people && scene.isPeopleShown) {
    context.lineWidth = 1;
    context.strokeStyle = OverlayColors.Person;
    frame.people.forEach((person) => drawBox({
      context,
      rect,
      box: person,
    }));
  }

  if (frame && scene.isBibsShown) {
    frame.bibs.forEach((read) => {
      const isTarget = scene.targets.has(read.bib);
      const isCrossed = scene.crossedBibs.has(read.bib);
      const isHidden = !scene.isEveryBibShown && !isTarget && !isCrossed;

      if (isHidden) {
        return;
      }

      const [centerX, centerY] = toPixels(rect, (read.box[0] + read.box[2]) / 2, (read.box[1] + read.box[3]) / 2);
      const uncertainSuffix = read.confidence < 0.5 ? ' ?' : '';
      drawPill({
        context,
        text: `${read.bib}${uncertainSuffix}`,
        centerX,
        centerY,
        background: bibColorOf({
          isTarget,
          isCrossed,
        }),
        isItalic: true,
      });
    });
  }

  const finishing = scene.sightings.filter((sighting) => sighting.cross !== null && time >= sighting.cross - 0.2 && time <= sighting.cross + 1.5);
  finishing.forEach((sighting, index) => {
    const crossTime = sighting.cross as number;
    drawPill({
      context,
      text: `${sighting.bib} finished · ${formatVideoTime(crossTime, true)}${readerSuffix(scene.clockOffset, crossTime)}`,
      centerX: rect.x + rect.width / 2,
      centerY: rect.y + 72 + index * 34,
      background: sighting.target ? OverlayColors.Watchlist : OverlayColors.Finished,
      fontSize: 15,
    });
  });

  if (scene.swipeFlashUntil > performance.now()) {
    const shownTime = previewTime ?? time;
    drawPill({
      context,
      text: `⟷ ${formatVideoTime(shownTime, true)}${readerSuffix(scene.clockOffset, shownTime)}`,
      centerX: rect.x + rect.width / 2,
      centerY: rect.y + rect.height / 2,
      background: OverlayColors.Shade,
      fontSize: 18,
    });
  }

  const isFinderFrame = scene.finder !== null && Math.abs(scene.finder.t - time) < 0.05;
  if (isFinderFrame && scene.finder) {
    context.save();
    context.setLineDash([6, 4]);
    context.lineWidth = 2;
    scene.finder.candidates.forEach((candidate) => {
      const template = scene.templates.find((item) => item.name === candidate.template);
      context.strokeStyle = template?.hue !== null && template?.hue !== undefined ? `hsl(${template.hue}, 90%, 60%)` : OverlayColors.FinishLine;
      drawBox({
        context,
        rect,
        box: candidate.box,
      });
    });
    context.restore();

    scene.finder.reads.forEach((read) => {
      const [left, top] = toPixels(rect, read.box[0], read.box[1]);
      drawPill({
        context,
        text: `${read.bib} · ${read.template}`,
        centerX: left + 40,
        centerY: top - 14,
        background: OverlayColors.Shade,
        fontSize: 12,
      });
    });
  }

  if (scene.picking) {
    const pickingPrompt = scene.picking.mode === BibDesignPickMode.New
      ? 'Click the number of a clear bib of the new design'
      : `Click the number of a clear ${scene.picking.name} bib · Esc when done`;
    drawPill({
      context,
      text: pickingPrompt,
      centerX: rect.x + rect.width / 2,
      centerY: rect.y + 36,
      background: OverlayColors.FinishLine,
      foreground: '#111827',
      fontSize: 15,
    });
  }

  if (scene.finishLinePoints) {
    const markingPrompt = scene.finishLinePoints.length ? 'Click the other end of the finish line' : 'Click one end of the finish line’s near edge';
    drawPill({
      context,
      text: markingPrompt,
      centerX: rect.x + rect.width / 2,
      centerY: rect.y + 36,
      background: OverlayColors.FinishLine,
      foreground: '#111827',
      fontSize: 15,
    });

    context.fillStyle = OverlayColors.FinishLine;
    scene.finishLinePoints.forEach((point) => {
      const [pointX, pointY] = toPixels(rect, point.x, point.y);
      context.beginPath();
      context.arc(pointX, pointY, 6, 0, Math.PI * 2);
      context.fill();
    });
  }
};
