import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GameFeed } from '../feed/GameFeed'
import { shuffleGames } from '../feed/shuffleGames'
import { gameRegistry } from '../games/registry'
import type { GameStats, MiniGameModule } from '../games/types'
import { selectBestGameScore } from '../games/scoring'
import { GameInfoSheet } from '../components/GameInfoSheet/GameInfoSheet'
import { GamePlayer } from '../components/GamePlayer/GamePlayer'
import { UpdatePrompt } from '../components/UpdatePrompt/UpdatePrompt'
import { AppNavigation, type AppTab } from '../components/AppNavigation/AppNavigation'
import { AuthGate } from '../components/AuthGate/AuthGate'
import { audioManager } from '../services/audio/AudioManager'
import { defaultState, loadState, saveState, type PersistedState } from '../services/storage/appStorage'
import { HomeScreen } from '../social/HomeScreen'
import { MessagesScreen } from '../social/MessagesScreen'
import { ProfileScreen } from '../social/ProfileScreen'

export function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [state, setState] = useState<PersistedState>(defaultState)
  const [ready, setReady] = useState(false)
  const [activeGame, setActiveGame] = useState<MiniGameModule | null>(null)
  const [infoGame, setInfoGame] = useState<MiniGameModule | null>(null)
  const [authReason, setAuthReason] = useState<string | null>(null)
  const randomizedGames = useMemo(() => shuffleGames(gameRegistry), [])

  useEffect(() => { void loadState().then((loaded) => { setState(loaded); audioManager.setMuted(loaded.muted); setReady(true) }) }, [])
  useEffect(() => { if (ready) void saveState(state) }, [ready, state])
  useEffect(() => {
    const slug = location.pathname.match(/^\/game\/([^/]+)$/)?.[1]
    if (slug) setActiveGame(gameRegistry.find((game) => game.slug === slug) ?? null)
    else setActiveGame(null)
  }, [location.pathname])

  const liked = useMemo(() => new Set(state.liked), [state.liked])
  const bookmarked = useMemo(() => new Set(state.bookmarked), [state.bookmarked])
  const bestScores = useMemo(() => Object.fromEntries(Object.entries(state.stats).map(([id, stats]) => {
    const game = gameRegistry.find((item) => item.id === id)
    const legacyLowScore = game?.scoreDirection === 'low' && stats.achievements.lowScoreFormat !== true
    return [id, legacyLowScore ? 0 : stats.bestScore]
  })), [state.stats])
  const toggleMute = () => setState((current) => { const muted = !current.muted; audioManager.setMuted(muted); if (!muted) audioManager.unlock(); return { ...current, muted } })
  const openGame = (game: MiniGameModule) => { setInfoGame(null); setActiveGame(game); audioManager.unlock(); navigate(`/game/${game.slug}`) }
  const closeGame = useCallback(() => navigate('/explore'), [navigate])

  const activeTab: AppTab = location.pathname.startsWith('/messages') ? 'messages'
    : location.pathname.startsWith('/profile') ? 'profile'
      : location.pathname.startsWith('/explore') || location.pathname.startsWith('/game/') ? 'explore'
        : 'home'
  const changeTab = (tab: AppTab) => {
    setInfoGame(null)
    navigate(tab === 'home' ? '/' : `/${tab}`)
  }

  const recordResult = (game: MiniGameModule, score: number, elapsedMs: number) => {
    setState((current) => {
      const previous = current.stats[game.id] ?? { gameId: game.id, bestScore: 0, lastScore: 0, playCount: 0, totalPlayTime: 0, lastPlayedAt: 0, achievements: {} }
      const previousBest = game.scoreDirection === 'low' && previous.achievements.lowScoreFormat !== true ? 0 : previous.bestScore
      const achievements = game.scoreDirection === 'low' ? { ...previous.achievements, lowScoreFormat: true } : previous.achievements
      const stats: GameStats = { ...previous, achievements, bestScore: selectBestGameScore(game, previousBest, score), lastScore: score, playCount: previous.playCount + 1, totalPlayTime: previous.totalPlayTime + Math.round(elapsedMs / 1000), lastPlayedAt: Date.now() }
      return { ...current, stats: { ...current.stats, [game.id]: stats } }
    })
  }

  const share = async (game: MiniGameModule) => {
    const data = { title: `${game.title} · Flicko`, text: `${game.shortDescription} 내 기록에 도전해보세요!`, url: window.location.href }
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(window.location.href); window.alert('게임 링크를 복사했어요.') } } catch { /* user cancelled */ }
  }

  return (
    <div className={`app-shell tab-${activeTab} ${activeGame ? 'game-is-open' : ''}`} data-ready={ready}>
      {activeTab === 'home' && <HomeScreen onPlay={openGame} onExplore={() => changeTab('explore')} onRequireAuth={setAuthReason} onShare={(game) => void share(game)} />}
      {activeTab === 'explore' && <GameFeed
          games={randomizedGames} ready={ready} currentIndex={state.feedIndex} liked={liked} bookmarked={bookmarked} muted={state.muted} bestScores={bestScores}
          onIndexChange={(feedIndex) => setState((current) => ({ ...current, feedIndex }))}
          onPlay={openGame} onInfo={setInfoGame} onLike={() => setAuthReason('좋아요')} onBookmark={() => setAuthReason('게임 저장')} onShare={(game) => void share(game)} onToggleMute={toggleMute}
        />}
      {activeTab === 'messages' && <MessagesScreen onRequireAuth={setAuthReason} />}
      {activeTab === 'profile' && <ProfileScreen stats={state.stats} bookmarked={bookmarked} onRequireAuth={setAuthReason} />}
      {!activeGame && <AppNavigation activeTab={activeTab} onChange={changeTab} />}
      {activeGame && <GamePlayer game={activeGame} bestScore={bestScores[activeGame.id] ?? 0} muted={state.muted} onBack={closeGame} onToggleMute={toggleMute} onFinish={(score, elapsed) => recordResult(activeGame, score, elapsed)} onShare={() => void share(activeGame)} />}
      <GameInfoSheet game={infoGame} bestScore={infoGame ? bestScores[infoGame.id] ?? 0 : 0} onClose={() => setInfoGame(null)} onPlay={openGame} />
      <AuthGate reason={authReason} onClose={() => setAuthReason(null)} />
      <UpdatePrompt />
    </div>
  )
}
