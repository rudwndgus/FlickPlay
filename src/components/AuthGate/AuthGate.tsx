import { AtSign, LockKeyhole, Mail, X } from 'lucide-react'

interface Props {
  reason: string | null
  onClose: () => void
}

export function AuthGate({ reason, onClose }: Props) {
  if (!reason) return null

  return (
    <div className="auth-gate-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="auth-gate" role="dialog" aria-modal="true" aria-labelledby="auth-gate-title">
        <button className="auth-close" onClick={onClose} aria-label="로그인 창 닫기"><X size={20} /></button>
        <div className="auth-symbol"><LockKeyhole size={25} /></div>
        <p>PLAY WITHOUT LIMITS</p>
        <h2 id="auth-gate-title">계정으로 이어서 즐겨요</h2>
        <span><strong>{reason}</strong> 기능은 로그인 후 사용할 수 있어요. 게임 탐색과 플레이는 로그인 없이 계속할 수 있습니다.</span>
        <div className="auth-buttons">
          <button type="button" disabled><AtSign size={19} /> Google로 계속하기 <em>준비 중</em></button>
          <button type="button" disabled><Mail size={19} /> 이메일로 계속하기 <em>준비 중</em></button>
        </div>
        <small>집에서 Supabase를 연결하면 이 화면이 실제 로그인으로 전환됩니다.</small>
        <button className="auth-later" onClick={onClose}>계속 둘러보기</button>
      </section>
    </div>
  )
}
