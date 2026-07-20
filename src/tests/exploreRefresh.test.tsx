import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../app/App'

vi.mock('../feed/GameFeed', () => ({
  GameFeed: ({ games, currentIndex }: { games: { id: string }[]; currentIndex: number }) => (
    <div data-testid="game-feed" data-index={currentIndex}>{games[0]?.id}</div>
  ),
}))

vi.mock('../components/UpdatePrompt/UpdatePrompt', () => ({ UpdatePrompt: () => null }))

vi.mock('../services/storage/appStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/storage/appStorage')>()
  return {
    ...actual,
    loadState: vi.fn().mockResolvedValue(actual.defaultState),
    saveState: vi.fn().mockResolvedValue(undefined),
  }
})

describe('active explore tab refresh', () => {
  it('reshuffles the feed and returns it to the first game', () => {
    render(<MemoryRouter initialEntries={['/explore']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></MemoryRouter>)
    const firstGame = screen.getByTestId('game-feed').textContent

    fireEvent.click(screen.getByRole('button', { name: '탐색 새로고침' }))

    expect(screen.getByTestId('game-feed')).toHaveAttribute('data-index', '0')
    expect(screen.getByTestId('game-feed').textContent).not.toBe(firstGame)
  })
})
