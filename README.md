# Hexora

A relaxing strategy puzzle about ecological balance on a hexagonal board. Springs, groves, meadows, stone, and wildlife each help the land — and each can tip it. The game runs entirely in the browser: canvas rendering, synthesized sound, and local saves. Nothing is downloaded, and nothing leaves the device.

## Play

You start with the Ancient Seed and one biome to place. Lay it on any open hex touching the living land. A ghost of the tile shows the points, in green, or the trouble, in red, before you commit. The next two biomes wait in the queue.

- Drag the board to look around. Scroll or pinch to zoom. Double-click, or press `0`, to recenter.
- Harmony starts full. Synergies restore it. Flood, drought, landslide, and extinction crack it. At zero, the mosaic ends.
- Score milestones turn the season — Spring, Summer, Autumn, Winter — and grant a restoration wildcard. Spend it to clear or transform one hex.
- **Zen** is an endless run against your best score.
- **Daily** deals the same 40 tiles to everyone on that calendar date. At the end, share a small emoji grid.

Sound is generated in the browser. The first tap wakes it. Mute lives in the top bar, next to day and night. The crown opens the Hexora Zen Pass: a $2.99 preview unlock that removes ads and adds the Kyoto Autumn and Deep Coral Reef palettes. On a phone, a finger that moves less than 10 pixels places a tile. A longer drag pans the land, and two fingers pinch to zoom.

## Run locally

```bash
npm install
npm run dev
```

Vite serves the game on port **4731**.

```bash
npm run build
npm run preview
npm run check
```

`npm run check` replays the placement rules: rivers, floods, drought, landslides, extinctions, milestones, and the daily seed.

Scores, streaks, the current board, settings, and the Zen Pass flag are stored in `localStorage` under the `hexora_` prefix.

## Android

The native project is Capacitor. Web builds land in `dist`, and the Android app id is `com.hexora.game`.

```bash
npm run build
npx cap sync android
```

Open the `android` folder in Android Studio and run it on a device or emulator. Haptics use `@capacitor/haptics` on device and stay silent in a browser. Rewarded ads and the Zen Pass purchase run in preview mode until AdMob and RevenueCat keys are set in `src/game/monetization.ts`.
