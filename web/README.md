# Puddle — Web (Phaser 3 + TypeScript + Vite)

Spike 2 scaffold: loads Level1-1 and renders a playable player placeholder in the browser.

## Prerequisites

- Node.js 18+

## Run locally

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Left/Right arrow keys** to move the player.

## Project structure

```
web/
  src/
    main.ts              — Phaser game config and boot
    scenes/
      GameScene.ts       — Level loading, rendering, and input
  public/
    assets/
      levels/
        Level1-1.json    — Tiled JSON export of Content/Levels/Level1-1.tmx
      images/
        background.png   — Background image (stretched, matching original C# rendering)
        brick.png        — Brick tileset
        PC/
          stand.png      — Player idle sprite
          walk.png       — Player walk spritesheet (4×32px frames)
        Enemies/
          spikeball.png
  scripts/
    tmx-to-json.js       — TMX → Tiled JSON conversion (no external deps)
  index.html
  package.json
  vite.config.ts
  tsconfig.json
```

## TMX → JSON conversion

Phaser 3 does **not** read `.tmx` XML directly. It requires Tiled JSON format via
`this.load.tilemapTiledJSON()`. The pre-converted `Level1-1.json` is committed in
`public/assets/levels/`.

### Re-exporting after level edits

**Option A — Tiled CLI** (if installed):
```bash
tiled --export-map json ../Content/Levels/Level1-1.tmx public/assets/levels/Level1-1.json
```

**Option B — npm script** (no external tools required):
```bash
cd web
npm run convert-levels
```

This runs `scripts/tmx-to-json.js`, a self-contained Node.js XML parser that converts
the TMX format to Tiled JSON. Run it whenever a `.tmx` file is edited in Tiled.

### Gotchas

- The `Background` tile layer in `Level1-1.tmx` has `visible="0"` (hidden in Tiled).
  The original C# game renders `background.png` as a stretched full-screen PNG, not via tile layers.
  The web port matches this: `background.png` is stretched to fill the canvas.
  Phaser tile-layer rendering is vestigial for this project unless the team decides to change the rendering approach.
- TMX tile-object coordinates: `(x, y)` is the **bottom-left** corner of the tile, not the top-left.
  `GameScene.ts` compensates by subtracting half the tile height to compute the center.
- Object types in TMX use fully-qualified C# class names (e.g., `Puddle.Block`, `Puddle.Roller`).
  A factory map will need to handle these names when spawning game entities beyond the spike.

## Build for production

```bash
cd web
npm run build
```

Output: `web/dist/` (static files, ready for Vercel).

## Vercel deployment

See [`vercel.json`](../vercel.json) at the repo root for the deploy configuration.

### Creating the Vercel project

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import from GitHub: select `jakerose27/Puddle`
3. Configure build settings:
   - **Framework Preset:** Other
   - **Build Command:** `cd web && npm install && npm run build`
   - **Output Directory:** `web/dist`
   - **Install Command:** `cd web && npm install`
   - **Root Directory:** leave blank (use repo root)
4. No environment variables are required for the static build
5. Click **Deploy**

Subsequent pushes to `main` (or whichever branch you set) will auto-deploy.
