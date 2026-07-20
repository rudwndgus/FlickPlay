import { Bookmark, Gamepad2, Heart, LogIn, MessageCircle, MoreHorizontal, Send, Sparkles, Trophy } from 'lucide-react'
import { gameById } from '../games/gameDefinitions'
import type { MiniGameModule } from '../games/types'
import { socialPosts, stories } from './socialData'

interface Props {
  onPlay: (game: MiniGameModule) => void
  onExplore: () => void
  onRequireAuth: (reason: string) => void
  onShare: (game: MiniGameModule) => void
}

const compactNumber = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value)

export function HomeScreen({ onPlay, onExplore, onRequireAuth, onShare }: Props) {
  return (
    <main className="social-screen home-screen" aria-label="Flicko 홈">
      <header className="social-header">
        <button className="brand social-brand" aria-label="Flicko 홈"><span className="brand-bolt">F</span><span>Flicko</span></button>
        <div className="header-wordmark">PLAY FEED</div>
        <button className="social-header-action" onClick={() => onRequireAuth('로그인')} aria-label="로그인"><LogIn size={20} /></button>
      </header>

      <section className="stories" aria-label="스토리">
        {stories.map((story) => (
          <button key={story.id} onClick={() => onRequireAuth(story.id === 'me' ? '스토리 만들기' : '스토리 보기')}>
            <span className={`story-ring ${story.id === 'me' ? 'is-mine' : ''}`}><i style={{ background: story.accent }}>{story.initials}</i></span>
            <small>{story.name}</small>
            {story.live && <em>LIVE</em>}
          </button>
        ))}
      </section>

      <section className="home-welcome">
        <div><Sparkles size={16} /><span>오늘의 플레이</span></div>
        <h1>친구의 기록을 보고<br />바로 도전하세요.</h1>
        <button onClick={onExplore}><Gamepad2 size={18} /> 게임 피드 열기</button>
      </section>

      <section className="post-feed" aria-label="게시물 피드">
        {socialPosts.map((post) => {
          const game = gameById(post.gameId)
          if (!game) return null
          return (
            <article className="social-post" key={post.id}>
              <header>
                <button className="post-author" onClick={() => onRequireAuth('프로필 보기')}>
                  <span style={{ background: post.accent }}>{post.initials}</span>
                  <div><strong>{post.author}</strong><small>{post.handle} · {post.timeAgo}</small></div>
                </button>
                <button className="post-more" aria-label="게시물 메뉴"><MoreHorizontal size={21} /></button>
              </header>

              <button className="score-card" onClick={() => onPlay(game)} style={{ '--post-bg': game.theme.background, '--post-accent': game.theme.accent } as React.CSSProperties}>
                <div className="score-grid" />
                <span className="score-card-badge"><Trophy size={13} /> {post.badge}</span>
                <div className="score-game-mark" style={{ background: game.theme.accent, color: game.theme.surface }}>{game.icon}</div>
                <div className="score-copy"><small>{game.title}</small><strong>{post.score}</strong><span>POINTS</span></div>
                <div className="score-challenge"><Gamepad2 size={16} /> TAP TO CHALLENGE</div>
              </button>

              <div className="post-actions">
                <button onClick={() => onRequireAuth('좋아요')}><Heart size={23} /><span>{compactNumber(post.likes)}</span></button>
                <button onClick={() => onRequireAuth('댓글')}><MessageCircle size={22} /><span>{post.comments}</span></button>
                <button onClick={() => void onShare(game)}><Send size={22} /><span>공유</span></button>
                <button className="post-save" onClick={() => onRequireAuth('저장')} aria-label="게시물 저장"><Bookmark size={22} /></button>
              </div>
              <p><strong>{post.handle}</strong> {post.caption}</p>
              <button className="view-comments" onClick={() => onRequireAuth('댓글')}>댓글 {post.comments}개 모두 보기</button>
            </article>
          )
        })}
      </section>
    </main>
  )
}
