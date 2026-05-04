# ash history

## Project Context
Project: Puddle
Language/Stack: C# MonoGame (SDL2, TiledSharp, XNA pattern)
Goal: Port to browser, deploy to Vercel
Branch: squad/web-port-spike
Owner: Jake
Approach: Docs-first. No big rewrites until feasibility is documented in docs/web-port-feasibility.md.
Key files: Game1.cs (game loop), Program.cs (entry point), Level.cs, Controls.cs, Content/ (assets), SDL.dll, TiledSharp.dll

## Learnings

### 2026-05-03T18:23:24.325-07:00 — Feasibility Review: docs/web-port-feasibility.md
**Task:** Gate review of Option 2 (TypeScript + Phaser 3) before spike commitment.
**Verdict:** REJECTED

**Critical finding:** Phaser 3 does NOT natively read `.tmx` XML files. It requires Tiled JSON export (`tilemapTiledJSON`). The doc claims "Phaser 3 has a built-in Tiled map loader supporting TMX and JSON" — this is factually incorrect and propagates through the asset transfer claim and spike pass criteria. The spike criterion "Phaser 3 project loads Level1-1.tmx" would fail by definition.

**Secondary findings:**
- Object `type` attributes confirmed as fully-qualified: `Puddle.Geyser`, `Puddle.Roller`, etc. Doc already flags this correctly.
- Delta-time physics risk (frame-rate coupling) is absent from Option 2 risk table despite being flagged as medium complexity in repo-map.
- `Background` tile layer in TMX is marked `visible="0"` — no visual impact, but spike pass criteria reference "renders tile layer" ambiguously.
- Vercel/Vite claim is broadly accurate.
- WAV large music track memory loading not flagged as a risk.

