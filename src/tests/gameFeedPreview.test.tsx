import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import { getVisibleFeedIndex } from '../feed/feedIndex'
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
