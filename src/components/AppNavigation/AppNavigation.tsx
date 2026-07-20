import { Compass, Home, MessageCircle, UserRound } from 'lucide-react'

export type AppTab = 'home' | 'explore' | 'messages' | 'profile'

interface Props {
  activeTab: AppTab
  onChange: (tab: AppTab) => void
}

const tabs = [
  { id: 'home', label: '홈', icon: Home },
  { id: 'explore', label: '탐색', icon: Compass },
  { id: 'messages', label: 'DM', icon: MessageCircle },
  { id: 'profile', label: '프로필', icon: UserRound },
] as const

export function AppNavigation({ activeTab, onChange }: Props) {
  return (
    <nav className="app-navigation" aria-label="주요 메뉴">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} className={activeTab === id ? 'is-active' : ''} onClick={() => onChange(id)} aria-current={activeTab === id ? 'page' : undefined} aria-label={id === 'explore' && activeTab === id ? '탐색 새로고침' : label}>
          <span><Icon size={22} strokeWidth={activeTab === id ? 2.7 : 2} /></span>
          <small>{label}</small>
        </button>
      ))}
    </nav>
  )
}
