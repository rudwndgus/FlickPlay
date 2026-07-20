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
  // Segmented outer masonry keeps the silhouette irregular like the reference spire.
  rect('outer-left-01', 'spikeRock', -35, 6750, 75, 900), rect('outer-right-01', 'spikeRock', 680, 6750, 75, 900),
  rect('outer-left-02', 'spikeRock', -35, 5850, 75, 900), rect('outer-right-02', 'spikeRock', 680, 5850, 75, 900),
  rect('outer-left-03', 'spikeRock', -35, 4950, 75, 900), rect('outer-right-03', 'spikeRock', 680, 4950, 75, 900),
  rect('outer-left-04', 'spikeRock', -35, 4050, 75, 900), rect('outer-right-04', 'spikeRock', 680, 4050, 75, 900),
  rect('outer-left-05', 'spikeRock', -35, 3150, 75, 900), rect('outer-right-05', 'spikeRock', 680, 3150, 75, 900),
  rect('outer-left-06', 'spikeRock', -35, 2250, 75, 900), rect('outer-right-06', 'spikeRock', 680, 2250, 75, 900),
  rect('outer-left-07', 'spikeRock', -35, 1350, 75, 900), rect('outer-right-07', 'spikeRock', 680, 1350, 75, 900),
  rect('outer-left-08', 'spikeRock', -35, 450, 75, 900), rect('outer-right-08', 'spikeRock', 680, 450, 75, 900),

  // ZONE 1 — THE PIT: wide recovery basin and the first rotating beam.
  rect('start-floor', 'rock', 40, 7100, 640, 100),
  rect('pit-left-wall', 'rock', 20, 6750, 120, 720, -.03),
  rect('pit-right-wall', 'rock', 570, 6710, 130, 780, .03),
  rect('tutorial-rock-01', 'rock', 430, 6870, 190, 48, -.12),
  rect('tutorial-rock-02', 'rock', 125, 6710, 185, 46, .18),
  { ...rect('pit-rotating-beam', 'wood', 250, 6490, 280, 34, 0, 'rotatingBeam'), rotationSpeed: -.2 },
  rect('tutorial-rock-03', 'rock', 470, 6450, 180, 46, -.18),
  rect('zone1-rest', 'rock', 195, 6260, 330, 60),

  // ZONE 2 — THE CHANDELIER: right-hand tower, rotating timber and two pendulums.
  rect('chandelier-left-catch', 'rock', 40, 6090, 230, 54, .12),
  { ...rect('chandelier-rotating-wood', 'wood', 170, 5920, 270, 34, 0, 'rotatingBeam'), rotationSpeed: .23 },
  rect('chandelier-right-step-01', 'rock', 500, 5990, 175, 50, -.14),
  rect('chandelier-right-tower', 'rock', 545, 5740, 150, 430, .02),
  { ...rect('chandelier-swing-01', 'metal', 380, 5800, 92, 68, 0, 'swingingBlock'), x: 426, anchorX: 426, anchorY: 5570, ropeLength: 230 },
  { ...rect('chandelier-swing-02', 'rock', 245, 5630, 112, 66, 0, 'swingingBlock'), x: 301, anchorX: 301, anchorY: 5430, ropeLength: 200 },
  rect('chandelier-mid-step', 'wood', 115, 5660, 170, 34, .26),
  rect('chandelier-exit-rest', 'rock', 180, 5390, 360, 60),

  // ZONE 3 — BROKEN STEPS: crumbling staggered ruins and shifting footholds.
  rect('step-left-ruin', 'rock', 40, 5120, 180, 470, -.02),
  rect('step-left-01', 'rock', 70, 5260, 215, 48, .12),
  { ...rect('step-moving-01', 'rock', 255, 5100, 155, 44, 0, 'movingPlatform'), moveDistance: 220, moveDuration: 3200 },
  rect('step-right-01', 'rock', 460, 4930, 220, 50, -.14),
  rect('step-center-01', 'rock', 260, 4760, 170, 46, .18),
  rect('step-left-metal', 'metal', 45, 4660, 155, 34, -.08),
  rect('step-right-02', 'wood', 460, 4580, 185, 34, -.2),
  rect('zone2-rest', 'rock', 170, 4470, 380, 62),

  // ZONE 4 — CRYSTAL VEIN: unforgiving right wall and a narrow safe zig-zag.
  polygon('crystal-right-lower', 'crystal', 590, 4210, [{ x: -80, y: 330 }, { x: -45, y: -320 }, { x: 28, y: -270 }, { x: 92, y: 300 }]),
  polygon('crystal-right-upper', 'crystal', 610, 3750, [{ x: -95, y: 300 }, { x: -55, y: -310 }, { x: 38, y: -260 }, { x: 88, y: 280 }]),
  rect('crystal-metal-rib', 'metal', 625, 4050, 58, 690, -.02),
  rect('crystal-lower-catcher', 'rock', 45, 4380, 330, 54, .08),
  rect('crystal-rock-01', 'rock', 300, 4230, 145, 44, -.26),
  rect('crystal-rock-02', 'wood', 125, 4040, 170, 34, .3),
  circle('crystal-rock-03', 'rock', 395, 3880, 54),
  rect('crystal-rock-04', 'rock', 175, 3700, 180, 44, -.25),
  rect('crystal-exit-rest', 'rock', 340, 3510, 270, 58),

  // ZONE 5 — IRON THROAT: a narrow metal choke with one rotating timber.
  rect('iron-left-wall', 'metal', 55, 3070, 105, 900, .025),
  rect('iron-right-wall', 'metal', 555, 3070, 105, 900, -.025),
  rect('iron-bottom-catcher', 'rock', 170, 3430, 370, 54),
  rect('iron-rock-01', 'rock', 190, 3290, 145, 44, -.2),
  { ...rect('iron-rotating-wood', 'wood', 205, 3080, 310, 34, 0, 'rotatingBeam'), rotationSpeed: -.17 },
  rect('iron-rock-02', 'rock', 430, 2920, 140, 44, .2),
  circle('iron-rock-03', 'rock', 260, 2770, 50),
  rect('iron-exit-rest', 'rock', 150, 2600, 420, 62),

  // ZONE 6 — WIND SHAFT: non-stick walls, crystal teeth and a moving lift.
  rect('wind-left-wall', 'rock', 40, 2180, 105, 780, .02),
  rect('wind-right-wall', 'ice', 585, 2170, 100, 900, -.02),
  polygon('wind-crystal-teeth', 'crystal', 535, 2150, [{ x: -35, y: 360 }, { x: -70, y: 180 }, { x: -25, y: 40 }, { x: -65, y: -100 }, { x: -20, y: -340 }, { x: 55, y: -320 }, { x: 65, y: 340 }]),
  rect('wind-rock-01', 'rock', 155, 2490, 140, 42, .24),
  { ...rect('wind-moving-rock', 'metal', 270, 2300, 180, 34, 0, 'movingPlatform'), moveDistance: 230, moveDuration: 2800 },
  rect('wind-rock-02', 'wood', 405, 2110, 145, 34, -.22),
  circle('wind-rock-03', 'rock', 245, 1940, 50),
  rect('wind-upper-rock', 'rock', 390, 1760, 200, 46, -.16),

  // ZONE 7 — FALSE SUMMIT: a tempting shelf that collapses into the shaft.
  rect('false-left-rock', 'rock', 45, 1600, 260, 52, .12),
  rect('false-right-rock', 'rock', 440, 1450, 235, 48, -.18),
  polygon('false-center-crystal', 'crystal', 355, 1300, [{ x: -90, y: 75 }, { x: -30, y: -90 }, { x: 42, y: -105 }, { x: 100, y: 65 }]),
  { ...rect('false-falling-rock', 'rock', 445, 1140, 165, 48, 0, 'fallingRock'), triggerDelay: 420, resetDelay: 4000 },
  circle('false-small-rock', 'rock', 185, 990, 52),
  rect('false-narrow-wood', 'wood', 340, 870, 165, 34, .28),
  rect('false-exit-rest', 'rock', 115, 760, 420, 60),

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
  { y: 5350, name: 'THE CHANDELIER' },
  { y: 4550, name: 'BROKEN STEPS' },
  { y: 3500, name: 'CRYSTAL VEIN' },
  { y: 2600, name: 'IRON THROAT' },
  { y: 1700, name: 'WIND SHAFT' },
  { y: 750, name: 'FALSE SUMMIT' },
  { y: 0, name: 'THE CROWN' },
] as const

export const isAxeBoundStickable = (material: AxeBoundMaterial) => material === 'rock' || material === 'wood'
