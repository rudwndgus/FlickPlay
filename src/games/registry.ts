import { games } from './gameDefinitions'

const ids = new Set(games.map((game) => game.id))
if (ids.size !== games.length) throw new Error('FlickPlay game IDs must be unique')

export const gameRegistry = Object.freeze(games)
