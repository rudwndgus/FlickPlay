import { Bookmark, Heart, Info, Play, Send, Sparkles, Volume2, VolumeX } from 'lucide-react'
import type { MiniGameModule } from '../games/types'
import { formatGameScore } from '../games/scoring'
import { GameCanvas } from '../components/GameCanvas/GameCanvas'

interface Props {
  game: MiniGameModule; index: number; total: number; active: boolean; current: boolean; liked: boolean; bookmarked: boolean; muted: boolean; bestScore: number
  onPlay: (game: MiniGameModule) => void; onInfo: (game: MiniGameModule) => void; onLike: (id: string) => void; onBookmark: (id: string) => void; onShare: (game: MiniGameModule) => void; onToggleMute: () => void
}

export function GameFeedItem({ game, index, total, active, current, liked, bookmarked, muted, bestScore, onPlay, onInfo, onLike, onBookmark, onShare, onToggleMute }: Props) {
  return (
    <article className={`feed-item ${current ? 'is-current' : ''}`} style={{ background: game.theme.background }} aria-label={`${game.title} 미리보기`}>
      {active ? <GameCanvas game={game} preview paused={!current} /> : <div className="preview-placeholder" style={{ background: `linear-gradient(150deg, ${game.theme.background}, ${game.theme.surface})` }} />}
      <div className="feed-vignette" />
      <header className="feed-topbar">
        <button className="brand" aria-label="플릭코 홈"><span className="brand-bolt">F</span><span>Flicko</span></button>
        <div className="feed-progress"><span>{String(index + 1).padStart(2, '0')}</span><i><b style={{ width: `${((index + 1) / total) * 100}%` }} /></i><span>{String(total).padStart(2, '0')}</span></div>
        <button className="circle-button" onClick={onToggleMute} aria-label={muted ? '소리 켜기' : '소리 끄기'}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
      </header>
      <button className="preview-hit" onClick={() => onPlay(game)} aria-label={`${game.title} 플레이`}><span className="play-prompt"><Play size={15} fill="currentColor" /> TAP TO PLAY</span></button>
      <div className="feed-content">
        <div className="game-copy">
          <div className="eyebrow"><Sparkles size={13} /> {game.kicker}</div>
          <button className="title-button" onClick={() => onPlay(game)}><h1>{game.title}</h1></button>
          <button className="description-button" onClick={() => onInfo(game)}>{game.shortDescription} <span>더보기</span></button>
          <div className="meta-line"><span>{game.category}</span>{bestScore > 0 && <span>BEST {formatGameScore(game, bestScore)}</span>}</div>
        </div>
        <nav className="action-rail" aria-label="게임 액션">
          <button onClick={() => onLike(game.id)} className={liked ? 'active-like' : ''} aria-label="좋아요"><Heart size={25} fill={liked ? 'currentColor' : 'none'} /><span>{liked ? 'Liked' : 'Like'}</span></button>
          <button onClick={() => onBookmark(game.id)} className={bookmarked ? 'active-save' : ''} aria-label="즐겨찾기"><Bookmark size={24} fill={bookmarked ? 'currentColor' : 'none'} /><span>Save</span></button>
          <button onClick={() => onShare(game)} aria-label="공유"><Send size={23} /><span>Share</span></button>
          <button onClick={() => onInfo(game)} aria-label="게임 설명"><Info size={24} /><span>Rules</span></button>
          <button className="mini-game-mark" onClick={() => onPlay(game)} style={{ background: game.theme.accent, color: game.theme.surface }}>{game.icon}</button>
        </nav>
      </div>
      <div className="swipe-cue"><span /> SWIPE FOR NEXT GAME</div>
    </article>
  )
}
