export const AXEBOUND_WORLD_WIDTH = 720
export const AXEBOUND_WORLD_HEIGHT = 8640
export const AXEBOUND_FLOOR_Y = 8520
export const AXEBOUND_SUMMIT_Y = 100

export type AxeBoundMaterial = 'rock' | 'wood' | 'metal' | 'crystal' | 'spikeRock' | 'ice'
export type AxeBoundObjectType = 'rect' | 'circle' | 'polygon' | 'movingPlatform' | 'rotatingBeam' | 'swingingBlock' | 'fallingRock' | 'goal'
export type AxeBoundPoint = { x: number; y: number }

export interface AxeBoundLevelObject {
  id: string
  type: AxeBoundObjectType
  material: AxeBoundMaterial
  x: number
  y: number
  width: number
  height: number
  rotation: number
  radius?: number
  points?: AxeBoundPoint[]
  moveDistance?: number
  moveDuration?: number
  rotationSpeed?: number
  anchorX?: number
  anchorY?: number
  ropeLength?: number
  triggerDelay?: number
  resetDelay?: number
}

const rect = (
  id: string,
  material: AxeBoundMaterial,
  left: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
  type: AxeBoundObjectType = 'rect',
): AxeBoundLevelObject => ({ id, type, material, x: left + width / 2, y, width, height, rotation })

const polygon = (id: string, material: AxeBoundMaterial, x: number, y: number, points: AxeBoundPoint[]): AxeBoundLevelObject => {
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y)
  return { id, type: 'polygon', material, x, y, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), points, rotation: 0 }
}

