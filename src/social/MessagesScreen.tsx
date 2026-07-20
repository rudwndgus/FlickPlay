import { ArrowLeft, Edit3, Image, LogIn, Search, Send, Smile } from 'lucide-react'
import { useState } from 'react'
import { conversations, demoMessages, type ConversationPreview } from './socialData'

interface Props { onRequireAuth: (reason: string) => void }

export function MessagesScreen({ onRequireAuth }: Props) {
  const [selected, setSelected] = useState<ConversationPreview | null>(null)

  if (selected) {
    return (
      <main className="social-screen message-screen conversation-screen" aria-label={`${selected.name}님과의 대화`}>
        <header className="social-header conversation-header">
          <button className="social-header-action" onClick={() => setSelected(null)} aria-label="대화 목록으로"><ArrowLeft size={21} /></button>
          <button className="conversation-person" onClick={() => onRequireAuth('프로필 보기')}>
            <span style={{ background: selected.accent }}>{selected.initials}</span>
            <div><strong>{selected.name}</strong><small>{selected.online ? '지금 활동 중' : '최근 활동'}</small></div>
          </button>
        </header>
        <section className="chat-body">
          <div className="chat-date">오늘</div>
          <div className="shared-score">
            <span>LH</span><div><small>LOOP HOOPS</small><strong>29점 기록</strong></div><button onClick={() => onRequireAuth('기록 도전')}>도전</button>
          </div>
          {demoMessages.map((message) => <div key={message.id} className={`chat-bubble ${message.mine ? 'is-mine' : ''}`}><p>{message.text}</p><small>{message.time}</small></div>)}
        </section>
        <form className="message-composer" onSubmit={(event) => { event.preventDefault(); onRequireAuth('메시지 보내기') }}>
          <button type="button" aria-label="사진 보내기" onClick={() => onRequireAuth('사진 보내기')}><Image size={20} /></button>
          <label><input placeholder="메시지 보내기" aria-label="메시지" /><Smile size={19} /></label>
          <button type="submit" aria-label="전송"><Send size={20} /></button>
        </form>
      </main>
    )
  }

  return (
    <main className="social-screen message-screen" aria-label="다이렉트 메시지">
      <header className="social-header">
        <div><small>DIRECT</small><h1>메시지</h1></div>
        <button className="social-header-action" onClick={() => onRequireAuth('새 메시지')} aria-label="새 메시지"><Edit3 size={20} /></button>
      </header>
      <div className="guest-notice"><LogIn size={18} /><div><strong>로그인하면 대화가 모든 기기에 저장돼요</strong><span>지금은 DM 화면을 미리 둘러볼 수 있습니다.</span></div><button onClick={() => onRequireAuth('DM')}>로그인</button></div>
      <label className="message-search"><Search size={18} /><input type="search" placeholder="대화 검색" /></label>
      <section className="conversation-list">
        <div className="section-label"><span>메시지</span><small>요청 1</small></div>
        {conversations.map((conversation) => (
          <button key={conversation.id} onClick={() => setSelected(conversation)}>
            <span className="conversation-avatar" style={{ background: conversation.accent }}>{conversation.initials}{conversation.online && <i />}</span>
            <div><strong>{conversation.name}</strong><p>{conversation.lastMessage}</p></div>
            <aside><small>{conversation.time}</small>{conversation.unread > 0 && <b>{conversation.unread}</b>}</aside>
          </button>
        ))}
      </section>
    </main>
  )
}
