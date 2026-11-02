"""Render the README diagrams (diagrams/*.mmd) to animated SVG files.

GitHub draws Mermaid blocks as static images, so the README shows these SVGs instead.
Mermaid runs in headless Chrome; the script then adds a light card background and CSS
animations (marching edges, glowing nodes, messages appearing in order). Everything
stays visible when animations are off or the viewer prefers reduced motion.

    python3 docs/images/readme/build_diagrams.py        # needs Google Chrome and internet (Mermaid from jsDelivr)
"""

import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCES = HERE / "diagrams"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
MERMAID = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs"
FONT = '-apple-system, "Segoe UI", Helvetica, Arial, sans-serif'

CONFIG = {
    "startOnLoad": False,
    "theme": "base",
    "htmlLabels": False,
    "flowchart": {"htmlLabels": False, "curve": "basis"},
    "fontFamily": FONT,
    "themeVariables": {
        "fontFamily": FONT,
        "fontSize": "15px",
        "background": "#f8efe1",
        "primaryColor": "#fffaf2",
        "primaryBorderColor": "#b5651d",
        "primaryTextColor": "#3b1f08",
        "secondaryColor": "#f3dfc0",
        "tertiaryColor": "#f8efe1",
        "lineColor": "#b5651d",
        "textColor": "#3b1f08",
        "clusterBkg": "#f3e4cc",
        "clusterBorder": "#d9b27c",
        "edgeLabelBackground": "#f8efe1",
        "actorBkg": "#fffaf2",
        "actorBorder": "#b5651d",
        "actorTextColor": "#3b1f08",
        "signalColor": "#8a4513",
        "signalTextColor": "#3b1f08",
        "labelBoxBkgColor": "#f3dfc0",
        "labelBoxBorderColor": "#b5651d",
        "noteBkgColor": "#f3dfc0",
        "activationBkgColor": "#f3dfc0",
        "sequenceNumberColor": "#fffaf2",
        "attributeBackgroundColorOdd": "#fffaf2",
        "attributeBackgroundColorEven": "#f8efe1",
    },
}

ANIMATION = """
  .cv-edge { stroke-dasharray: 9 7 !important; animation: cv-march 1.1s linear infinite; }
  @keyframes cv-march { to { stroke-dashoffset: -16; } }
  .cv-node { animation: cv-glow 6s ease-in-out infinite; }
  @keyframes cv-glow { 0%, 14%, 100% { filter: none; } 6% { filter: drop-shadow(0 0 6px #e08a2e); } }
  .cv-step { animation: cv-step 14s ease-in-out infinite both; }
  @keyframes cv-step { 0% { opacity: 0; } 4%, 80% { opacity: 1; } 92%, 100% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .cv-edge, .cv-node, .cv-step { animation: none; } }
"""

EDGE_CLASSES = ("flowchart-link", "transition", "relationshipLine", "messageLine0", "messageLine1")


def render(sources: dict[str, str]) -> dict[str, str]:
    """Run Mermaid in headless Chrome and return each SVG as XML text."""
    blocks = "".join(f'<pre class="mermaid" id="src-{n}">{html.escape(t)}</pre>' for n, t in sources.items())
    page = f"""<html><body style="width:1400px">{blocks}<textarea id="out"></textarea>
<script type="module">
import mermaid from "{MERMAID}";
mermaid.initialize({json.dumps(CONFIG)});
const out = {{}};
for (const el of document.querySelectorAll("pre.mermaid")) {{
  const name = el.id.slice(4);
  try {{
    const {{ svg }} = await mermaid.render("cv-" + name, el.textContent);
    const holder = document.createElement("div");
    holder.innerHTML = svg;
    out[name] = new XMLSerializer().serializeToString(holder.firstElementChild);
  }} catch (e) {{
    out[name] = "ERROR " + e;
  }}
}}
document.getElementById("out").textContent = JSON.stringify(out);
</script></body></html>"""
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(page)
    dom = subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--virtual-time-budget=20000", "--dump-dom", f"file://{f.name}"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    match = re.search(r'<textarea id="out">(.*?)</textarea>', dom, re.S)
    if not match or not match.group(1).strip():
        sys.exit("Mermaid produced nothing; check the internet connection and the .mmd files.")
    result: dict[str, str] = json.loads(html.unescape(match.group(1)))
    errors = {n: v for n, v in result.items() if v.startswith("ERROR")}
    if errors:
        sys.exit(f"Mermaid failed: {errors}")
    return result