export const AXEBOUND_LEVEL_OBJECTS: readonly AxeBoundLevelObject[] = [
  // Six full-screen sections, ordered exactly like the six supplied images: 1 at the bottom, 6 at the summit.
  rect('outer-left-s1', 'rock', -25, 7920, 100, 1440), rect('outer-right-s1', 'rock', 645, 7920, 100, 1440),
  rect('outer-left-s2', 'rock', -10, 6480, 105, 1440), rect('outer-right-s2', 'rock', 625, 6480, 115, 1440),
  rect('outer-left-s3', 'rock', -25, 5040, 100, 1440), rect('outer-right-s3', 'rock', 650, 5040, 95, 1440),
  rect('outer-left-s4', 'rock', -20, 3600, 105, 1440), rect('outer-right-s4', 'rock', 635, 3600, 110, 1440),
  rect('outer-left-s5', 'rock', -25, 2160, 100, 1440), rect('outer-right-s5', 'rock', 645, 2160, 100, 1440),
  rect('outer-left-s6', 'rock', -20, 720, 105, 1440), rect('outer-right-s6', 'rock', 635, 720, 110, 1440),

  // IMAGE 1 — flooded cavern, from the violet basin to the upper crystal bridge.
  rect('start-floor', 'rock', 55, 8485, 175, 62), rect('section1-water', 'ice', 60, 8580, 600, 48),
  polygon('s1-left-crystal', 'crystal', 120, 8290, [{ x: -65, y: 150 }, { x: -30, y: -150 }, { x: 35, y: -100 }, { x: 70, y: 145 }]),
  polygon('s1-right-crystal', 'crystal', 605, 8140, [{ x: -70, y: 160 }, { x: -25, y: -140 }, { x: 45, y: -90 }, { x: 72, y: 145 }]),
  rect('s1-right-lower', 'rock', 475, 8290, 190, 48), rect('s1-left-lower', 'rock', 75, 8120, 235, 48),
  rect('s1-center-lower', 'rock', 350, 8010, 215, 48), rect('s1-left-middle', 'rock', 95, 7790, 230, 50),
  rect('s1-right-middle', 'rock', 440, 7610, 225, 50), rect('s1-center-middle', 'wood', 360, 7470, 150, 34),
  { ...rect('s1-moving-lift', 'wood', 280, 7300, 150, 32, 0, 'movingPlatform'), moveDistance: 160, moveDuration: 3400 },
  rect('s1-left-upper', 'rock', 75, 7205, 310, 50), rect('s1-right-upper', 'rock', 505, 7160, 165, 50),

  // IMAGE 2 — dense alternating crystal ledges and small central bridges.
  rect('s2-left-bottom', 'rock', 70, 7080, 285, 48), rect('s2-right-bottom', 'rock', 500, 7010, 170, 48),
  rect('s2-left-01', 'rock', 95, 6840, 235, 48), rect('s2-right-01', 'rock', 430, 6700, 220, 48),
  rect('s2-center-01', 'wood', 320, 6550, 105, 30), rect('s2-left-02', 'rock', 70, 6420, 255, 48),
  rect('s2-right-02', 'rock', 470, 6280, 195, 48), { ...rect('s2-falling-crate', 'wood', 325, 6150, 90, 42, 0, 'fallingRock'), triggerDelay: 520, resetDelay: 4200 },
  rect('s2-left-03', 'rock', 100, 6020, 230, 48), rect('s2-right-03', 'rock', 430, 5900, 220, 48),
  rect('s2-left-top', 'rock', 65, 5795, 285, 50), rect('s2-right-top', 'rock', 485, 5765, 180, 48),
  polygon('s2-left-crystal', 'crystal', 115, 6450, [{ x: -55, y: 250 }, { x: -20, y: -245 }, { x: 38, y: -205 }, { x: 65, y: 230 }]),
  polygon('s2-right-crystal', 'crystal', 600, 6310, [{ x: -62, y: 270 }, { x: -22, y: -250 }, { x: 45, y: -210 }, { x: 66, y: 250 }]),

  // IMAGE 3 — iron lift shaft, scaffold rails and sparse metal landings.
  rect('s3-bottom-catcher', 'rock', 295, 5710, 150, 50), rect('s3-right-lower', 'rock', 445, 5510, 205, 48),
  rect('s3-left-lower', 'rock', 70, 5350, 275, 50), rect('s3-center-lower', 'metal', 335, 5190, 125, 36),
  rect('s3-right-rail', 'metal', 545, 5100, 72, 520), rect('s3-left-rail', 'metal', 150, 5000, 65, 470),
  rect('s3-left-mid', 'rock', 70, 5040, 180, 48), rect('s3-center-mid', 'rock', 260, 4880, 190, 48),
  { ...rect('s3-rotating-beam', 'metal', 395, 4740, 240, 30, 0, 'rotatingBeam'), rotationSpeed: .16 },
  rect('s3-right-mid', 'rock', 495, 4610, 170, 48), rect('s3-left-upper', 'rock', 80, 4475, 300, 50),
  rect('s3-right-upper', 'rock', 490, 4360, 180, 48), polygon('s3-upper-crystal', 'crystal', 125, 4480, [{ x: -55, y: 170 }, { x: -20, y: -160 }, { x: 42, y: -120 }, { x: 62, y: 150 }]),

  // IMAGE 4 — chandelier hall with chained blocks and a central suspended platform.
  rect('s4-left-bottom', 'rock', 70, 4260, 285, 50), rect('s4-right-bottom', 'rock', 500, 4160, 170, 48),
  rect('s4-left-01', 'rock', 80, 4020, 235, 48), rect('s4-right-01', 'rock', 455, 3880, 210, 48),
  { ...rect('s4-center-chandelier', 'wood', 270, 3710, 190, 38, 0, 'swingingBlock'), x: 365, anchorX: 365, anchorY: 3440, ropeLength: 270 },
  { ...rect('s4-hanging-block-left', 'metal', 220, 3500, 90, 70, 0, 'swingingBlock'), x: 265, anchorX: 265, anchorY: 3290, ropeLength: 210 },
  { ...rect('s4-hanging-block-right', 'metal', 470, 3430, 90, 70, 0, 'swingingBlock'), x: 515, anchorX: 515, anchorY: 3190, ropeLength: 240 },
  rect('s4-left-02', 'rock', 65, 3560, 260, 50), rect('s4-right-02', 'rock', 485, 3380, 180, 48),
  rect('s4-center-pillar', 'rock', 315, 3260, 120, 190), rect('s4-left-upper', 'rock', 80, 3080, 230, 48),
  rect('s4-right-upper', 'rock', 500, 2940, 170, 48),

  // IMAGE 5 — tall crystal ascent with many narrow hanging walkways.
  rect('s5-left-bottom', 'rock', 95, 2830, 245, 48), rect('s5-right-bottom', 'rock', 445, 2740, 210, 48),
  { ...rect('s5-hanging-lift', 'wood', 330, 2600, 105, 32, 0, 'movingPlatform'), moveDistance: 150, moveDuration: 3000 },
  rect('s5-left-01', 'rock', 70, 2480, 250, 48), rect('s5-right-01', 'rock', 465, 2360, 195, 48),
  rect('s5-center-01', 'wood', 305, 2240, 115, 30), rect('s5-left-02', 'rock', 90, 2110, 220, 48),
  rect('s5-right-02', 'rock', 430, 1980, 225, 48), rect('s5-center-02', 'wood', 325, 1870, 100, 30),
  rect('s5-left-03', 'rock', 65, 1760, 270, 48), rect('s5-right-03', 'rock', 470, 1640, 190, 48),
  rect('s5-top-bridge', 'wood', 265, 1495, 250, 34),
  polygon('s5-left-crystal', 'crystal', 105, 2180, [{ x: -50, y: 300 }, { x: -15, y: -285 }, { x: 42, y: -235 }, { x: 62, y: 280 }]),
  polygon('s5-right-crystal', 'crystal', 610, 2070, [{ x: -62, y: 310 }, { x: -20, y: -295 }, { x: 45, y: -230 }, { x: 65, y: 290 }]),

  // IMAGE 6 — final crown chamber; stepped lower ruins lead to the flaming altar.
  rect('s6-left-bottom', 'rock', 70, 1390, 290, 50), rect('s6-right-bottom', 'rock', 510, 1280, 160, 48),
  rect('s6-center-lower', 'rock', 315, 1160, 135, 46), rect('s6-left-lower', 'rock', 100, 1030, 235, 48),
  rect('s6-right-lower', 'rock', 430, 900, 225, 48), rect('s6-center-mid', 'rock', 305, 760, 130, 46),
  rect('s6-left-mid', 'rock', 105, 630, 210, 48), rect('s6-right-mid', 'rock', 485, 520, 180, 48),
  rect('s6-center-upper', 'rock', 275, 390, 220, 50), rect('s6-hanging-bridge', 'wood', 300, 270, 230, 34),
  rect('summit-platform', 'rock', 165, 150, 390, 62), { ...rect('summit-goal', 'rock', 310, 82, 100, 100, 0, 'goal'), x: 360 },
  polygon('s6-left-crystal', 'crystal', 105, 700, [{ x: -55, y: 210 }, { x: -18, y: -200 }, { x: 40, y: -160 }, { x: 62, y: 195 }]),
  polygon('s6-right-crystal', 'crystal', 610, 760, [{ x: -62, y: 220 }, { x: -20, y: -205 }, { x: 45, y: -165 }, { x: 65, y: 205 }]),
]

export const AXEBOUND_ZONES = [
  { y: 7200, name: '01 · FLOODED PIT' },
  { y: 5760, name: '02 · CRYSTAL RUINS' },
  { y: 4320, name: '03 · IRON SHAFT' },
  { y: 2880, name: '04 · CHANDELIER HALL' },
  { y: 1440, name: '05 · CRYSTAL ASCENT' },
  { y: 0, name: '06 · THE CROWN' },
] as const

export const isAxeBoundStickable = (material: AxeBoundMaterial) => material === 'rock' || material === 'wood'
