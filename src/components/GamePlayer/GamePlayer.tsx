import { ArrowLeft, Home, Pause, Play, RotateCcw, Share2, Trophy, Volume2, VolumeX } from 'lucide-react'
import { useRef, useState } from 'react'
import type { MiniGameModule } from '../../games/types'
import { formatGameScore, isBetterGameScore, selectBestGameScore } from '../../games/scoring'
import { GameCanvas } from '../GameCanvas/GameCanvas'

interface Props {
  game: MiniGameModule
  bestScore: number
  muted: boolean
  onBack: () => void
  onToggleMute: () => void
  onFinish: (score: number, elapsed: number) => void
  onShare: () => void
}

export function GamePlayer({ game, bestScore, muted, onBack, onToggleMute, onFinish, onShare }: Props) {
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [paused, setPaused] = useState(false)
  const [run, setRun] = useState(0)
  const startedAt = useRef(Date.now())
  const resultBest = selectBestGameScore(game, bestScore, score)
  const newBest = isBetterGameScore(game, score, bestScore)

  const finish = (finalScore: number) => { setScore(finalScore); setFinished(true); onFinish(finalScore, Date.now() - startedAt.current) }
  const replay = () => { setScore(0); setFinished(false); setPaused(false); startedAt.current = Date.now(); setRun((value) => value + 1) }
  const exit = () => { if (game.recordOnExit && !finished && score > 0) onFinish(score, Date.now() - startedAt.current); onBack() }

  return (
    <section className="game-player" style={{ background: game.theme.background }} aria-label={`${game.title} 플레이`}>
      <GameCanvas key={run} game={game} active paused={paused} onScore={setScore} onFinish={finish} />
      <header className="game-header">
        <button onClick={exit} className="header-button" aria-label="피드로 돌아가기"><ArrowLeft size={23} /></button>
        <div className="header-game"><span style={{ background: game.theme.accent, color: game.theme.surface }}>{game.icon}</span><div><small>NOW PLAYING</small><strong>{game.title}</strong></div></div>
        <button onClick={() => setPaused((value) => !value)} className="header-button" aria-label={paused ? '계속하기' : '일시정지'}>{paused ? <Play size={21} /> : <Pause size={21} />}</button>
        <button onClick={onToggleMute} className="header-button hide-small" aria-label={muted ? '소리 켜기' : '소리 끄기'}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
      </header>
      {paused && !finished && <div className="pause-layer"><button onClick={() => setPaused(false)}><Play size={28} fill="currentColor" /> 계속하기</button></div>}
      {finished && <div className="result-layer"><div className="result-card"><p>{game.scoreDirection === 'low' ? 'COURSE COMPLETE' : 'RUN COMPLETE'}</p><h2>{formatGameScore(game, score)}</h2><span>BEST <strong>{formatGameScore(game, resultBest)}</strong></span>{newBest && <div className="new-best"><Trophy size={16} /> NEW BEST!</div>}<div className="result-actions"><button className="primary-button" style={{ background: game.theme.accent, color: game.theme.surface }} onClick={replay}><RotateCcw size={18} /> 다시 플레이</button><button onClick={onBack}><Home size={19} /> 피드</button><button onClick={onShare}><Share2 size={19} /> 공유</button></div></div></div>}
    </section>
  )
}
