export interface AtlasCard {
  id: string
  name: string
  blurb: string
}

export const ATLAS: readonly AtlasCard[] = [
  { id: 'glacial-spring', name: 'Glacial Spring', blurb: 'A river running against the stone.' },
  { id: 'emerald-canopy', name: 'Emerald Canopy', blurb: 'Six groves or more, watered and still green.' },
  { id: 'sanctuary-valley', name: 'Sanctuary Valley', blurb: 'A meadow touched by water, grove, stone, and wildlife.' },
  { id: 'volcanic-lagoon', name: 'Volcanic Lagoon', blurb: 'Fertile ash drinking from a living spring.' },
  { id: 'crystal-range', name: 'Crystal Range', blurb: 'Three peaks with a spring at their feet.' },
  { id: 'wild-mosaic', name: 'Wild Mosaic', blurb: 'Wildlife in a complete ecosystem beside a peak.' },
  { id: 'ancient-river', name: 'Ancient River', blurb: 'Six springs flowing as one.' },
  { id: 'ash-garden', name: 'Ash Garden', blurb: 'A meadow rooted in fertile ash.' },
  { id: 'living-crown', name: 'Living Crown', blurb: 'All five biomes alive on the land at once.' },
  { id: 'twin-rivers', name: 'Twin Rivers', blurb: 'Two separate rivers sharing the mosaic.' },
  { id: 'fauna-procession', name: 'Fauna Procession', blurb: 'Three creatures, each with water or a grove.' },
  { id: 'seeded-estuary', name: 'Seeded Estuary', blurb: 'A river that still touches the Ancient Seed.' },
]

const KNOWN = new Set(ATLAS.map((card) => card.id))

export function isAtlasId(value: string): boolean {
  return KNOWN.has(value)
}

export function atlasCard(id: string): AtlasCard | undefined {
  return ATLAS.find((card) => card.id === id)
}
