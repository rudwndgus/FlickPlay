import type { MiniGameModule } from './types'
import { createController } from './runtime/controllers'

type Definition = Omit<MiniGameModule, 'createController'>

const definitions: Definition[] = [
  {
    id: 'hoop-flight', slug: 'hoop-flight', title: 'Hoop Flight', kicker: 'GRAVITY RUN', icon: 'HF', category: 'Arcade Basketball',
    shortDescription: '탭으로 중력을 뒤집고, 떠오르는 림 사이를 비행하세요.',
    fullDescription: '농구공을 계속 공중에 띄워 높이가 달라지는 골대를 통과하세요. 바닥에 닿는 순간 비행이 끝납니다.',
    theme: { background: '#c9baa0', surface: '#282219', accent: '#ef4934', accent2: '#f3c64e', text: '#fffaf0', muted: '#8c7f69', headerStyle: 'dark' },
    controls: [{ label: '탭', description: '공에 위쪽 충격량을 줍니다.' }],
    scoringRules: [{ label: '골', value: '+1' }, { label: '클린샷', value: '연속 성공 시 FIRE MODE' }],
  },
  {
    id: 'dunk-climb', slug: 'dunk-climb', title: 'Dunk Climb', kicker: 'AIM HIGHER', icon: 'DC', category: 'Skill Basketball',
    shortDescription: '당기고 놓아, 도시의 골대를 타고 끝없이 올라가세요.',
    fullDescription: '공을 뒤로 당겨 방향과 힘을 정한 뒤 놓으세요. 벽 반사와 클린샷을 조합하면 점수가 폭발합니다.',
    theme: { background: '#f1f1f2', surface: '#e5e5e7', accent: '#f19a2b', accent2: '#e94b2f', text: '#222226', muted: '#8a8a90', headerStyle: 'dark' },
    controls: [{ label: '드래그', description: '공을 당겨 예상 궤적과 파워를 정합니다.' }, { label: '놓기', description: '당긴 반대 방향으로 발사합니다.' }],
    scoringRules: [{ label: '골', value: '+1' }, { label: '연속 클린샷', value: 'PERFECT / ON FIRE' }],
  },
  {
    id: 'loop-hoops', slug: 'loop-hoops', title: 'Loop Hoops', kicker: 'SIDE TO SIDE', icon: 'LH', category: 'Loop Basketball',
    shortDescription: '화면의 경계를 넘어 좌우 골대를 번갈아 공략하세요.',
    fullDescription: '탭으로 튀어 오르고 화면 양 끝을 루프하세요. 반대편 골대를 통과할 때마다 진행 방향이 뒤집힙니다.',
    theme: { background: '#087d8b', surface: '#032f3a', accent: '#f8ea58', accent2: '#ff5d8f', text: '#edffff', muted: '#98dde0', headerStyle: 'glass' },
    controls: [{ label: '탭', description: '목표 골대 방향으로 튀어 오릅니다.' }],
    scoringRules: [{ label: '루프 골', value: '+1' }, { label: '경계 통과 골', value: 'LOOP SHOT' }],
  },
  {
    id: 'crossing-rush', slug: 'crossing-rush', title: 'Crossing Rush', kicker: 'ONE MORE STEP', icon: 'CR', category: 'Endless Crossing',
    shortDescription: '도시의 차선과 급류를 한 칸씩 돌파하세요.',
    fullDescription: '네 방향으로 스와이프해 안전한 칸으로 점프하세요. 차를 피하고 통나무를 이용해 강을 건너야 합니다.',
    theme: { background: '#8ac43f', surface: '#183620', accent: '#fff36a', accent2: '#ff6c54', text: '#ffffff', muted: '#d9efbe', headerStyle: 'pixel' },
    controls: [{ label: '스와이프', description: '상하좌우로 한 칸 점프합니다.' }],
    scoringRules: [{ label: '전진', value: '+1m' }, { label: '체크포인트', value: '보너스' }],
  },
  {
    id: 'neon-escape', slug: 'neon-escape', title: 'Neon Escape', kicker: 'DON’T STOP', icon: 'NE', category: 'Neon Maze',
    shortDescription: '첫 번째 벽까지 질주하며 네온 미로를 탈출하세요.',
    fullDescription: '스와이프한 방향의 첫 번째 벽까지 멈추지 않고 이동합니다. 벽을 경로로 활용해 코인을 모으고 추격자를 피하세요.',
    theme: { background: '#09051b', surface: '#10082e', accent: '#45ffe0', accent2: '#ff3ca6', text: '#f7f4ff', muted: '#9d92c5', headerStyle: 'neon' },
    controls: [{ label: '스와이프', description: '선택 방향의 첫 벽까지 빠르게 이동합니다.' }],
    scoringRules: [{ label: '코인', value: '+10' }, { label: '생존', value: '초당 점수' }],
  },
  {
    id: 'perfect-stack', slug: 'perfect-stack', title: 'Perfect Stack', kicker: 'BUILD THE SKY', icon: 'PS', category: 'Precision Stack',
    shortDescription: '움직이는 블록을 잘라 구름 위까지 탑을 쌓으세요.',
    fullDescription: '탭해 움직이는 블록을 놓으세요. 겹친 부분만 남고 밖으로 나온 부분은 잘려 떨어집니다.',
    theme: { background: '#6c78e8', surface: '#252866', accent: '#ffd86b', accent2: '#ff8db3', text: '#ffffff', muted: '#d4d7ff', headerStyle: 'light' },
    controls: [{ label: '탭', description: '움직이는 블록을 현재 위치에 놓습니다.' }],
    scoringRules: [{ label: '층', value: '+1' }, { label: 'PERFECT', value: '블록 크기 회복' }],
  },
  {
    id: 'pin-core', slug: 'pin-core', title: 'Pin Core', kicker: 'FIND THE GAP', icon: 'PC', category: 'Rhythm Precision',
    shortDescription: '회전하는 코어의 빈틈을 읽고 핀을 꽂으세요.',
    fullDescription: '탭하면 아래에서 핀이 발사됩니다. 이미 꽂힌 핀을 피하고 좁은 틈에 연속으로 성공하세요.',
    theme: { background: '#101114', surface: '#24252b', accent: '#ffeb37', accent2: '#ff485e', text: '#ffffff', muted: '#b6b7bd', headerStyle: 'dark' },
    controls: [{ label: '탭', description: '중앙 코어를 향해 핀을 발사합니다.' }],
    scoringRules: [{ label: '핀', value: '+1' }, { label: 'CLOSE', value: '아슬아슬 보너스' }],
  },
  {
    id: 'pocket-golf', slug: 'pocket-golf', title: 'Pocket Golf', kicker: 'A TINY FAIRWAY', icon: 'PG', category: 'Mini Golf',
    shortDescription: '방향과 파워를 직접 정해 한 손으로 즐기는 작은 골프.',
    fullDescription: '공을 당겨 방향과 파워를 정하고 놓아 샷하세요. 벽 반사를 활용해 최소 타수로 홀을 통과하세요.',
    theme: { background: '#58ad6d', surface: '#153e2c', accent: '#fff27a', accent2: '#ef7065', text: '#ffffff', muted: '#c8ebcf', headerStyle: 'light' },
    controls: [{ label: '드래그', description: '공에서 당겨 방향과 파워를 정합니다.' }, { label: '놓기', description: '샷을 실행합니다.' }],
    scoringRules: [{ label: '홀', value: '+1' }, { label: '홀인원', value: '특별 보너스' }],
  },
]

export const games: MiniGameModule[] = definitions.map((game) => ({
  ...game,
  createController: (options) => createController(game.id, game.theme, options),
}))

export const gameById = (id: string) => games.find((game) => game.id === id)
