export const APP_VERSION = '0.3.5'

export const UPDATE_INFO = {
  title: 'Pin Core의 판정과 발사감이 정확해졌어요',
  description: '핀은 다트처럼 즉시 날아가며, 비행 중에는 충돌하지 않고 코어 접촉 순간 보이는 핀 크기만큼만 판정합니다.',
  addedGames: ['hoop-flight', 'dunk-climb', 'loop-hoops', 'crossing-rush', 'neon-escape', 'perfect-stack', 'pin-core', 'pocket-golf'],
  changes: ['Pin Core 비행 시간 0.2초에서 0.085초로 단축', '비행 경로 충돌 완전 제외', '그려진 핀 머리·축보다 넓지 않은 픽셀 기반 판정 적용'],
} as const
