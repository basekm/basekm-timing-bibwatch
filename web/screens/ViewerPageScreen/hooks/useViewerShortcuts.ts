import {
  useEffect,
  useLayoutEffect,
  useRef
} from 'react';

import {
  PlaybackRates,
  PresetTags
} from '@basekm/@shared/constants';

import {
  VideoPlaybackController
} from '../utils/VideoPlaybackController';

type ViewerShortcutActions = {
  onPreviousRunner: () => void;
  onNextRunner: () => void;
  onToggleFinishLineMarking: () => void;
  onSplitCameraPosition: () => void;
  onToggleTag: (tag: string) => void;
  onEscape: () => void;
};

const ShuttleRates = [1, 2, 4];

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const isTextInput = target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'checkbox';
  return isTextInput || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
};

const isDialogOpen = () => document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;

export const useViewerShortcuts = ({
  controller,
  actions,
}: {
  controller: VideoPlaybackController;
  actions: ViewerShortcutActions;
}) => {
  const actionsRef = useRef(actions);

  useLayoutEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        actionsRef.current.onEscape();
        return;
      }

      if (event.metaKey || event.ctrlKey || isTypingTarget(event.target) || isDialogOpen()) {
        return;
      }

      const key = event.key.toLowerCase();
      const current = actionsRef.current;

      if (event.key === ' ') {
        event.preventDefault();
        controller.togglePlay();
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        controller.step(direction * (event.shiftKey ? 1 : 0.1));
        return;
      }

      if (event.key === '[') {
        current.onPreviousRunner();
        return;
      }

      if (event.key === ']') {
        current.onNextRunner();
        return;
      }

      if (/^[1-4]$/.test(event.key)) {
        current.onToggleTag(PresetTags[Number(event.key) - 1]);
        return;
      }

      if (key === 'm') {
        current.onToggleFinishLineMarking();
        return;
      }

      if (key === 's') {
        current.onSplitCameraPosition();
        return;
      }

      if (key === 'l') {
        const video = controller.video;
        const nextRate = video && !video.paused
          ? ShuttleRates[Math.min(ShuttleRates.indexOf(video.playbackRate) + 1, ShuttleRates.length - 1)] ?? 1
          : 1;
        controller.setPlaybackRate(PlaybackRates.includes(nextRate) ? nextRate : 1);
        controller.play();
        return;
      }

      if (key === 'k') {
        controller.pause();
        controller.setPlaybackRate(1);
        return;
      }

      if (key === 'j') {
        controller.step(-1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [controller]);
};
