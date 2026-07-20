export const getVisibleFeedIndex = (scrollTop: number, viewportHeight: number, gameCount: number) => {
  if (viewportHeight <= 0 || gameCount <= 0) return 0
  return Math.max(0, Math.min(gameCount - 1, Math.round(scrollTop / viewportHeight)))
}

export const getLoopedGameIndex = (renderIndex: number, gameCount: number) => {
  if (gameCount <= 0) return 0
  return ((renderIndex % gameCount) + gameCount) % gameCount
}

export const normalizeLoopScroll = (scrollTop: number, viewportHeight: number, gameCount: number) => {
  if (viewportHeight <= 0 || gameCount <= 0) return scrollTop
  const cycleHeight = viewportHeight * gameCount
  if (scrollTop < cycleHeight) return scrollTop + cycleHeight
  if (scrollTop >= cycleHeight * 2) return scrollTop - cycleHeight
  return scrollTop
}
