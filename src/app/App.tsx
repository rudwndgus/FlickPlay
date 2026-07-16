import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GameFeed } from '../feed/GameFeed'
import { gameRegistry } from '../games/registry'
import type { GameStats, MiniGameModule } from '../games/types'
import { GameInfoSheet } from '../components/GameInfoSheet/GameInfoSheet'
import { GamePlayer } from '../components/GamePlayer/GamePlayer'
import { UpdatePrompt } from '../components/UpdatePrompt/UpdatePrompt'
import { audioManager } from '../services/audio/AudioManager'
import { defaultState, loadState, saveState, type PersistedState } from '../services/storage/appStorage'

export function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [state, setState] = useState<PersistedState>(defaultState)
  const [ready, setReady] = useState(false)
  const [activeGame, setActiveGame] = useState<MiniGameModule | null>(null)
  const [infoGame, setInfoGame] = useState<MiniGameModule | null>(null)

  useEffect(() => { void loadState().then((loaded) => { setState(loaded); audioManager.setMuted(loaded.muted); setReady(true) }) }, [])
  useEffect(() => { if (ready) void saveState(state) }, [ready, state])
  useEffect(() => {
    const slug = location.pathname.match(/^\/game\/([^/]+)$/)?.[1]
    if (slug) setActiveGame(gameRegistry.find((game) => game.slug === slug) ?? null)
    else setActiveGame(null)
  }, [location.pathname])

  const liked = useMemo(() => new Set(state.liked), [state.liked])
  const bookmarked = useMemo(() => new Set(state.bookmarked), [state.bookmarked])
  const bestScores = useMemo(() => Object.fromEntries(Object.entries(state.stats).map(([id, stats]) => [id, stats.bestScore])), [state.stats])
  const toggleList = (key: 'liked' | 'bookmarked', id: string) => setState((current) => ({ ...current, [key]: current[key].includes(id) ? current[key].filter((item) => item !== id) : [...current[key], id] }))
  const toggleMute = () => setState((current) => { const muted = !current.muted; audioManager.setMuted(muted); if (!muted) audioManager.unlock(); return { ...current, muted } })
  const openGame = (game: MiniGameModule) => { setInfoGame(null); setActiveGame(game); audioManager.unlock(); navigate(`/game/${game.slug}`) }
  const closeGame = useCallback(() => navigate('/'), [navigate])

  const recordResult = (game: MiniGameModule, score: number, elapsedMs: number) => {
    setState((current) => {
      const previous = current.stats[game.id] ?? { gameId: game.id, bestScore: 0, lastScore: 0, playCount: 0, totalPlayTime: 0, lastPlayedAt: 0, achievements: {} }
      const stats: GameStats = { ...previous, bestScore: Math.max(previous.bestScore, score), lastScore: score, playCount: previous.playCount + 1, totalPlayTime: previous.totalPlayTime + Math.round(elapsedMs / 1000), lastPlayedAt: Date.now() }
      return { ...current, stats: { ...current.stats, [game.id]: stats } }
    })
  }

  const share = async (game: MiniGameModule) => {
    const data = { title: `${game.title} · FlickPlay!`, text: `${game.shortDescription} 내 기록에 도전해보세요!`, url: window.location.href }
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(window.location.href); window.alert('게임 링크를 복사했어요.') } } catch { /* user cancelled */ }
  }

  return (
    <div className={`app-shell ${activeGame ? 'game-is-open' : ''}`} data-ready={ready}>
      <GameFeed
        games={gameRegistry} ready={ready} currentIndex={state.feedIndex} liked={liked} bookmarked={bookmarked} muted={state.muted} bestScores={bestScores}
        onIndexChange={(feedIndex) => setState((current) => ({ ...current, feedIndex }))}
        onPlay={openGame} onInfo={setInfoGame} onLike={(id) => toggleList('liked', id)} onBookmark={(id) => toggleList('bookmarked', id)} onShare={(game) => void share(game)} onToggleMute={toggleMute}
      />
      {activeGame && <GamePlayer game={activeGame} bestScore={bestScores[activeGame.id] ?? 0} muted={state.muted} onBack={closeGame} onToggleMute={toggleMute} onFinish={(score, elapsed) => recordResult(activeGame, score, elapsed)} onShare={() => void share(activeGame)} />}
      <GameInfoSheet game={infoGame} bestScore={infoGame ? bestScores[infoGame.id] ?? 0 : 0} onClose={() => setInfoGame(null)} onPlay={openGame} />
      <UpdatePrompt />
    </div>
  )
}
