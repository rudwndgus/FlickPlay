export const getVisibleFeedIndex = (scrollTop: number, viewportHeight: number, gameCount: number) => {
  if (viewportHeight <= 0 || gameCount <= 0) return 0
  return Math.max(0, Math.min(gameCount - 1, Math.round(scrollTop / viewportHeight)))
}