def _tag(tag: str, cls: str, delay: float) -> str:
    """Add a class and an animation delay to an opening tag, merging with existing attributes."""
    if 'class="' in tag:
        tag = tag.replace('class="', f'class="{cls} ', 1)
    else:
        tag = tag.replace(" ", f' class="{cls}" ', 1)
    if 'style="' in tag:
        return tag.replace('style="', f'style="animation-delay:{delay:.1f}s;', 1)
    return tag.replace(" ", f' style="animation-delay:{delay:.1f}s" ', 1)


def animate(svg: str, name: str) -> str:
    view = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]  # type: ignore[union-attr]
    x, y, w, h = view
    pad = 16
    x, y, w, h = x - pad, y - pad, w + 2 * pad, h + 2 * pad
    svg = re.sub(r'viewBox="[^"]+"', f'viewBox="{x:g} {y:g} {w:g} {h:g}"', svg, count=1)
    svg = re.sub(r'\swidth="[^"]*"', "", svg, count=1)
    svg = re.sub(r'\sstyle="[^"]*"', "", svg, count=1)
    svg = svg.replace("<svg ", f'<svg width="{w:g}" height="{h:g}" ', 1)

    # edges march in the direction of flow
    def edge(m: re.Match[str]) -> str:
        tag = m.group(0)
        return tag.replace('class="', 'class="cv-edge ', 1)

    pattern = r"<(?:path|line)\b[^>]*class=\"[^\"]*\b(?:" + "|".join(EDGE_CLASSES) + r")\b[^\"]*\"[^>]*>"
    svg = re.sub(pattern, edge, svg)

    if name == "double-booking-race":
        # messages (line + label) appear in order, then fade, then the story repeats
        step = 0

        def seq(m: re.Match[str]) -> str:
            nonlocal step
            tag = m.group(0)
            delay = 0.9 + 1.0 * (step // 2)
            step += 1
            return _tag(tag, "cv-step", delay)

        svg = re.sub(
            r"<(?:path|line|text)\b[^>]*class=\"[^\"]*\b(?:messageLine0|messageLine1|messageText)\b[^\"]*\"[^>]*>",
            seq,
            svg,
        )
    else:
        # nodes glow one after another
        count = 0

        def node(m: re.Match[str]) -> str:
            nonlocal count
            tag = m.group(0)
            delay = 0.6 * count
            count += 1
            return _tag(tag, "cv-node", delay)

        svg = re.sub(r"<g\b[^>]*class=\"(?:node|statediagram-state)\b[^\"]*\"[^>]*>", node, svg)

        def entity(m: re.Match[str]) -> str:  # ER tables have an id but no class
            nonlocal count
            delay = 0.6 * count
            count += 1
            return _tag(m.group(0), "cv-node", delay)

        svg = re.sub(r"<g\b(?![^>]*class=)[^>]*id=\"entity-[^\"]*\"[^>]*>", entity, svg)

    card = (
        f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" rx="18" fill="#f8efe1"/>'
        f'<rect x="{x + 1:g}" y="{y + 1:g}" width="{w - 2:g}" height="{h - 2:g}" rx="17" fill="none" stroke="#e3cfae"/>'
    )
    svg = re.sub(r"(<svg\b[^>]*>)", lambda m: m.group(1) + f"<style>{ANIMATION}</style>" + card, svg, count=1)
    return svg


def main() -> None:
    sources = {p.stem: p.read_text(encoding="utf-8") for p in sorted(SOURCES.glob("*.mmd"))}
    for name, svg in render(sources).items():
        target = HERE / f"{name}.svg"
        target.write_text(animate(svg, name), encoding="utf-8")
        print(f"{target.relative_to(HERE.parents[2])}: {target.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
