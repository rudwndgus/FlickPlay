import { useEffect, useRef } from 'react'
import type { MiniGameModule } from '../games/types'
import { GameFeedItem } from './GameFeedItem'
import { getVisibleFeedIndex } from './feedIndex'

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
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollFrame = useRef<number | undefined>(undefined)
  const visibleIndex = useRef(props.currentIndex)
  const restored = useRef(false)

  useEffect(() => {
    const node = containerRef.current; if (!node || restored.current || !props.ready) return
    restored.current = true; requestAnimationFrame(() => node.scrollTo({ top: props.currentIndex * node.clientHeight }))
  }, [props.currentIndex, props.ready])

  useEffect(() => { visibleIndex.current = props.currentIndex }, [props.currentIndex])
  useEffect(() => () => { if (scrollFrame.current !== undefined) window.cancelAnimationFrame(scrollFrame.current) }, [])

  const onScroll = () => {
    if (scrollFrame.current !== undefined) return
    scrollFrame.current = window.requestAnimationFrame(() => {
      scrollFrame.current = undefined
      const node = containerRef.current; if (!node) return
      const index = getVisibleFeedIndex(node.scrollTop, node.clientHeight, props.games.length)
      if (index === visibleIndex.current) return
      visibleIndex.current = index; props.onIndexChange(index)
    })
  }

  return (
    <main className="feed" ref={containerRef} onScroll={onScroll} aria-label="게임 피드">
      {props.games.map((game, index) => (
        <GameFeedItem
          key={game.id} game={game} index={index} total={props.games.length}
          active={Math.abs(index - props.currentIndex) <= 1} current={index === props.currentIndex}
          liked={props.liked.has(game.id)} bookmarked={props.bookmarked.has(game.id)} muted={props.muted}
          bestScore={props.bestScores[game.id] ?? 0}
          onPlay={props.onPlay} onInfo={props.onInfo} onLike={props.onLike} onBookmark={props.onBookmark} onShare={props.onShare} onToggleMute={props.onToggleMute}
        />
      ))}
    </main>
  )
}
