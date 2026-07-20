import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GamePlayer } from '../components/GamePlayer/GamePlayer'
import { gameById } from '../games/gameDefinitions'

vi.mock('../components/GameCanvas/GameCanvas', () => ({
  GameCanvas: ({ onScore }: { onScore?: (score: number) => void }) => <button onClick={() => onScore?.(245)}>simulate height</button>,
}))

const callbacks = () => ({ onBack: vi.fn(), onToggleMute: vi.fn(), onFinish: vi.fn(), onShare: vi.fn() })

afterEach(cleanup)

describe('game player exit records', () => {
  it('saves AXEBOUND height when leaving without restoring the world position', () => {
    const game = gameById('axebound')!, handlers = callbacks()
    render(<GamePlayer game={game} bestScore={0} muted {...handlers} />)

    fireEvent.click(screen.getByRole('button', { name: 'simulate height' }))
    fireEvent.click(screen.getByRole('button', { name: '피드로 돌아가기' }))

    expect(handlers.onFinish).toHaveBeenCalledWith(245, expect.any(Number))
    expect(handlers.onBack).toHaveBeenCalledOnce()
  })

  it('does not turn an early exit into a result for other games', () => {
    const game = gameById('hoop-flight')!, handlers = callbacks()
    render(<GamePlayer game={game} bestScore={0} muted {...handlers} />)

    fireEvent.click(screen.getByRole('button', { name: 'simulate height' }))
    fireEvent.click(screen.getByRole('button', { name: '피드로 돌아가기' }))

    expect(handlers.onFinish).not.toHaveBeenCalled()
    expect(handlers.onBack).toHaveBeenCalledOnce()
  })
})
