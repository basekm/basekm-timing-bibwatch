const TypicalSwipePixels = 300;
const OriginalSecondsPerPixel = 0.02;

export const swipeSecondsPerPixel = (speed: number) => 0.001 * Math.pow(100, speed / 100);

export const swipeBarFactor = (speed: number) => swipeSecondsPerPixel(speed) / OriginalSecondsPerPixel;

export const formatSwipeSpeed = (speed: number) => {
  const secondsPerSwipe = swipeSecondsPerPixel(speed) * TypicalSwipePixels;
  const rounded = secondsPerSwipe < 10 ? secondsPerSwipe.toFixed(1) : String(Math.round(secondsPerSwipe));
  return `≈ ${rounded} s/swipe`;
};
