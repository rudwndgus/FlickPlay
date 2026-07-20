export const AXEBOUND_WORLD_WIDTH = 720
export const AXEBOUND_SECTION_HEIGHT = 1440
export const AXEBOUND_WORLD_HEIGHT = 8640
export const AXEBOUND_FLOOR_Y = 8520
export const AXEBOUND_SUMMIT_Y = 100
export const AXEBOUND_MAP_SOURCE_WIDTH = 941
export const AXEBOUND_MAP_SOURCE_HEIGHT = 1672
export const AXEBOUND_MAP_CROP_X = 110
export const AXEBOUND_MAP_CROP_WIDTH = 720

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

const SOURCE_Y_SCALE = AXEBOUND_SECTION_HEIGHT / AXEBOUND_MAP_SOURCE_HEIGHT
const MAP_COUNT = 6
const imageTop = (image: number) => (MAP_COUNT - image) * AXEBOUND_SECTION_HEIGHT
const sourceSurface = (image: number, id: string, material: AxeBoundMaterial, left: number, top: number, width: number, height = 34, type: AxeBoundObjectType = 'rect') =>
  rect(id, material, left - AXEBOUND_MAP_CROP_X, imageTop(image) + (top + height / 2) * SOURCE_Y_SCALE, width, height * SOURCE_Y_SCALE, 0, type)

