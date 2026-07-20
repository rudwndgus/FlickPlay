export function shuffleGames<T>(games: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...games]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}

export function refreshGameOrder<T>(games: readonly T[], currentGame: T | undefined, random: () => number = Math.random): T[] {
  const shuffled = shuffleGames(games, random)
  if (shuffled.length > 1 && shuffled[0] === currentGame) {
    ;[shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]]
  }
  return shuffled
}
