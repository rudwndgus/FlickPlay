import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppNavigation } from '../components/AppNavigation/AppNavigation'
import { AuthGate } from '../components/AuthGate/AuthGate'
import { MessagesScreen } from '../social/MessagesScreen'

describe('social app shell', () => {
  it('shows the four primary tabs and changes tabs', () => {
    const onChange = vi.fn()
    render(<AppNavigation activeTab="home" onChange={onChange} />)

    expect(screen.getAllByRole('button')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: '탐색' }))
    expect(onChange).toHaveBeenCalledWith('explore')
  })

  it('exposes an active explore tab as a refresh action', () => {
    const onChange = vi.fn()
    render(<AppNavigation activeTab="explore" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '탐색 새로고침' }))
    expect(onChange).toHaveBeenCalledWith('explore')
  })

  it('keeps browsing available when an authenticated action is requested', () => {
    const onClose = vi.fn()
    render(<AuthGate reason="메시지 보내기" onClose={onClose} />)

    expect(screen.getByRole('dialog')).toHaveTextContent('메시지 보내기')
    fireEvent.click(screen.getByRole('button', { name: '계속 둘러보기' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('opens a conversation with a single composer above the app navigation', () => {
    render(<MessagesScreen onRequireAuth={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Milo/ }))
    expect(screen.getByRole('main', { name: 'Milo님과의 대화' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeInTheDocument()
    expect(document.querySelectorAll('.message-composer')).toHaveLength(1)
  })
})
