"""Build BB Pocket vectors from the official BB silhouette and outlined type."""
from pathlib import Path
import xml.etree.ElementTree as ET
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
root=Path(__file__).resolve().parents[1]
source=ET.parse(root/'design/bb-trace.svg').getroot()
p=source.find('{http://www.w3.org/2000/svg}path')
mark=f'<path d="{p.attrib["d"]}" transform="{p.attrib["transform"]}" fill-rule="evenodd"/>'
(root/'design/bb-mark.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 20 150 128" fill="#bcebc4">{mark}</svg>\n')
icon=f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="BB Pocket">
<title>BB Pocket</title>
<defs><radialGradient id="background" cx=".18" cy=".1" r="1.1"><stop stop-color="#284334"/><stop offset=".72" stop-color="#15221b"/><stop offset="1" stop-color="#121615"/></radialGradient><linearGradient id="mint" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#e1f9e6"/><stop offset="1" stop-color="#9ed2ad"/></linearGradient></defs>
<rect width="512" height="512" rx="112" fill="url(#background)"/>
<g transform="translate(60 63) scale(2.2)" fill="url(#mint)">{mark}</g>
<path d="M115 378 241 418Q256 423 271 418L397 378" fill="none" stroke="#bcebc4" stroke-opacity=".65" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
</svg>\n'''
(root/'public/icon.svg').write_text(icon)
font=TTFont('/home/bb/.local/share/fonts/deckfonts/Poppins-Medium.ttf')
glyphs=font.getGlyphSet(); cmap=font.getBestCmap(); x=0; paths=[]
for ch in 'Pocket':
 name=cmap[ord(ch)]; pen=SVGPathPen(glyphs);glyphs[name].draw(pen)
 paths.append(f'<path d="{pen.getCommands()}" transform="translate({x} 0)"/>')
 x+=font['hmtx'][name][0]-15
scale=64/font['head'].unitsPerEm
width=round(122+x*scale+3)
logo=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="104" viewBox="0 0 {width} 104" role="img" aria-label="BB Pocket"><title>BB Pocket</title><g fill="#bcebc4" transform="translate(-12 -6) scale(.66)">{mark}</g><path d="M17 92 47 102Q51 103 55 102L85 92" fill="none" stroke="#bcebc4" stroke-opacity=".65" stroke-width="2.4" stroke-linecap="round"/><g fill="#edf3ee" transform="translate(119 79) scale({scale} {-scale})">{''.join(paths)}</g></svg>\n'''
(root/'public/logo.svg').write_text(logo)
