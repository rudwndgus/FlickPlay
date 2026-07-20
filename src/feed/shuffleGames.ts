export function shuffleGames<T>(games: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...games]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}
