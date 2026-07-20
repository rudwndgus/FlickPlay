import { Bookmark, Grid3X3, LogIn, Settings, Trophy } from 'lucide-react'
import { gameById } from '../games/gameDefinitions'
import type { GameStats } from '../games/types'

interface Props {
  stats: Record<string, GameStats>
  bookmarked: Set<string>
  onRequireAuth: (reason: string) => void
}

export function ProfileScreen({ stats, bookmarked, onRequireAuth }: Props) {
  const played = Object.values(stats).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
  const totalPlays = played.reduce((sum, item) => sum + item.playCount, 0)
  const bestTotal = played.reduce((sum, item) => sum + item.bestScore, 0)

  return (
    <main className="social-screen profile-screen" aria-label="프로필">
      <header className="social-header">
        <div><small>PLAYER PROFILE</small><h1>프로필</h1></div>
        <button className="social-header-action" onClick={() => onRequireAuth('설정')} aria-label="설정"><Settings size={21} /></button>
      </header>
      <section className="profile-identity">
        <div className="profile-avatar">P<span>GUEST</span></div>
        <div className="profile-name"><h2>플레이어 001</h2><p>@guest_player</p></div>
        <button onClick={() => onRequireAuth('프로필 만들기')}><LogIn size={17} /> 로그인</button>
      </section>
      <p className="profile-bio">오늘의 재미를 발견하고, 최고 기록에 도전하는 중. 🎮</p>
      <div className="profile-stats">
        <div><strong>{totalPlays}</strong><span>플레이</span></div>
        <div><strong>{bestTotal}</strong><span>기록 합계</span></div>
        <div><strong>{bookmarked.size}</strong><span>저장 게임</span></div>
      </div>
      <button className="profile-sync" onClick={() => onRequireAuth('기록 동기화')}><span><Trophy size={20} /></span><div><strong>이 기록을 계정에 저장하세요</strong><small>로그인 전에는 현재 기기에만 보관됩니다.</small></div><LogIn size={18} /></button>

      <div className="profile-tabs">
        <button className="is-active"><Grid3X3 size={18} /> 기록</button>
        <button onClick={() => onRequireAuth('저장한 게임')}><Bookmark size={18} /> 저장됨</button>
      </div>
      <section className="record-grid">
        {played.length > 0 ? played.map((record) => {
          const game = gameById(record.gameId)
          if (!game) return null
          return <button key={record.gameId} onClick={() => onRequireAuth('기록 공유')} style={{ background: `linear-gradient(145deg, ${game.theme.background}, ${game.theme.surface})` }}><span style={{ background: game.theme.accent, color: game.theme.surface }}>{game.icon}</span><strong>{record.bestScore}</strong><small>{game.title}</small></button>
        }) : (
          <div className="empty-records"><Trophy size={29} /><strong>아직 플레이 기록이 없어요</strong><span>탐색 탭에서 게임을 시작하면 여기에 최고 기록이 모입니다.</span></div>
        )}
      </section>
    </main>
  )
}
