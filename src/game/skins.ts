import type { Biome, SkinName, ThemeName } from './types'

export interface Paint {
  face: [string, string]
  ink: string
  glow: string
}

/** Tile colors only. Placement rules never read these. */
const CLASSIC: Record<Biome, Paint> = {
  water: { face: ['#b7eef4', '#2a9eb4'], ink: '#0e5c6b', glow: '#7ed7e4' },
  forest: { face: ['#9ed7a4', '#1f7a45'], ink: '#0d3d24', glow: '#7dcaa0' },
  meadow: { face: ['#e7ef9a', '#c4a43a'], ink: '#5c4a12', glow: '#e4d56a' },
  mountain: { face: ['#d9d4ea', '#6d6884'], ink: '#3a3650', glow: '#c4bddf' },
  fauna: { face: ['#f8c2ae', '#d4654a'], ink: '#6e2e22', glow: '#f0a48a' },
}

const KYOTO: Record<Biome, Paint> = {
  water: { face: ['#d5e4ea', '#3d6d86'], ink: '#1a3344', glow: '#9ec4d4' },
  forest: { face: ['#e7a08a', '#8c3a32'], ink: '#4a1c16', glow: '#e8b4a0' },
  meadow: { face: ['#f3e2a0', '#c47a2a'], ink: '#5c3a10', glow: '#f0d080' },
  mountain: { face: ['#d9d2c8', '#5c564e'], ink: '#2e2a26', glow: '#cfc6ba' },
  fauna: { face: ['#f0b08a', '#c45a32'], ink: '#5c2818', glow: '#f0c0a0' },
}

const REEF: Record<Biome, Paint> = {
  water: { face: ['#b8f0ea', '#1a8a96'], ink: '#084850', glow: '#7ad8e0' },
  forest: { face: ['#8fd4c0', '#1e6e62'], ink: '#0c3a34', glow: '#7ec8b4' },
  meadow: { face: ['#f6e2c4', '#d08a6a'], ink: '#6a3c2c', glow: '#f0c8a8' },
  mountain: { face: ['#c9d4e4', '#3d5270'], ink: '#1c2c44', glow: '#a8bdd4' },
  fauna: { face: ['#ffb0a0', '#e25a6a'], ink: '#6e2030', glow: '#ffb0b8' },
}

const CORES: Record<SkinName, Paint> = {
  classic: { face: ['#f8e7b8', '#d4a24c'], ink: '#6a4a16', glow: '#e8c46a' },
  kyoto: { face: ['#f6e2c4', '#c47a3a'], ink: '#6a3a16', glow: '#e8a060' },
  reef: { face: ['#e7f7f4', '#3aa8b0'], ink: '#0e4a52', glow: '#7ad4dc' },
}

const PAINTS: Record<SkinName, Record<Biome, Paint>> = {
  classic: CLASSIC,
  kyoto: KYOTO,
  reef: REEF,
}

const DAY: Record<SkinName, string[][]> = {
  classic: [
    ['#f4efe6', '#d7ebdf', '#f6d5e2', '#efe3c8'],
    ['#f7f1d4', '#f0dc93', '#d5e6c0', '#f8e6bf'],
    ['#f6ebdd', '#efc49a', '#e7d0bf', '#f4dec4'],
    ['#eef3f6', '#d5e4ee', '#e6eef3', '#f7f4ee'],
  ],
  kyoto: [
    ['#f6efe4', '#f0d2c0', '#f6c8b0', '#f3e2c4'],
    ['#f8f0e2', '#e8c48a', '#d9a06a', '#f2d8b0'],
    ['#f4e4d4', '#e09070', '#c45a48', '#e8c8a0'],
    ['#f3eee8', '#e4d4c8', '#d8c4b4', '#efe6dc'],
  ],
  reef: [
    ['#e7f6f4', '#b7e6e0', '#f6cfc4', '#d7efe8'],
    ['#e4f4f2', '#8fd4c8', '#f0d0b8', '#c8ebe4'],
    ['#e8f3f2', '#7ec8c0', '#f0b8b0', '#d0e8e4'],
    ['#e6f2f4', '#b8d8e4', '#d4e8ee', '#eef6f6'],
  ],
}

const NIGHT: Record<SkinName, string[][]> = {
  classic: [
    ['#121816', '#1c2e26', '#2a1e26', '#18221c'],
    ['#16140f', '#2c2816', '#182820', '#241e14'],
    ['#1a1410', '#2c1c14', '#241c16', '#1c1814'],
    ['#101418', '#1a2832', '#182228', '#141a1e'],
  ],
  kyoto: [
    ['#140e0c', '#2a1612', '#3a2018', '#1c1210'],
    ['#16100c', '#3a2214', '#2a1810', '#241610'],
    ['#1a100c', '#4a2418', '#2c1814', '#1c1210'],
    ['#12100e', '#2a221c', '#1c1814', '#161412'],
  ],
  reef: [
    ['#071418', '#0e2c32', '#1a2438', '#0c2024'],
    ['#07161a', '#0e3030', '#16303a', '#0c1c22'],
    ['#08141a', '#123038', '#1a2834', '#0c1a20'],
    ['#061216', '#102430', '#142028', '#0a161c'],
  ],
}

export const SKIN_INFO: Record<SkinName, { name: string; note: string }> = {
  classic: { name: 'Classic', note: 'Soft cream and living green.' },
  kyoto: { name: 'Kyoto Autumn', note: 'Maple, persimmon, and warm stone.' },
  reef: { name: 'Deep Coral Reef', note: 'Lagoon water and living coral.' },
}

export function biomePaint(skin: SkinName, biome: Biome): Paint {
  return PAINTS[skin][biome]
}

export function corePaint(skin: SkinName): Paint {
  return CORES[skin]
}

export function seasonTable(theme: ThemeName, skin: SkinName): string[][] {
  return theme === 'night' ? NIGHT[skin] : DAY[skin]
}

export function statusBarColor(theme: ThemeName, skin: SkinName): string {
  return seasonTable(theme, skin)[0]?.[0] ?? (theme === 'night' ? '#121816' : '#f4efe4')
}
