# Character illustrations — drop your art here

Drop **five** illustration files in this folder, one per timer state. They are
auto-detected at build time, recolored to the app's monochrome ink, and made
theme-aware (they follow light/dark). No code changes needed.

## Filenames (exact, lowercase)

| File            | Shown when…                    | Good pose (e.g. Open Doodles) |
| --------------- | ------------------------------ | ----------------------------- |
| `ready.svg`     | idle, ready to start           | Coffee / Meditating           |
| `focus.svg`     | a focus session is running     | Reading / Sitting / Working   |
| `break.svg`     | a short break is running       | Stretching / Loving           |
| `long.svg`      | a long break is running        | Lying down / Sleeping         |
| `complete.svg`  | (optional) celebratory accent  | Jumping / Dancing             |

`.png`, `.jpg`, and `.webp` also work, but **SVG is strongly preferred** — it
stays crisp and recolors perfectly to the monochrome theme. Any file that isn't
present falls back to the built-in drawing.

## Where to get license-clean art

- **Open Doodles** — https://www.opendoodles.com — CC0 (public domain),
  hand-drawn, full-body poses that match the states above. Download the SVGs and
  rename them per the table.
- **Open Peeps** — https://www.openpeeps.com — CC0, mix-and-match people.
- Or export your own 5 from Canva / Figma / Illustrator as SVG.

## Cropping a sheet + vectorizing (optional helpers)

If you have a *sheet* of characters, drop it here as `_source.png` (or `.jpg`)
and let the helpers slice + clean it:

```bash
npm run illos:crop                 # extracts each character → _tiles/ + _contact-sheet.png
npm run illos:crop ready=1 focus=13 break=12 long=14 complete=10   # assign tiles → states
```

Cropped rasters can look grainy (JPG artifacts, low-res source). Trace them to
crisp, resolution-independent SVG:

```bash
npm i potrace --no-save --ignore-scripts   # pure-JS tracer (one-time)
npm run illos:vectorize                     # <state>.png → <state>.svg (removes the .png)
```

## How recoloring works

For SVGs, every solid `fill`/`stroke` colour is remapped to `currentColor`, so
the art renders in the theme's ink (black on light, white on dark) — matching the
strict black-and-white design. Keep art as flat line/solid shapes for best
results; heavy gradients/photos won't translate to monochrome.

Raster files (PNG/JPG) are shown grayscale and inverted in dark mode — fine for
black-line-on-transparent art, but SVG looks better.
