import { ChevronDown, Flag, Gamepad2, Lightbulb, Target, TriangleAlert, Trophy } from 'lucide-react'
import type { MiniGameModule } from '../../games/types'

interface Props { game: MiniGameModule | null; bestScore: number; onClose: () => void; onPlay: (game: MiniGameModule) => void }

export function GameInfoSheet({ game, bestScore, onClose, onPlay }: Props) {
  if (!game) return null
  return (
    <div className="sheet-layer" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="info-sheet" role="dialog" aria-modal="true" aria-label={`${game.title} 게임 설명`}>
        <button className="sheet-handle" onClick={onClose} aria-label="닫기"><span /><ChevronDown size={18} /></button>
        <div className="sheet-title-row"><div className="game-mark" style={{ background: game.theme.accent, color: game.theme.surface }}>{game.icon}</div><div><p>{game.category}</p><h2>{game.title}</h2></div></div>
        <p className="sheet-copy">{game.fullDescription}</p>
        <div className="objective-card"><Flag size={18} /><div><span>게임 목표</span><strong>{game.objective}</strong></div></div>
        <div className="sheet-section"><h3><Gamepad2 size={18} /> 조작</h3>{game.controls.map((control) => <div className="rule-row" key={control.label}><strong>{control.label}</strong><span>{control.description}</span></div>)}</div>
        <div className="sheet-section"><h3><Target size={18} /> 점수와 보너스</h3>{game.scoringRules.map((rule) => <div className="rule-row" key={rule.label}><strong>{rule.label}</strong><span>{rule.value}</span></div>)}</div>
        <div className="sheet-section"><h3><TriangleAlert size={18} /> 게임 종료</h3><ul className="guide-list danger-list">{game.failureConditions.map((condition) => <li key={condition}>{condition}</li>)}</ul></div>
        <div className="sheet-section"><h3><Lightbulb size={18} /> 플레이 팁</h3><ul className="guide-list">{game.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></div>
        <div className="best-chip"><Trophy size={17} /> 내 최고 기록 <strong>{bestScore}</strong></div>
        <button className="primary-button" style={{ background: game.theme.accent, color: game.theme.surface }} onClick={() => onPlay(game)}>지금 플레이</button>
      </section>
    </div>
  )
}
