import { useEffect, useMemo, useRef, useState } from 'react'
import type { MiniGameModule } from '../games/types'
import { GameFeedItem } from './GameFeedItem'
import { getLoopedGameIndex, getVisibleFeedIndex, normalizeLoopScroll } from './feedIndex'

interface Props {
  games: readonly MiniGameModule[]
  ready: boolean
  currentIndex: number
  liked: Set<string>
  bookmarked: Set<string>
  muted: boolean
  bestScores: Record<string, number>
  onIndexChange: (index: number) => void
  onPlay: (game: MiniGameModule) => void
  onInfo: (game: MiniGameModule) => void
  onLike: (id: string) => void
  onBookmark: (id: string) => void
  onShare: (game: MiniGameModule) => void
  onToggleMute: () => void
}

export function GameFeed(props: Props) {
  const gameCount = props.games.length
  const loopedGames = useMemo(() => [...props.games, ...props.games, ...props.games], [props.games])
  const initialRenderIndex = gameCount + getLoopedGameIndex(props.currentIndex, gameCount)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollFrame = useRef<number | undefined>(undefined)
  const visibleRenderIndex = useRef(initialRenderIndex)
  const visibleGameIndex = useRef(props.currentIndex)
  const restored = useRef(false)
  const [currentRenderIndex, setCurrentRenderIndex] = useState(initialRenderIndex)

  useEffect(() => {
    const node = containerRef.current
    if (!node || restored.current || !props.ready) return
    const renderIndex = gameCount + getLoopedGameIndex(props.currentIndex, gameCount)
    restored.current = true
    visibleRenderIndex.current = renderIndex
    setCurrentRenderIndex(renderIndex)
    requestAnimationFrame(() => node.scrollTo({ top: renderIndex * node.clientHeight }))
  }, [gameCount, props.currentIndex, props.ready])

  useEffect(() => { visibleGameIndex.current = props.currentIndex }, [props.currentIndex])
  useEffect(() => () => {
    if (scrollFrame.current !== undefined) window.cancelAnimationFrame(scrollFrame.current)
  }, [])

  const onScroll = () => {
    if (scrollFrame.current !== undefined) return
    scrollFrame.current = window.requestAnimationFrame(() => {
      scrollFrame.current = undefined
      const node = containerRef.current
      if (!node) return

      const scrollTop = normalizeLoopScroll(node.scrollTop, node.clientHeight, gameCount)
      if (scrollTop !== node.scrollTop) node.scrollTop = scrollTop

      const renderIndex = getVisibleFeedIndex(scrollTop, node.clientHeight, loopedGames.length)
      if (renderIndex !== visibleRenderIndex.current) {
        visibleRenderIndex.current = renderIndex
        setCurrentRenderIndex(renderIndex)
      }

      const gameIndex = getLoopedGameIndex(renderIndex, gameCount)
      if (gameIndex !== visibleGameIndex.current) {
        visibleGameIndex.current = gameIndex
        props.onIndexChange(gameIndex)
      }
    })
  }

  const mirroredRenderIndex = currentRenderIndex <= gameCount + 1
    ? currentRenderIndex + gameCount
    : currentRenderIndex >= gameCount * 2 - 2 ? currentRenderIndex - gameCount : -gameCount

  return (
    <main className="feed" ref={containerRef} onScroll={onScroll} aria-label="게임 피드">
      {loopedGames.map((game, renderIndex) => {
        const index = getLoopedGameIndex(renderIndex, gameCount)
        const active = Math.abs(renderIndex - currentRenderIndex) <= 1
          || Math.abs(renderIndex - mirroredRenderIndex) <= 1
        return (
          <GameFeedItem
            key={`${Math.floor(renderIndex / gameCount)}-${game.id}`} game={game} index={index} total={gameCount}
            active={active} current={renderIndex === currentRenderIndex}
            liked={props.liked.has(game.id)} bookmarked={props.bookmarked.has(game.id)} muted={props.muted}
            bestScore={props.bestScores[game.id] ?? 0}
            onPlay={props.onPlay} onInfo={props.onInfo} onLike={props.onLike} onBookmark={props.onBookmark} onShare={props.onShare} onToggleMute={props.onToggleMute}
          />
        )
      })}
    </main>
  )
}
