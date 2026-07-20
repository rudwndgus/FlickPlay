import type { MiniGameModule } from './types'

export const formatGameScore = (game: MiniGameModule, score: number) => `${score}${game.scoreSuffix ?? ''}`

export const isBetterGameScore = (game: MiniGameModule, score: number, bestScore: number) => {
  if (score <= 0) return false
  if (bestScore <= 0) return true
  return game.scoreDirection === 'low' ? score < bestScore : score > bestScore
}

export const selectBestGameScore = (game: MiniGameModule, bestScore: number, score: number) => (
  isBetterGameScore(game, score, bestScore) ? score : bestScore
)
