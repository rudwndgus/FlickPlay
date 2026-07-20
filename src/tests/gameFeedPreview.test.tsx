import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import { getLoopedGameIndex, getVisibleFeedIndex, normalizeLoopScroll } from '../feed/feedIndex'
import { GameFeed } from '../feed/GameFeed'
import { GameFeedItem } from '../feed/GameFeedItem'

vi.mock('../components/GameCanvas/GameCanvas', () => ({
  GameCanvas: ({ game, preview, paused }: { game: { id: string }; preview: boolean; paused: boolean }) => (
    <div data-testid="preview-canvas" data-game={game.id} data-preview={String(preview)} data-paused={String(paused)} />
  ),
}))

const callbacks = {
  onPlay: vi.fn(), onInfo: vi.fn(), onLike: vi.fn(), onBookmark: vi.fn(), onShare: vi.fn(), onToggleMute: vi.fn(),
}

afterEach(cleanup)

describe('game feed preview preloading', () => {
  it('switches the active preview as soon as the next item becomes dominant', () => {
    expect(getVisibleFeedIndex(399, 800, 8)).toBe(0)
    expect(getVisibleFeedIndex(401, 800, 8)).toBe(1)
    expect(getVisibleFeedIndex(99999, 800, 8)).toBe(7)
  })

  it('recycles feed sections without changing the visible game', () => {
    const height = 800
    const gameCount = 8

    expect(normalizeLoopScroll(16 * height, height, gameCount)).toBe(8 * height)
    expect(normalizeLoopScroll(8 * height - 1, height, gameCount)).toBe(16 * height - 1)
    expect(getLoopedGameIndex(16, gameCount)).toBe(0)
    expect(getLoopedGameIndex(7, gameCount)).toBe(7)
  })

  it('keeps a fixed three-section loop and only prepares nearby previews', () => {
    const { container } = render(
      <GameFeed
        games={gameRegistry} ready={false} currentIndex={0} liked={new Set()} bookmarked={new Set()}
        muted bestScores={{}} onIndexChange={vi.fn()} {...callbacks}
      />,
    )

    expect(container.querySelectorAll('.feed-item')).toHaveLength(gameRegistry.length * 3)
    expect(screen.getAllByTestId('preview-canvas')).toHaveLength(6)
  })

  it('mounts an adjacent preview in a paused ready state and resumes it when current', () => {
    const game = gameRegistry[1]
    const { rerender } = render(<GameFeedItem game={game} index={1} total={8} active current={false} liked={false} bookmarked={false} muted bestScore={0} {...callbacks} />)

    expect(screen.getByTestId('preview-canvas')).toHaveAttribute('data-game', game.id)
    expect(screen.getByTestId('preview-canvas')).toHaveAttribute('data-preview', 'true')
    expect(screen.getByTestId('preview-canvas')).toHaveAttribute('data-paused', 'true')

    rerender(<GameFeedItem game={game} index={1} total={8} active current liked={false} bookmarked={false} muted bestScore={0} {...callbacks} />)
    expect(screen.getByTestId('preview-canvas')).toHaveAttribute('data-paused', 'false')
  })

  it('keeps distant games as lightweight placeholders', () => {
    render(<GameFeedItem game={gameRegistry[4]} index={4} total={8} active={false} current={false} liked={false} bookmarked={false} muted bestScore={0} {...callbacks} />)
    expect(screen.queryByTestId('preview-canvas')).not.toBeInTheDocument()
    expect(document.querySelector('.preview-placeholder')).toBeInTheDocument()
  })
})
