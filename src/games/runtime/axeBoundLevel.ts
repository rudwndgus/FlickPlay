export const AXEBOUND_WORLD_WIDTH = 720
export const AXEBOUND_WORLD_HEIGHT = 7200
export const AXEBOUND_FLOOR_Y = 7100
export const AXEBOUND_SUMMIT_Y = 130

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

const circle = (id: string, material: AxeBoundMaterial, x: number, y: number, radius: number): AxeBoundLevelObject => ({
  id, type: 'circle', material, x, y, width: radius * 2, height: radius * 2, radius, rotation: 0,
})

const polygon = (id: string, material: AxeBoundMaterial, x: number, y: number, points: AxeBoundPoint[]): AxeBoundLevelObject => {
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y)
  return { id, type: 'polygon', material, x, y, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), points, rotation: 0 }
}

export const AXEBOUND_LEVEL_OBJECTS: readonly AxeBoundLevelObject[] = [
  // Natural, visible outer cliff faces keep the player inside the shaft.
  rect('outer-left-cliff', 'spikeRock', -75, 3600, 115, 7200),
  rect('outer-right-cliff', 'spikeRock', 680, 3600, 115, 7200),

  // ZONE 1 — THE PIT
  rect('start-floor', 'rock', 40, 7100, 640, 100),
  rect('pit-left-wall', 'rock', 20, 6650, 90, 1000, -.03),
  rect('pit-right-wall', 'rock', 610, 6600, 90, 1100, .03),
  rect('tutorial-rock-01', 'rock', 410, 6870, 180, 42, -.18),
  rect('tutorial-rock-02', 'rock', 155, 6670, 170, 44, .2),
  rect('tutorial-rock-03', 'wood', 390, 6460, 200, 38, -.3),
  rect('zone1-rest', 'rock', 195, 6260, 330, 60),

  // ZONE 2 — BROKEN STEPS
  rect('step-left-01', 'rock', 55, 6070, 250, 48, .12),
  rect('step-right-01', 'rock', 430, 5880, 235, 48, -.16),
  rect('step-left-02', 'rock', 65, 5660, 210, 46, .25),
  rect('step-center-metal', 'metal', 260, 5520, 210, 32, -.08),
  rect('step-right-02', 'rock', 475, 5400, 190, 48, -.22),
  rect('zone2-catch-left', 'rock', 20, 5740, 100, 520, -.02),
  rect('zone2-catch-right', 'rock', 610, 5570, 90, 430, .02),
  rect('zone2-rest', 'rock', 175, 5270, 370, 62),

  // ZONE 3 — IRON THROAT
  rect('iron-left-wall', 'metal', 65, 4740, 105, 1050, .04),
  rect('iron-right-wall', 'metal', 550, 4700, 105, 1100, -.04),
  rect('iron-rock-01', 'rock', 180, 5100, 150, 45, -.25),
  rect('iron-rock-02', 'rock', 410, 4900, 135, 42, .22),
  circle('iron-rock-03', 'rock', 280, 4680, 58),
  rect('iron-rock-04', 'wood', 390, 4500, 180, 35, -.45),
  rect('iron-bottom-catcher', 'rock', 190, 5180, 340, 50),
  rect('iron-exit-rest', 'rock', 145, 4370, 430, 64),

  // ZONE 4 — THE CHANDELIER
  rect('chandelier-left-anchor', 'rock', 40, 4160, 210, 52, .18),
  { ...rect('swinging-rock-01', 'rock', 295, 4300, 130, 65, 0, 'swingingBlock'), x: 360, anchorX: 360, anchorY: 4100, ropeLength: 200 },
  { ...rect('moving-wood-01', 'wood', 190, 3930, 180, 34, 0, 'movingPlatform'), moveDistance: 260, moveDuration: 3600 },
  { ...rect('rotating-metal-01', 'metal', 180, 3730, 360, 28, 0, 'rotatingBeam'), rotationSpeed: .22 },
  rect('chandelier-rock-02', 'rock', 490, 3540, 185, 48, -.3),
  rect('chandelier-catch-left', 'rock', 15, 3700, 95, 470),
  rect('zone4-rest', 'rock', 170, 3400, 390, 64),

  // ZONE 5 — FALSE SUMMIT
  rect('false-left-rock', 'rock', 40, 3240, 260, 50, .15),
  rect('false-right-rock', 'rock', 440, 3070, 240, 48, -.2),
  polygon('false-center-crystal', 'crystal', 360, 2920, [{ x: -95, y: 80 }, { x: -35, y: -85 }, { x: 40, y: -110 }, { x: 105, y: 70 }]),
  circle('false-small-rock', 'rock', 175, 2840, 52),
  { ...rect('false-falling-rock', 'rock', 480, 2740, 150, 48, 0, 'fallingRock'), triggerDelay: 450, resetDelay: 4000 },
  rect('false-catch-right', 'rock', 620, 2900, 80, 480),

  // ZONE 6 — CRYSTAL VEIN
  polygon('crystal-left-mass', 'crystal', 120, 2420, [{ x: -100, y: 300 }, { x: -70, y: -280 }, { x: 40, y: -220 }, { x: 100, y: 260 }]),
  polygon('crystal-right-mass', 'crystal', 600, 2250, [{ x: -90, y: 350 }, { x: -55, y: -330 }, { x: 65, y: -250 }, { x: 95, y: 300 }]),
  rect('crystal-rock-01', 'rock', 250, 2530, 145, 42, -.32),
  rect('crystal-rock-02', 'wood', 405, 2320, 145, 34, .35),
  circle('crystal-rock-03', 'rock', 275, 2100, 48),
  rect('crystal-rock-04', 'rock', 420, 1920, 165, 42, -.35),
  rect('crystal-lower-catcher', 'rock', 190, 2630, 350, 52),
  rect('crystal-exit-rest', 'rock', 150, 1730, 420, 62),

  // ZONE 7 — WIND SHAFT
  rect('wind-left-wall', 'ice', 40, 1170, 100, 1150, .03),
  rect('wind-right-wall', 'metal', 580, 1150, 100, 1180, -.03),
  rect('wind-rock-01', 'rock', 160, 1560, 130, 40, .28),
  { ...rect('wind-moving-rock', 'rock', 280, 1360, 150, 42, 0, 'movingPlatform'), moveDistance: 210, moveDuration: 2800 },
  circle('wind-rock-02', 'rock', 470, 1150, 52),
  { ...rect('wind-rotating-wood', 'wood', 200, 970, 300, 30, 0, 'rotatingBeam'), rotationSpeed: -.18 },
  rect('wind-upper-rock', 'rock', 160, 810, 190, 42, .18),

  // ZONE 8 — THE CROWN
  rect('crown-right-rock-01', 'rock', 460, 690, 215, 46, -.2),
  rect('crown-left-metal', 'metal', 40, 560, 260, 38, .25),
  circle('crown-small-rock', 'rock', 345, 475, 46),
  { ...rect('crown-swing', 'wood', 430, 410, 140, 36, 0, 'swingingBlock'), x: 500, anchorX: 500, anchorY: 260, ropeLength: 150 },
  rect('crown-final-rock', 'rock', 150, 280, 210, 44, .18),
  rect('summit-platform', 'rock', 220, 130, 280, 60),
  { ...rect('summit-goal', 'rock', 310, 85, 100, 100, 0, 'goal'), x: 360 },
]

export const AXEBOUND_ZONES = [
  { y: 6250, name: 'THE PIT' },
  { y: 5350, name: 'BROKEN STEPS' },
  { y: 4450, name: 'IRON THROAT' },
  { y: 3500, name: 'THE CHANDELIER' },
  { y: 2700, name: 'FALSE SUMMIT' },
  { y: 1800, name: 'CRYSTAL VEIN' },
  { y: 850, name: 'WIND SHAFT' },
  { y: 0, name: 'THE CROWN' },
] as const

export const isAxeBoundStickable = (material: AxeBoundMaterial) => material === 'rock' || material === 'wood'
