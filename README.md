# defrag-tool

*A Big0Time Project*

**DEFRAG.EXE** — an MS-DOS-styled disk defragmentation simulator (Haunted
Edition). A fake FAT-32 volume defrags itself cluster-by-cluster in your
browser, with a minesweeper-flavored chaos layer laid on top: bombs, flagged
sectors that deploy a Pac-Man-style chomper, and `?` sectors that leak
anomalous emoji across the drive.

## What's new

Inspired by [defrag98.com](https://defrag98.com)'s Windows-98 defrag
simulator (real HDD audio, a multi-drive selector):

- **Procedural HDD audio** — seek clicks, explosions, chomps, and a
  completion chime, synthesized with the Web Audio API (no shipped audio
  assets). Toggle with `[M]` or the `[Sound]` control.
- **Multi-drive selector** — switch between four drives (`C:`/`D:`/`E:`/`F:`)
  with distinct capacities, filesystems, and fill levels via `[1]`-`[4]` or
  the drive tabs.
- **Chaos Mode toggle** — turn the bombs/flags/`?`/chomper layer on or off
  with `[C]` or the `[Chaos]` control, for a calmer, more authentic defrag
  run.

## Instability

While Chaos Mode is on and anomalies are loose on the drive, the more of
them are active the more they destabilize it — sectors can rearrange,
fall up or down a row, corrupt, vanish, or have phantom data reappear.
Anything that lands on territory the defrag already compacted rewinds
progress there, so a chaotic run genuinely takes longer than a quiet one.
Zero anomalies loose (or Chaos Mode off) means zero disruption.

Pacing is deliberately slow and ambient — about 4 clusters moved per
second on a quiet run — meant to be watched, not raced.

## Development

```bash
npm install
npm run dev       # local dev server
npm run build      # production build -> dist/
npm run preview    # serve the production build locally
```

## Controls

| Key       | Action                          |
|-----------|----------------------------------|
| `P`       | Pause / resume defragmentation   |
| `R`       | Restart                          |
| `1`-`4`   | Select drive C: / D: / E: / F:   |
| `C`       | Toggle Chaos Mode                |
| `M`       | Toggle sound                     |

Click a **FLAG** sector to deploy the chomper, a **BOMB** to detonate it, or
a `?` sector to release its anomalies — all only visible in Chaos Mode.

## Deployment & Repository Status
{}
