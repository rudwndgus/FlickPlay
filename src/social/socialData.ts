export interface StoryPreview {
  id: string
  name: string
  initials: string
  accent: string
  live?: boolean
}

export interface SocialPost {
  id: string
  author: string
  handle: string
  initials: string
  accent: string
  gameId: string
  score: number
  caption: string
  likes: number
  comments: number
  timeAgo: string
  badge: string
}

export interface ConversationPreview {
  id: string
  name: string
  initials: string
  accent: string
  lastMessage: string
  time: string
  unread: number
  online?: boolean
}

export const stories: StoryPreview[] = [
  { id: 'me', name: '내 스토리', initials: '+', accent: '#555866' },
  { id: 'milo', name: 'milo', initials: 'MI', accent: '#ff6b8a', live: true },
  { id: 'jay', name: 'jay.play', initials: 'JP', accent: '#f6c453' },
  { id: 'nova', name: 'nova', initials: 'NO', accent: '#63e6be' },
  { id: 'daze', name: 'daze', initials: 'DZ', accent: '#8d7bff' },
  { id: 'pixel', name: 'pixel.k', initials: 'PK', accent: '#55c7ff' },
]

export const socialPosts: SocialPost[] = [
  {
    id: 'post-loop-29', author: 'Milo', handle: '@milo_runs', initials: 'MI', accent: '#ff6b8a', gameId: 'loop-hoops',
    score: 29, caption: '마지막 2초에 Perfect x3. 이 기록 깰 사람?', likes: 1284, comments: 86, timeAgo: '8분', badge: 'NEW HIGH SCORE',
  },
  {
    id: 'post-vault-3', author: 'Nova', handle: '@nova_arcade', initials: 'NO', accent: '#63e6be', gameId: 'neon-escape',
    score: 147, caption: '민트 금고의 레이저 타이밍, 드디어 찾았다. 쉴드는 멈춤 장치로 써야 함.', likes: 842, comments: 41, timeAgo: '32분', badge: 'STAGE CLEAR',
  },
  {
    id: 'post-stack-44', author: 'Jay', handle: '@jay.play', initials: 'JP', accent: '#f6c453', gameId: 'perfect-stack',
    score: 44, caption: '폭 9%에서 퍼펙트 6연속으로 살아남음. 손에 땀난다.', likes: 562, comments: 23, timeAgo: '1시간', badge: 'PERFECT x6',
  },
]

export const conversations: ConversationPreview[] = [
  { id: 'milo', name: 'Milo', initials: 'MI', accent: '#ff6b8a', lastMessage: 'Loop Hoops 29점 기록을 보냈어요', time: '방금', unread: 2, online: true },
  { id: 'jay', name: 'Jay', initials: 'JP', accent: '#f6c453', lastMessage: 'Perfect Stack 같이 해볼래?', time: '18분', unread: 1, online: true },
  { id: 'nova', name: 'Nova', initials: 'NO', accent: '#63e6be', lastMessage: '공략 공유 고마워!', time: '어제', unread: 0 },
  { id: 'flicko', name: 'Flicko 팀', initials: 'F', accent: '#f9f36b', lastMessage: '이번 주 새 게임이 도착했어요 ✦', time: '월', unread: 0 },
]

export const demoMessages = [
  { id: '1', mine: false, text: '방금 Loop Hoops 기록 봤어?', time: '오후 9:18' },
  { id: '2', mine: false, text: '29점에서 타이머가 진짜 빠르더라 😵', time: '오후 9:18' },
  { id: '3', mine: true, text: '도전 링크 보내줘. 바로 해볼게!', time: '오후 9:20' },
] as const
