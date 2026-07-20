export const APP_VERSION = '0.4.5'

export const UPDATE_INFO = {
  title: 'Loop Hoops에 버저비터가 생겼어요',
  description: '타이머가 끝나면 새 터치만 잠기고 이미 날아간 공은 계속 움직입니다. 마지막 공이 바닥에 닿을 때까지 골을 노릴 수 있습니다.',
  addedGames: ['hoop-flight', 'dunk-climb', 'loop-hoops', 'crossing-rush', 'neon-escape', 'perfect-stack', 'pin-core', 'pocket-golf'],
  changes: ['타이머 0초 이후 터치 차단', '버저 이후 공의 물리·골 판정 유지', '버저비터 득점 후 타이머 재충전 없이 바닥 접촉 시 종료'],
} as const