export const AXEBOUND_LEVEL_OBJECTS: readonly AxeBoundLevelObject[] = [
  ...Array.from({ length: MAP_COUNT }, (_, index) => {
    const top = index * AXEBOUND_SECTION_HEIGHT
    return [rect(`outer-left-s${MAP_COUNT - index}`, 'rock', -28, top + AXEBOUND_SECTION_HEIGHT / 2, 56, AXEBOUND_SECTION_HEIGHT), rect(`outer-right-s${MAP_COUNT - index}`, 'rock', 692, top + AXEBOUND_SECTION_HEIGHT / 2, 56, AXEBOUND_SECTION_HEIGHT)]
  }).flat(),

  // Map 1: every visible floor and ledge, from the flooded basin upward.
  sourceSurface(1, 's1-top-bridge', 'wood', 470, 48, 175, 30),
  sourceSurface(1, 's1-upper-left', 'rock', 105, 205, 400, 42), sourceSurface(1, 's1-upper-center', 'wood', 390, 365, 120, 30),
  sourceSurface(1, 's1-high-left', 'rock', 105, 520, 300, 44), sourceSurface(1, 's1-high-right', 'rock', 515, 650, 325, 44),
  sourceSurface(1, 's1-mid-right', 'rock', 540, 820, 300, 44), sourceSurface(1, 's1-mid-left', 'rock', 110, 1035, 300, 44),
  sourceSurface(1, 's1-low-right', 'rock', 490, 1115, 350, 44), sourceSurface(1, 's1-low-left', 'rock', 85, 1195, 190, 42),
  sourceSurface(1, 's1-right-tower', 'rock', 620, 1375, 220, 46),
  sourceSurface(1, 'start-floor', 'rock', 80, 1488, 320, 50), sourceSurface(1, 's1-bottom-right', 'rock', 585, 1488, 255, 50),
  sourceSurface(1, 'section1-floor', 'rock', 80, 1530, 760, 58),

  // Map 2: the alternating crystal ruins.
  sourceSurface(2, 's2-bottom-bridge', 'wood', 235, 1590, 500, 38),
  sourceSurface(2, 's2-low-left', 'rock', 235, 1355, 205, 42), sourceSurface(2, 's2-low-right', 'rock', 525, 1275, 285, 42),
  sourceSurface(2, 's2-lower-left', 'rock', 230, 1095, 295, 42), sourceSurface(2, 's2-lower-right', 'rock', 555, 975, 270, 42),
  sourceSurface(2, 's2-center-left', 'rock', 235, 895, 205, 40), sourceSurface(2, 's2-center-crate', 'wood', 455, 930, 105, 38),
  sourceSurface(2, 's2-center-right', 'rock', 510, 705, 315, 42), sourceSurface(2, 's2-center-step', 'wood', 438, 550, 125, 34),
  sourceSurface(2, 's2-high-left', 'rock', 215, 485, 255, 42), sourceSurface(2, 's2-high-right', 'rock', 445, 325, 380, 42),
  sourceSurface(2, 's2-top-left', 'rock', 235, 160, 260, 42),

  // Map 3: iron shaft scaffolds and small catch ledges.
  sourceSurface(3, 's3-bottom-left', 'rock', 155, 1495, 325, 46), sourceSurface(3, 's3-bottom-right', 'rock', 535, 1445, 285, 44),
  sourceSurface(3, 's3-low-step', 'metal', 425, 1315, 145, 34), sourceSurface(3, 's3-low-left', 'rock', 175, 1145, 325, 44),
  sourceSurface(3, 's3-low-right', 'rock', 535, 975, 295, 44), sourceSurface(3, 's3-right-step', 'metal', 545, 1068, 90, 32),
  sourceSurface(3, 's3-mid-left', 'rock', 190, 795, 305, 44), sourceSurface(3, 's3-mid-right', 'metal', 740, 875, 100, 34),
  sourceSurface(3, 's3-left-step', 'metal', 165, 655, 105, 34), sourceSurface(3, 's3-right-landing', 'metal', 770, 595, 80, 34),
  sourceSurface(3, 's3-center-crate', 'wood', 420, 555, 105, 42), sourceSurface(3, 's3-center-step', 'metal', 270, 475, 90, 30),
  sourceSurface(3, 's3-upper-right', 'rock', 595, 305, 260, 44), sourceSurface(3, 's3-upper-left', 'wood', 185, 225, 300, 38),

  // Map 4: the chandelier hall, including every suspended landing.
  sourceSurface(4, 's4-bottom-left', 'rock', 165, 1590, 315, 46), sourceSurface(4, 's4-bottom-right', 'rock', 745, 1525, 120, 42),
  sourceSurface(4, 's4-low-right', 'rock', 520, 1445, 310, 44), sourceSurface(4, 's4-low-left', 'rock', 95, 1295, 320, 44),
  sourceSurface(4, 's4-lower-right', 'rock', 610, 1290, 240, 44), sourceSurface(4, 's4-lower-left', 'rock', 90, 1145, 280, 42),
  sourceSurface(4, 's4-right-step', 'rock', 680, 1070, 170, 42), sourceSurface(4, 's4-chandelier', 'wood', 420, 990, 220, 40),
  sourceSurface(4, 's4-mid-left', 'rock', 90, 945, 325, 44), sourceSurface(4, 's4-hanging-left', 'metal', 190, 805, 175, 34),
  sourceSurface(4, 's4-hanging-right', 'metal', 745, 810, 105, 34), sourceSurface(4, 's4-high-left', 'rock', 85, 695, 340, 44),
  sourceSurface(4, 's4-high-center', 'wood', 235, 555, 205, 38), sourceSurface(4, 's4-high-right', 'rock', 745, 560, 110, 42),
  sourceSurface(4, 's4-upper-center', 'wood', 315, 345, 205, 38), sourceSurface(4, 's4-upper-right', 'rock', 640, 345, 145, 42),
  sourceSurface(4, 's4-top-left', 'rock', 65, 215, 250, 44), sourceSurface(4, 's4-top-right', 'rock', 755, 175, 120, 42),

  // Map 5: the dense crystal ascent.
  sourceSurface(5, 's5-bottom-left', 'rock', 205, 1445, 245, 44), sourceSurface(5, 's5-bottom-right', 'rock', 495, 1395, 335, 44),
  sourceSurface(5, 's5-bottom-lift', 'wood', 425, 1345, 120, 34), sourceSurface(5, 's5-low-left', 'rock', 205, 1145, 325, 44),
  sourceSurface(5, 's5-low-center', 'wood', 495, 1115, 150, 36), sourceSurface(5, 's5-low-right', 'rock', 595, 1015, 245, 44),
  sourceSurface(5, 's5-center-step', 'wood', 395, 945, 130, 34), sourceSurface(5, 's5-center-left', 'rock', 210, 745, 300, 44),
  sourceSurface(5, 's5-center-right', 'rock', 690, 715, 160, 42), sourceSurface(5, 's5-high-left', 'rock', 195, 555, 225, 44),
  sourceSurface(5, 's5-high-center', 'metal', 575, 545, 135, 34), sourceSurface(5, 's5-high-right', 'rock', 725, 515, 125, 42),
  sourceSurface(5, 's5-upper-left', 'rock', 200, 315, 310, 44), sourceSurface(5, 's5-upper-right', 'rock', 550, 275, 300, 44),
  sourceSurface(5, 's5-top-lift', 'wood', 440, 95, 220, 36),

  // Map 6: the final crown chamber.
  sourceSurface(6, 's6-bottom-step', 'rock', 405, 1630, 205, 42), sourceSurface(6, 's6-bottom-left', 'rock', 95, 1390, 335, 46),
  sourceSurface(6, 's6-bottom-right', 'rock', 690, 1390, 185, 44), sourceSurface(6, 's6-low-center', 'rock', 325, 1510, 255, 42),
  sourceSurface(6, 's6-low-right', 'rock', 600, 1245, 250, 44), sourceSurface(6, 's6-lower-left', 'rock', 130, 995, 310, 44),
  sourceSurface(6, 's6-lower-center', 'rock', 430, 995, 390, 44), sourceSurface(6, 's6-center-step', 'wood', 430, 895, 135, 34),
  sourceSurface(6, 's6-mid-left', 'rock', 130, 745, 310, 44), sourceSurface(6, 's6-mid-right', 'rock', 680, 745, 135, 42),
  sourceSurface(6, 's6-high-left', 'rock', 125, 645, 165, 42), sourceSurface(6, 's6-high-center', 'wood', 350, 645, 170, 36),
  sourceSurface(6, 's6-high-right', 'rock', 735, 640, 130, 42), sourceSurface(6, 's6-upper-center', 'wood', 430, 445, 240, 38),
  sourceSurface(6, 'summit-platform', 'rock', 240, 240, 470, 52), sourceSurface(6, 'summit-goal', 'rock', 420, 165, 110, 110, 'goal'),
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
