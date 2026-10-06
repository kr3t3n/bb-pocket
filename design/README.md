# BB Pocket identity

The Pocket mark preserves the distinctive interlocking, italic `bb` silhouette of BB's official application icon. `bb-official-reference.png` was obtained from the running BB application's `/apple-touch-icon.png`; `bb-trace.svg` is its vector silhouette. The simple open seam below the mark adds a pocket cue without changing the BB letterforms.

The primary wordmark is `../public/logo.svg`: mint BB symbol, muted mint seam, and warm white outlined Poppins Medium lettering. It has a transparent background and needs a dark surface. All lettering is vector geometry; clients need no font files.

The app icon uses the same mark on a forest gradient. The 192px, 512px and Apple 180px PNGs have opaque, full-bleed backgrounds so the operating system can apply its own icon mask. Foreground geometry fits within the maskable safe zone. The 32px favicon and SVG use rounded corners.

## Assets

- `../public/logo.svg` — transparent horizontal wordmark
- `../public/icon.svg` — 512px vector app icon
- `../public/icon-192.png`, `../public/icon-512.png` — PWA install assets
- `../public/apple-touch-icon.png` — 180px iOS install asset
- `../public/favicon-32.png` — compact browser icon
- `bb-mark.svg` — standalone original BB silhouette, recolored mint
- `brand-preview.png` — visual review of wordmark and icon at multiple sizes

## Regenerate

The SVGs are the canonical production assets. `node design/render-brand.mjs` regenerates the PNG sizes and visual preview using the repository's Playwright package and the host Chromium. Set `CHROMIUM_PATH` to use a different Chromium executable.

`create-brand.py` records vector assembly and the outlined lettering source. Re-running this optional construction step requires Python fontTools and Poppins Medium installed at the path named in the script. Tracing is already complete and requires no extra tools for normal PNG regeneration.
