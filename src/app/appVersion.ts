export const APP_VERSION = '0.4.7'

export const UPDATE_INFO = {
  title: 'Loop Hoops 득점 판정이 정확해졌어요',
  description: '림 안쪽 가장자리를 스치며 통과한 공도 놓치지 않고 득점합니다. 중앙 통과는 클린샷, 가장자리 통과는 일반 득점으로 정확하게 구분합니다.',
  addedGames: ['hoop-flight', 'dunk-climb', 'loop-hoops', 'crossing-rush', 'neon-escape', 'perfect-stack', 'pin-core', 'pocket-golf'],
  changes: ['림 안쪽 통과 판정 보강', '가장자리 득점과 클린샷 구분', '백보드–림 바깥 틈의 오득점 차단 유지'],
} as const
