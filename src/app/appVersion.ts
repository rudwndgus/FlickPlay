export const APP_VERSION = '0.4.4'

export const UPDATE_INFO = {
  title: 'Loop Hoops의 투명 천장을 없앴어요',
  description: '공이 보이지 않는 예전 충돌선에 막히지 않고 화면 위까지 올라가며, 이제 보이는 타이머 하단이 실제 천장 역할을 합니다.',
  addedGames: ['hoop-flight', 'dunk-climb', 'loop-hoops', 'crossing-rush', 'neon-escape', 'perfect-stack', 'pin-core', 'pocket-golf'],
  changes: ['기존 104px 투명 천장 제거', '타이머 하단 35px과 공 반지름을 실제 충돌선으로 일치', '타이머 이전 구간의 자유로운 상승 회귀 테스트 추가'],
} as const
