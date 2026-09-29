'use client';

import {
  MouseEvent,
  RefObject,
  useEffect,
  useRef
} from 'react';

import {
  cn
} from '@/lib/utils';

import {
  FramePoint
} from '../hooks/useViewerSession';
import {
  contentRectOf,
  drawVideoOverlay,
  OverlayScene
} from '../utils/drawVideoOverlay';
import {
  VideoPlaybackController
} from '../utils/VideoPlaybackController';

type VideoOverlayCanvasProps = {
  controller: VideoPlaybackController;
  sceneRef: RefObject<OverlayScene>;
  isOverlayShown: boolean;
  isPicking: boolean;
  onFrameClick: (point: FramePoint) => void;
};

export const VideoOverlayCanvas = ({
  controller,
  sceneRef,
  isOverlayShown,
  isPicking,
  onFrameClick,
}: VideoOverlayCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    let frameId = 0;

    const draw = () => {
      const pixelRatio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const targetWidth = Math.round(width * pixelRatio);
      const targetHeight = Math.round(height * pixelRatio);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      if (isOverlayShown && controller.video?.src) {
        drawVideoOverlay({
          context,
          rect: contentRectOf({
            canvas,
            video: controller.video,
          }),
          scene: {
            ...sceneRef.current,
            swipeFlashUntil: controller.swipeFlashUntil,
          },
          time: controller.currentTime,
          previewTime: controller.previewTime,
        });
      }

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [controller, isOverlayShown, sceneRef]);

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = contentRectOf({
      canvas,
      video: controller.video,
    });
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left - rect.x) / rect.width;
    const y = (event.clientY - bounds.top - rect.y) / rect.height;
    const isInsidePicture = x >= 0 && x <= 1 && y >= 0 && y <= 1;

    if (!isInsidePicture) {
      return;
    }

    onFrameClick({
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
    });
  };

  return (
    <canvas
      ref={canvasRef}
      className={cn('absolute inset-0 size-full', isPicking && 'cursor-crosshair')}
      onClick={handleClick}
    />
  );
};
