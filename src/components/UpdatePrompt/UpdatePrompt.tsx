import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return <aside className="update-toast"><div className="update-icon"><RefreshCw size={18} /></div><div><strong>새로운 플레이가 도착했어요</strong><span>기록을 그대로 유지하고 업데이트합니다.</span></div><button onClick={() => void updateServiceWorker(true)}>업데이트</button><button className="icon-button" onClick={() => setNeedRefresh(false)} aria-label="나중에"><X size={18} /></button></aside>
}
