export const APP_VERSION = '0.4.2'

export const UPDATE_INFO = {
  title: '모바일 화면 비율을 다시 맞췄어요',
  description: 'iPhone 시스템 영역의 중복 여백을 제거하고, DM 입력창·하단 탭·게임 헤더를 밀착 배치해 게임 화면을 더 크게 확보했습니다.',
  addedGames: ['hoop-flight', 'dunk-climb', 'loop-hoops', 'crossing-rush', 'neon-escape', 'perfect-stack', 'pin-core', 'pocket-golf'],
  changes: ['DM 입력창의 이중 하단 여백 제거', '게임 헤더 46px 압축 및 중복 점수 제거', '전체 화면 높이 계산 통일로 게임 캔버스 확장'],
} as const
