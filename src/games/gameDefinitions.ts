import type { MiniGameModule } from './types'
import { createController } from './runtime/controllers'

type Definition = Omit<MiniGameModule, 'createController'>

const definitions: Definition[] = [
  {
    id: 'hoop-flight', slug: 'hoop-flight', title: 'Hoop Flight', kicker: 'GRAVITY RUN', icon: 'HF', category: 'Arcade Basketball',
    shortDescription: '탭으로 낙하 타이밍을 제어하며 끝없이 이어지는 림을 통과하세요.',
    fullDescription: '공은 계속 앞으로 이동하고 중력 때문에 아래로 떨어집니다. 탭으로 짧은 상승 힘을 더해 높이가 달라지는 림의 위에서 아래로 통과하세요. 림을 건드리지 않은 연속 클린샷은 득점 배율과 FIRE 연출을 키웁니다.',
    objective: '골대를 놓치지 않고 최대한 많은 림을 연속으로 통과해 최고 점수를 갱신하세요.',
    theme: { background: '#c9baa0', surface: '#282219', accent: '#ef4934', accent2: '#f3c64e', text: '#fffaf0', muted: '#8c7f69', headerStyle: 'dark' },
    controls: [{ label: '탭', description: '공에 즉시 위쪽 힘을 줍니다. 짧게 나누어 탭하면 높이를 세밀하게 유지할 수 있습니다.' }],
    scoringRules: [{ label: '일반 골', value: '림 사이를 위에서 아래로 통과하면 +1점' }, { label: '연속 클린', value: '림 접촉 없이 넣으면 1, 2, 3… 최대 5점까지 상승' }, { label: 'FIRE', value: '클린샷 3연속부터 불꽃 모드가 켜지며 배율은 계속 유지' }],
    failureConditions: ['공이 화면 아래 안전선을 벗어나면 비행이 종료됩니다.', '득점하지 못한 골대가 공 뒤로 지나가거나 공이 화면 왼쪽으로 밀려나면 종료됩니다.'],
    tips: ['공이 내려오기 시작한 뒤 한 번씩 탭하면 과도하게 높이 뜨는 것을 줄일 수 있습니다.', '천장에 닿아도 종료되지 않으므로 높은 골대를 앞두고 미리 상승해도 됩니다.', '림에 한 번이라도 닿으면 클린 콤보가 초기화됩니다.'],
  },
  {
    id: 'dunk-climb', slug: 'dunk-climb', title: 'Dunk Climb', kicker: 'AIM HIGHER', icon: 'DC', category: 'Skill Basketball',
    shortDescription: '궤적을 조준하고 벽 반사를 조합해 골대를 타고 계속 올라가세요.',
    fullDescription: '공을 잡아 뒤로 당기면 예상 이동 경로와 벽 반사 지점이 표시됩니다. 손을 놓아 반대 방향으로 발사하고 위쪽 골대에 넣으세요. 성공하면 현재 골대가 발판이 되고 더 높은 목표가 생성됩니다.',
    objective: '공을 떨어뜨리지 않고 위쪽 골대를 연속 공략해 도시 위로 최대한 높이 올라가세요.',
    theme: { background: '#f1f1f2', surface: '#e5e5e7', accent: '#f19a2b', accent2: '#e94b2f', text: '#222226', muted: '#8a8a90', headerStyle: 'dark' },
    controls: [{ label: '당기기', description: '공 주변을 누르고 최대 150px까지 당겨 방향과 힘을 정합니다. 점선은 벽 반사를 포함한 예상 경로입니다.' }, { label: '놓기', description: '당긴 반대 방향으로 공을 발사합니다. 18px보다 짧은 드래그는 취소됩니다.' }],
    scoringRules: [{ label: '기본 골', value: '목표 골대 통과 시 +1점' }, { label: '클린 콤보', value: '림 무접촉 연속 성공마다 +1, +2… 최대 +5 보너스' }, { label: '벽 반사', value: '벽을 한 번 이상 이용해 성공하면 추가 +1점' }],
    failureConditions: ['공이 목표 골대와 시작 골대를 모두 놓치고 화면 아래로 떨어지면 종료됩니다.'],
    tips: ['시작 골대로 다시 들어오면 SAVED 판정으로 공을 되돌려 받아 재도전할 수 있습니다.', '클린샷과 벽 반사를 동시에 성공하면 두 보너스가 함께 적용됩니다.', '공을 길게 당길수록 강해지지만, 가까운 골대에는 중간 세기가 더 안정적입니다.'],
  },
  {
    id: 'loop-hoops', slug: 'loop-hoops', title: 'Loop Hoops', kicker: 'SIDE TO SIDE', icon: 'LH', category: 'Loop Basketball',
    shortDescription: '화면 양쪽을 순환하며 제한 시간 안에 좌우 골대를 번갈아 공략하세요.',
    fullDescription: '탭할 때마다 공이 위로 튀고 현재 목표 골대 방향으로 속도가 붙습니다. 공은 좌우 화면 경계를 통과하면 반대편에서 자연스럽게 이어집니다. 골을 넣을 때마다 목표가 반대편으로 이동하고 타이머가 가득 찹니다.',
    objective: '줄어드는 타이머가 0이 되기 전에 좌우 골대에 계속 득점해 플레이 시간을 연장하세요.',
    theme: { background: '#60493c', surface: '#37251e', accent: '#16e8eb', accent2: '#ff198f', text: '#ffffff', muted: '#cdb7aa', headerStyle: 'dark' },
    controls: [{ label: '탭', description: '공을 즉시 위로 튕기고 현재 목표 골대 쪽으로 이동시킵니다.' }, { label: '좌우 루프', description: '양쪽 화면 경계를 넘으면 같은 높이와 속도를 유지한 채 반대편에서 이어집니다.' }],
    scoringRules: [{ label: '일반 골', value: '목표 림을 위에서 아래로 통과하면 +1점' }, { label: '클린 콤보', value: '림·천장·바닥 무접촉 연속 골은 1, 2, 3… 최대 5점' }, { label: '시간 충전', value: '득점할 때마다 타이머가 100%로 회복' }],
    failureConditions: ['화면 상단 타이머가 완전히 소진되면 게임이 종료됩니다.'],
    tips: ['화면 밖으로 나가는 것은 실수가 아니라 이동 수단입니다. 반대편 골대를 향한 지름길로 활용하세요.', '바닥은 자동으로 공을 튕겨 주지만 클린 콤보는 초기화됩니다.', '점수가 높아질수록 타이머가 더 빠르게 줄어드니 골 직후 다음 높이를 확인하세요.'],
  },
  {
    id: 'crossing-rush', slug: 'crossing-rush', title: 'Crossing Rush', kicker: 'ONE MORE STEP', icon: 'CR', category: 'Endless Crossing',
    shortDescription: '차량과 급류의 움직임을 읽고 한 칸씩 끝없는 길을 건너세요.',
    fullDescription: '상하좌우로 한 칸씩 이동하며 도로와 강을 통과합니다. 도로에서는 움직이는 차량을 피하고, 강에서는 통나무 위에 올라 함께 이동해야 합니다. 풀밭의 나무는 지나갈 수 없습니다.',
    objective: '차와 물을 피해 이전 최고 거리보다 더 멀리 전진하고 길 위의 코인을 수집하세요.',
    theme: { background: '#8ac43f', surface: '#183620', accent: '#fff36a', accent2: '#ff6c54', text: '#ffffff', muted: '#d9efbe', headerStyle: 'pixel' },
    controls: [{ label: '스와이프', description: '상하좌우로 한 칸 점프합니다. 나무가 있는 칸이나 화면 가장자리 밖으로는 이동하지 않습니다.' }, { label: '짧은 탭', description: '스와이프하지 않고 짧게 탭하면 앞쪽으로 한 칸 이동합니다.' }],
    scoringRules: [{ label: '최고 거리', value: '처음 도달한 앞쪽 행마다 +1점' }, { label: '코인', value: '코인이 있는 칸에 착지하면 +5점' }, { label: '후진·횡이동', value: '안전 확보에는 사용할 수 있지만 거리 점수는 없음' }],
    failureConditions: ['도로에서 차량과 부딪히면 종료됩니다.', '강에서 통나무가 없는 물에 착지하면 종료됩니다.', '통나무에 탄 채 화면 좌우 밖으로 떠밀려 나가면 종료됩니다.'],
    tips: ['차량과 통나무는 행마다 서로 다른 방향과 속도로 움직입니다.', '강을 건널 때는 도착 칸뿐 아니라 통나무가 이동할 방향까지 확인하세요.', '급할 때는 옆이나 뒤로 이동해 안전한 타이밍을 다시 만들 수 있습니다.'],
  },
  {
    id: 'neon-escape', slug: 'neon-escape', title: 'Neon Vault', kicker: 'DON’T STOP', icon: 'NV', category: 'Neon Maze',
    shortDescription: '멈출 수 없는 네온 미로에서 신호와 스위치를 모아 3개의 금고를 탈출하세요.',
    fullDescription: '스와이프하면 다음 벽이나 활성 펄스 게이트 직전까지 자동으로 미끄러집니다. 이동 경로의 신호·코인·스위치를 수집하고, 텔레포트와 방향을 90도 바꾸는 프리즘을 이용해 빨강·민트·보라 3스테이지를 탈출하세요.',
    objective: '각 스테이지의 모든 신호를 수집하고 스위치를 전부 켠 뒤 열린 출구에 도달하세요.',
    theme: { background: '#09051b', surface: '#10082e', accent: '#45ffe0', accent2: '#ff3ca6', text: '#f7f4ff', muted: '#9d92c5', headerStyle: 'neon' },
    controls: [{ label: '스와이프', description: '0.5초 안에 24px 이상 밀면 선택 방향으로 출발해 벽 직전까지 이동합니다. 이동 중에는 방향을 바꿀 수 없습니다.' }, { label: '특수 타일', description: '포털은 연결 지점으로 이동시키고, 프리즘은 진행 방향을 오른쪽 또는 왼쪽으로 90도 꺾습니다.' }],
    scoringRules: [{ label: '신호', value: '노란 신호 하나당 +1점' }, { label: '스위치', value: '스위치 활성화당 +5점' }, { label: '코인', value: '금고 코인 하나당 +10점' }, { label: '스테이지 탈출', value: '기본 +25점과 수집한 코인당 추가 +5점' }],
    failureConditions: ['활성 가시·레이저·펄스 게이트 또는 순찰자와 충돌하면 종료됩니다.', '보호막이 있다면 한 번의 충돌을 막고 해당 칸에서 즉시 멈춥니다.'],
    tips: ['펄스 게이트가 켜져 있을 때는 벽처럼 작동하므로 새로운 정지 지점으로 이용할 수 있습니다.', '출구는 모든 신호와 스위치를 처리하기 전까지 열리지 않습니다.', '보호막은 위험을 막는 동시에 이동을 중단시켜 새로운 경로를 만드는 데도 사용할 수 있습니다.'],
  },
  {
    id: 'perfect-stack', slug: 'perfect-stack', title: 'Perfect Stack', kicker: 'BUILD THE SKY', icon: 'PS', category: 'Precision Stack',
    shortDescription: '움직이는 블록을 정확히 맞춰 폭을 지키며 밤하늘 끝까지 탑을 쌓으세요.',
    fullDescription: '좌우로 움직이는 블록을 탭해 아래 블록 위에 놓습니다. 서로 겹친 부분만 다음 층으로 남고 밖으로 튀어나온 조각은 잘려 떨어집니다. 탑이 높아질수록 블록 이동 속도가 빨라집니다.',
    objective: '블록 폭이 사라지기 전에 최대한 많은 층을 쌓아 최고 기록을 만드세요.',
    theme: { background: '#6c78e8', surface: '#252866', accent: '#ffd86b', accent2: '#ff8db3', text: '#ffffff', muted: '#d4d7ff', headerStyle: 'light' },
    controls: [{ label: '탭', description: '움직이는 블록을 현재 위치에 떨어뜨립니다. 한 번 놓은 블록은 다시 움직일 수 없습니다.' }],
    scoringRules: [{ label: '새 층', value: '블록 배치 성공마다 +1점' }, { label: 'PERFECT', value: '중심 오차가 아래 블록 폭의 4% 이내면 폭을 그대로 유지' }, { label: '연속 PERFECT', value: '2연속부터 층마다 폭을 7px씩, 최대 220px까지 회복' }],
    failureConditions: ['현재 블록과 아래 블록이 전혀 겹치지 않으면 즉시 종료됩니다.'],
    tips: ['상단 BLOCK WIDTH 수치가 남은 폭을 백분율로 보여줍니다.', '블록은 층마다 빨라지므로 화면 중앙보다 아래 블록의 모서리를 기준으로 맞추는 편이 안정적입니다.', '폭이 좁아졌을 때 연속 PERFECT를 만들면 다시 회복할 수 있습니다.'],
  },
  {
    id: 'pin-core', slug: 'pin-core', title: 'Pin Core', kicker: 'FIND THE GAP', icon: 'PC', category: 'Rhythm Precision',
    shortDescription: '핀의 비행 시간까지 계산해 회전하는 코어의 빈틈을 정확히 공략하세요.',
    fullDescription: '탭하면 핀이 아래 발사대에서 코어를 향해 실제로 날아갑니다. 핀이 도착하는 동안에도 코어는 계속 회전하며, 접촉 순간 이미 꽂힌 핀과 겹치지 않아야 장착됩니다.',
    objective: '회전하는 핀 사이의 빈틈에 새 핀을 최대한 많이 꽂으세요.',
    theme: { background: '#101114', surface: '#24252b', accent: '#ffeb37', accent2: '#ff485e', text: '#ffffff', muted: '#b6b7bd', headerStyle: 'dark' },
    controls: [{ label: '탭', description: '아래 대기 중인 핀을 발사합니다. 핀이 약 0.2초 동안 비행하는 중에는 추가 탭이 입력되지 않습니다.' }],
    scoringRules: [{ label: '장착 성공', value: '다른 핀과 겹치지 않고 코어에 꽂히면 +1점' }, { label: '아슬아슬 성공', value: '가까운 간격을 통과하면 강한 성공 연출이 발생하지만 점수는 동일하게 +1점' }, { label: '속도 변화', value: '점수가 오를수록 회전이 빨라지고 7핀마다 회전 방향 전환' }],
    failureConditions: ['날아간 핀이 접촉 순간 기존 핀과 너무 가까우면 충돌하며 종료됩니다.'],
    tips: ['현재 빈틈이 발사선에 왔을 때가 아니라, 핀이 도착할 0.2초 뒤 위치를 예상해 탭하세요.', '회전 방향이 바뀌는 7, 14, 21점 직후에는 다음 탭 전에 방향을 다시 확인하세요.', '연타보다 일정한 리듬으로 한 발씩 확인하는 것이 안전합니다.'],
  },
  {
    id: 'pocket-golf', slug: 'pocket-golf', title: 'Pocket Golf', kicker: 'A TINY FAIRWAY', icon: 'PG', category: 'Mini Golf',
    shortDescription: '방향과 힘, 벽 반사를 직접 설계해 작은 코스의 홀을 연속 공략하세요.',
    fullDescription: '공이 멈춘 상태에서 뒤로 당겨 샷 방향과 세기를 정합니다. 손을 놓으면 당긴 반대 방향으로 공이 출발하며 코스 가장자리에서 반사됩니다. 충분히 느린 속도로 홀에 들어가야 성공합니다.',
    objective: '각 홀을 가능한 적은 타수로 넣고 연속해서 더 많은 홀을 완료하세요.',
    theme: { background: '#58ad6d', surface: '#153e2c', accent: '#fff27a', accent2: '#ef7065', text: '#ffffff', muted: '#c8ebcf', headerStyle: 'light' },
    controls: [{ label: '당기기', description: '공이 거의 멈췄을 때 화면을 누르고 공의 반대쪽으로 최대 150px까지 당깁니다. 점선이 예상 방향을 표시합니다.' }, { label: '놓기', description: '손을 놓으면 당긴 반대 방향으로 샷합니다. 하단 막대에서 현재 파워를 확인할 수 있습니다.' }],
    scoringRules: [{ label: '홀 완료', value: '공이 홀에 들어갈 때마다 +1점' }, { label: '타수', value: '샷 횟수는 홀마다 별도로 표시되며 성공 시 0으로 초기화' }, { label: '홀인원', value: '1타 성공 기록은 표시되지만 현재 추가 점수는 없음' }],
    failureConditions: ['시간 제한이나 게임 오버는 없습니다. 공이 멈추면 계속 다음 샷을 시도할 수 있습니다.'],
    tips: ['홀을 너무 빠르게 통과하면 들어가지 않으므로 마지막 구간에서는 힘을 줄이세요.', '코스 가장자리 반사는 속도의 일부를 잃으므로 강한 뱅크샷에 유리합니다.', '공이 움직이는 동안에는 새 드래그가 시작되지 않습니다.'],
  },
]

export const games: MiniGameModule[] = definitions.map((game) => ({
  ...game,
  createController: (options) => createController(game.id, game.theme, options),
}))

export const gameById = (id: string) => games.find((game) => game.id === id)
