from __future__ import annotations

import json
import math
import os
import textwrap
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).resolve().parent
SIZE = 1200
SCALE = 2

PALETTE = {
    "bg": "#F6F8FB",
    "panel": "#FFFFFF",
    "ink": "#111827",
    "muted": "#5B6675",
    "hairline": "#D9E1EC",
    "gray": "#64748B",
    "blue": "#2563EB",
    "purple": "#7C3AED",
    "green": "#059669",
    "teal": "#0891B2",
    "red": "#E11D48",
    "orange": "#D97706",
    "blue_fill": "#EFF6FF",
    "purple_fill": "#F5F3FF",
    "green_fill": "#ECFDF5",
    "teal_fill": "#ECFEFF",
    "red_fill": "#FFF1F2",
    "orange_fill": "#FFF7ED",
    "gray_fill": "#F8FAFC",
}

SEMANTIC = {
    "api": ("blue", "blue_fill"),
    "router": ("purple", "purple_fill"),
    "kg": ("green", "green_fill"),
    "rag": ("teal", "teal_fill"),
    "decision": ("red", "red_fill"),
    "memory": ("orange", "orange_fill"),
    "infra": ("gray", "gray_fill"),
}


def write_text(name: str, content: str) -> None:
    (OUT / name).write_text(content.strip() + "\n", encoding="utf-8")


def xml_attr(value: str) -> str:
    return escape(str(value), {'"': "&quot;"})


def rgb(hex_value: str) -> tuple[int, int, int]:
    value = hex_value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def font(size: int, weight: str = "regular") -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    windir = Path(os.environ.get("WINDIR", r"\Windows"))
    fonts = windir / "Fonts"
    filename = "segoeuib.ttf" if weight == "bold" else "segoeui.ttf"
    fallback = "arialbd.ttf" if weight == "bold" else "arial.ttf"
    for candidate in (fonts / filename, fonts / fallback):
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def wrap(text: str, width: int) -> list[str]:
    lines: list[str] = []
    for part in str(text).split("\n"):
        lines.extend(textwrap.wrap(part, width=width, break_long_words=False) or [""])
    return lines


def center(box: dict) -> tuple[float, float]:
    return box["x"] + box["w"] / 2, box["y"] + box["h"] / 2


def edge_points(a: dict, b: dict) -> tuple[float, float, float, float]:
    ax, ay = center(a)
    bx, by = center(b)
    dx, dy = bx - ax, by - ay
    if abs(dx) >= abs(dy):
        return (
            a["x"] + (a["w"] if dx > 0 else 0),
            ay,
            b["x"] if dx > 0 else b["x"] + b["w"],
            by,
        )
    return (
        ax,
        a["y"] + (a["h"] if dy > 0 else 0),
        bx,
        b["y"] if dy > 0 else b["y"] + b["h"],
    )


def arrowhead(x1: float, y1: float, x2: float, y2: float, size: int = 13) -> list[tuple[float, float]]:
    angle = math.atan2(y2 - y1, x2 - x1)
    return [
        (x2, y2),
        (x2 - size * math.cos(angle - math.pi / 6), y2 - size * math.sin(angle - math.pi / 6)),
        (x2 - size * math.cos(angle + math.pi / 6), y2 - size * math.sin(angle + math.pi / 6)),
    ]


class Canvas:
    def __init__(self, title: str, subtitle: str = "") -> None:
        self.title = title
        self.subtitle = subtitle
        self.image = Image.new("RGB", (SIZE * SCALE, SIZE * SCALE), rgb(PALETTE["bg"]))
        self.draw = ImageDraw.Draw(self.image)
        self.svg: list[str] = [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" viewBox="0 0 {SIZE} {SIZE}">',
            "<defs>",
            '<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">',
            '<feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0F172A" flood-opacity="0.10"/>',
            "</filter>",
            '<marker id="arrow" markerWidth="14" markerHeight="14" refX="11" refY="7" orient="auto" markerUnits="strokeWidth">',
            '<path d="M2,2 L12,7 L2,12 z" fill="#8A94A6"/>',
            "</marker>",
            "</defs>",
            f'<rect width="{SIZE}" height="{SIZE}" fill="{PALETTE["bg"]}"/>',
        ]
        self.title_font = font(42 * SCALE, "bold")
        self.subtitle_font = font(21 * SCALE)
        self.section_font = font(24 * SCALE, "bold")
        self.body_font = font(19 * SCALE)
        self.small_font = font(16 * SCALE)
        self.pill_font = font(16 * SCALE, "bold")

    def s(self, value: float) -> int:
        return int(round(value * SCALE))

    def rect(self, x: float, y: float, w: float, h: float, fill: str, stroke: str = "hairline", radius: int = 22, width: int = 2, shadow: bool = False) -> None:
        if shadow:
            self.draw.rounded_rectangle(
                [self.s(x + 4), self.s(y + 8), self.s(x + w + 4), self.s(y + h + 8)],
                radius=self.s(radius),
                fill=rgb("#E6ECF4"),
            )
        self.draw.rounded_rectangle(
            [self.s(x), self.s(y), self.s(x + w), self.s(y + h)],
            radius=self.s(radius),
            fill=rgb(PALETTE[fill] if fill in PALETTE else fill),
            outline=rgb(PALETTE[stroke] if stroke in PALETTE else stroke),
            width=self.s(width),
        )
        shadow_attr = ' filter="url(#shadow)"' if shadow else ""
        self.svg.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" '
            f'fill="{PALETTE[fill] if fill in PALETTE else fill}" '
            f'stroke="{PALETTE[stroke] if stroke in PALETTE else stroke}" stroke-width="{width}"{shadow_attr}/>'
        )

    def text(self, x: float, y: float, text: str, size: int, color: str = "ink", weight: str = "regular", anchor: str = "start") -> None:
        pil_font = font(size * SCALE, "bold" if weight == "bold" else "regular")
        fill = rgb(PALETTE[color] if color in PALETTE else color)
        if anchor == "middle":
            bbox = self.draw.textbbox((0, 0), text, font=pil_font)
            px = self.s(x) - (bbox[2] - bbox[0]) / 2
        else:
            px = self.s(x)
        self.draw.text((px, self.s(y)), text, font=pil_font, fill=fill)
        svg_weight = "700" if weight == "bold" else "400"
        svg_anchor = ' text-anchor="middle"' if anchor == "middle" else ""
        self.svg.append(
            f'<text x="{x}" y="{y + size}" font-family="Segoe UI, Arial" font-size="{size}" '
            f'font-weight="{svg_weight}" fill="{PALETTE[color] if color in PALETTE else color}"{svg_anchor}>{escape(text)}</text>'
        )

    def wrapped(self, x: float, y: float, text: str | list[str], size: int = 19, color: str = "muted", width: int = 34, leading: int | None = None, weight: str = "regular") -> float:
        line_h = leading or int(size * 1.42)
        lines = text if isinstance(text, list) else wrap(text, width)
        for line in lines:
            self.text(x, y, line, size, color=color, weight=weight)
            y += line_h
        return y

    def title_block(self) -> None:
        self.text(72, 60, self.title, 42, "ink", "bold")
        if self.subtitle:
            self.wrapped(74, 123, self.subtitle, 21, "muted", width=78, leading=30)

    def card(self, item: dict) -> None:
        color_key, fill_key = SEMANTIC[item.get("kind", "infra")]
        fill = item.get("fill", fill_key)
        stroke = item.get("stroke", "hairline")
        x, y, w, h = item["x"], item["y"], item["w"], item["h"]
        self.rect(x, y, w, h, fill, stroke, radius=22, width=2, shadow=True)
        self.rect(x, y, 8, h, PALETTE[color_key], PALETTE[color_key], radius=4, width=0)
        self.text(x + 26, y + 23, item["title"], item.get("title_size", 23), "ink", "bold")
        body = item.get("body", [])
        body_text = body if isinstance(body, list) else [body]
        body_offset = item.get("body_offset", 58 if h <= 95 else 65)
        self.wrapped(x + 26, y + body_offset, body_text, item.get("body_size", 18), "muted", width=item.get("wrap", max(18, int(w / 12))), leading=item.get("leading", 25))
        if item.get("tag"):
            self.pill(x + w - item.get("tag_w", 118) - 18, y + 18, item.get("tag_w", 118), 30, item["tag"], color_key)

    def pill(self, x: float, y: float, w: float, h: float, label: str, color: str = "gray") -> None:
        fill_key = {
            "blue": "blue_fill",
            "purple": "purple_fill",
            "green": "green_fill",
            "teal": "teal_fill",
            "red": "red_fill",
            "orange": "orange_fill",
            "gray": "gray_fill",
        }.get(color, "gray_fill")
        self.rect(x, y, w, h, fill_key, color, radius=int(h / 2), width=2)
        bbox = self.draw.textbbox((0, 0), label, font=self.pill_font)
        self.draw.text((self.s(x + w / 2) - (bbox[2] - bbox[0]) / 2, self.s(y + 6)), label, font=self.pill_font, fill=rgb(PALETTE[color]))
        self.svg.append(
            f'<text x="{x + w / 2}" y="{y + h / 2 + 6}" text-anchor="middle" font-family="Segoe UI, Arial" '
            f'font-size="16" font-weight="700" fill="{PALETTE[color]}">{escape(label)}</text>'
        )

    def arrow(self, a: dict, b: dict, label: str = "", color: str = "gray") -> None:
        x1, y1, x2, y2 = edge_points(a, b)
        stroke = rgb(PALETTE[color])
        self.draw.line([self.s(x1), self.s(y1), self.s(x2), self.s(y2)], fill=stroke, width=self.s(4))
        self.draw.polygon([(self.s(x), self.s(y)) for x, y in arrowhead(x1, y1, x2, y2)], fill=stroke)
        self.svg.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{PALETTE[color]}" '
            f'stroke-width="4" marker-end="url(#arrow)" stroke-linecap="round"/>'
        )
        if label:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            label_w = max(82, len(label) * 8 + 24)
            self.rect(mx - label_w / 2, my - 17, label_w, 30, "panel", "hairline", radius=15, width=1)
            self.text(mx, my - 10, label, 14, "muted", "bold", anchor="middle")

    def save(self, stem: str) -> None:
        self.svg.append("</svg>")
        write_text(f"{stem}.svg", "\n".join(self.svg))
        png = self.image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
        png.save(OUT / f"{stem}.png")
        self.image.save(OUT / f"{stem}.pdf", "PDF", resolution=300.0)


def drawio_xml(title: str, nodes: list[dict], edges: list[tuple[str, str, str]] | None = None) -> str:
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    for node in nodes:
        color_key, fill_key = SEMANTIC[node.get("kind", "infra")]
        value = f"<b>{escape(node['title'])}</b><br/>" + "<br/>".join(escape(line) for line in node.get("body", []))
        style = (
            "rounded=1;whiteSpace=wrap;html=1;arcSize=14;fontFamily=Segoe UI;"
            f"fontSize=18;fontColor={PALETTE['ink']};spacing=14;"
            f"fillColor={PALETTE[fill_key]};strokeColor={PALETTE['hairline']};"
        )
        cells.append(
            f'<mxCell id="{xml_attr(node["id"])}" value="{xml_attr(value)}" style="{xml_attr(style)}" vertex="1" parent="1">'
            f'<mxGeometry x="{node["x"]}" y="{node["y"]}" width="{node["w"]}" height="{node["h"]}" as="geometry"/></mxCell>'
        )
    for idx, edge in enumerate(edges or [], 1):
        source, target, label = edge
        style = "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#8A94A6;strokeWidth=3;endArrow=block;endFill=1;fontFamily=Segoe UI;fontSize=14;"
        cells.append(
            f'<mxCell id="edge_{idx}" value="{xml_attr(label)}" style="{xml_attr(style)}" edge="1" parent="1" '
            f'source="{xml_attr(source)}" target="{xml_attr(target)}"><mxGeometry relative="1" as="geometry"/></mxCell>'
        )
    model = (
        '<mxGraphModel dx="1200" dy="1200" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" '
        'arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="1200" math="0" shadow="0">'
        f"<root>{''.join(cells)}</root></mxGraphModel>"
    )
    return f'<mxfile host="app.diagrams.net" modified="2026-07-12T00:00:00.000Z" agent="LinkedInAssets" version="24.7.17"><diagram name="{xml_attr(title[:60])}">{model}</diagram></mxfile>'


def architecture() -> None:
    c = Canvas("Architecture Overview", "AAST AI Academic Advisor: route each question to the right evidence system before the LLM writes.")
    c.title_block()
    evidence_group = {"id": "evidence_group", "x": 70, "y": 510, "w": 1060, "h": 275}
    nodes = [
        {"id": "ui", "x": 82, "y": 245, "w": 210, "h": 120, "title": "User Interface", "body": ["React + Vite", "Nginx"], "kind": "api"},
        {"id": "api", "x": 370, "y": 235, "w": 250, "h": 140, "title": "AI Orchestration", "body": ["Node.js + Express", "orchestrator.js", "POST /api/chatbot/query"], "kind": "api", "wrap": 21},
        {"id": "router", "x": 708, "y": 235, "w": 285, "h": 140, "title": "Brain Router", "body": ["Intent + health", "KG, RAG, Hybrid", "Decision, FAQ, fallback"], "kind": "router", "wrap": 23},
        {"id": "memory", "x": 370, "y": 395, "w": 250, "h": 105, "title": "Conversation Memory", "body": ["history", "last route", "recent subjects"], "kind": "memory"},
        {"id": "kg", "x": 100, "y": 595, "w": 225, "h": 125, "title": "Knowledge Graph", "body": ["Neo4j", "academic relationships"], "kind": "kg", "wrap": 20},
        {"id": "rag", "x": 365, "y": 595, "w": 225, "h": 125, "title": "Vector RAG", "body": ["Qdrant", "BAAI/bge-m3 sources"], "kind": "rag", "wrap": 20},
        {"id": "decision", "x": 630, "y": 595, "w": 225, "h": 125, "title": "Decision Support", "body": ["FastAPI", "program recommendations"], "kind": "decision", "wrap": 20},
        {"id": "rag_answer", "x": 895, "y": 595, "w": 205, "h": 125, "title": "RAG Answer", "body": ["optional", "grounded answer"], "kind": "infra", "wrap": 18},
        {"id": "llm", "x": 235, "y": 880, "w": 330, "h": 140, "title": "LLM Synthesis", "body": ["Primary: Gemma (Ollama)", "Backup: Gemini", "Deterministic fallback"], "kind": "router", "wrap": 30},
        {"id": "out", "x": 650, "y": 880, "w": 330, "h": 140, "title": "Grounded Answer", "body": ["final_answer", "used_facts", "graph + missing info"], "kind": "api", "wrap": 28},
    ]
    boxes = {n["id"]: n for n in nodes}
    c.rect(evidence_group["x"], evidence_group["y"], evidence_group["w"], evidence_group["h"], "panel", "hairline", radius=28, width=2)
    c.text(100, 535, "Evidence services", 24, "ink", "bold")
    c.wrapped(100, 569, "Real services selected by the Brain Router; no synthetic components added.", 17, "muted", width=68, leading=24)
    for a, b, label in [
        ("ui", "api", ""),
        ("api", "router", ""),
        ("api", "memory", "context"),
        ("router", "evidence_group", "routes"),
        ("evidence_group", "llm", "verified context"),
        ("llm", "out", ""),
    ]:
        c.arrow(boxes.get(a, evidence_group), boxes.get(b, evidence_group), label)
    for node in nodes:
        c.card(node)
    c.save("architecture_light")
    write_text("architecture_light.drawio", drawio_xml("Architecture Overview", nodes, [(a, b, l) for a, b, l in [
        ("ui", "api", ""), ("api", "router", ""), ("api", "memory", "context"),
        ("router", "kg", "KG"), ("router", "rag", "RAG"), ("router", "decision", "Decision"),
        ("rag", "rag_answer", "optional"), ("kg", "llm", "facts"), ("rag", "llm", "sources"),
        ("decision", "llm", "recommend"), ("llm", "out", "")
    ]]))


def lifecycle() -> None:
    c = Canvas("Request Lifecycle", "Endpoint: POST /api/chatbot/query")
    c.title_block()
    evidence_group = {"id": "evidence_group", "x": 95, "y": 585, "w": 1010, "h": 205}
    nodes = [
        {"id": "one", "x": 185, "y": 220, "w": 830, "h": 90, "title": "1. Ask", "body": ["React UI sends query + conversation id"], "kind": "api", "wrap": 56},
        {"id": "two", "x": 185, "y": 355, "w": 830, "h": 90, "title": "2. Normalize + Remember", "body": ["Clean academic wording and load conversation memory"], "kind": "memory", "wrap": 58},
        {"id": "three", "x": 185, "y": 490, "w": 830, "h": 90, "title": "3. Route", "body": ["Brain Router combines intent signals with subsystem health"], "kind": "router", "wrap": 58},
        {"id": "kg", "x": 130, "y": 645, "w": 290, "h": 95, "title": "Neo4j", "body": ["graph facts"], "kind": "kg"},
        {"id": "rag", "x": 455, "y": 645, "w": 290, "h": 95, "title": "Qdrant RAG", "body": ["retrieved sources"], "kind": "rag"},
        {"id": "decision", "x": 780, "y": 645, "w": 290, "h": 95, "title": "Decision API", "body": ["recommendations"], "kind": "decision"},
        {"id": "five", "x": 185, "y": 835, "w": 830, "h": 90, "title": "5. Synthesize", "body": ["Gemma primary, Gemini backup, deterministic fallback"], "kind": "router", "wrap": 58},
        {"id": "six", "x": 185, "y": 970, "w": 830, "h": 90, "title": "6. Respond + Save", "body": ["Answer, graph data, used facts, missing information"], "kind": "api", "wrap": 58},
    ]
    boxes = {n["id"]: n for n in nodes}
    c.rect(evidence_group["x"], evidence_group["y"], evidence_group["w"], evidence_group["h"], "panel", "hairline", radius=28, width=2)
    c.text(130, 612, "4. Retrieve evidence", 24, "ink", "bold")
    for a, b, label in [
        ("one", "two", ""),
        ("two", "three", ""),
        ("three", "evidence_group", ""),
        ("evidence_group", "five", ""),
        ("five", "six", ""),
    ]:
        c.arrow(boxes.get(a, evidence_group), boxes.get(b, evidence_group), label)
    for node in nodes:
        c.card(node)
    c.save("request_lifecycle")
    write_text("request_lifecycle.drawio", drawio_xml("Request Lifecycle", nodes, [(a, b, l) for a, b, l in [
        ("one", "two", ""), ("two", "three", ""), ("three", "kg", "KG"),
        ("three", "rag", "RAG"), ("three", "decision", "Decision"), ("kg", "five", ""),
        ("rag", "five", ""), ("decision", "five", ""), ("five", "six", "")
    ]]))


def thinking() -> None:
    c = Canvas("How the AI Thinks", "Evidence first. Routing second. LLM synthesis only after grounding.")
    c.title_block()
    steps = [
        ("remember", "Remember", "conversation memory", "memory"),
        ("understand", "Understand", "normalize + infer intent", "api"),
        ("route", "Route", "Brain Router chooses path", "router"),
        ("retrieve", "Retrieve", "Neo4j, Qdrant, Decision API", "kg"),
        ("synthesize", "Synthesize", "Gemma, Gemini backup, fallback", "router"),
        ("explain", "Explain", "used facts + missing info", "api"),
        ("persist", "Persist", "save the turn", "memory"),
    ]
    nodes: list[dict] = []
    y_positions = [215, 335, 455, 575, 695, 815, 935]
    for idx, ((sid, title, body, kind), y) in enumerate(zip(steps, y_positions), 1):
        nodes.append({"id": sid, "x": 170, "y": y, "w": 860, "h": 92, "title": f"{idx}. {title}", "body": [body], "kind": kind, "title_size": 23, "body_size": 20, "wrap": 58})
    boxes = {n["id"]: n for n in nodes}
    for a, b in zip([s[0] for s in steps], [s[0] for s in steps][1:]):
        c.arrow(boxes[a], boxes[b])
    for node in nodes:
        c.card(node)
    c.save("how_the_ai_thinks")
    write_text("how_the_ai_thinks.drawio", drawio_xml("How the AI Thinks", nodes, [(a, b, "") for a, b in zip([s[0] for s in steps], [s[0] for s in steps][1:])]))


def comparison() -> None:
    c = Canvas("Traditional RAG vs Hybrid GraphRAG", "What changes when routing, graph facts, and decision support join vector retrieval.")
    c.title_block()
    c.rect(70, 195, 505, 835, "panel", "hairline", radius=28, width=2, shadow=False)
    c.rect(625, 195, 505, 835, "panel", "hairline", radius=28, width=2, shadow=False)
    c.text(110, 230, "Traditional RAG", 28, "ink", "bold")
    c.text(665, 230, "Hybrid GraphRAG", 28, "ink", "bold")
    left = [
        {"id": "t1", "x": 115, "y": 310, "w": 410, "h": 105, "title": "1. Embed query", "body": ["Turn text into a vector"], "kind": "infra"},
        {"id": "t2", "x": 115, "y": 485, "w": 410, "h": 105, "title": "2. Retrieve chunks", "body": ["Find similar documents"], "kind": "rag"},
        {"id": "t3", "x": 115, "y": 660, "w": 410, "h": 105, "title": "3. Generate answer", "body": ["LLM writes from retrieved context"], "kind": "router"},
        {"id": "t4", "x": 115, "y": 835, "w": 410, "h": 105, "title": "Common limitation", "body": ["Relationships and policy boundaries can be implicit"], "kind": "infra", "wrap": 37},
    ]
    right = [
        {"id": "h1", "x": 670, "y": 300, "w": 410, "h": 95, "title": "1. Use memory", "body": ["Conversation-aware query handling"], "kind": "memory", "wrap": 38},
        {"id": "h2", "x": 670, "y": 445, "w": 410, "h": 95, "title": "2. Route intelligently", "body": ["Brain Router selects KG, RAG, Hybrid, Decision"], "kind": "router", "wrap": 38},
        {"id": "h3", "x": 670, "y": 590, "w": 410, "h": 95, "title": "3. Retrieve from specialists", "body": ["Neo4j facts + Qdrant sources + Decision API"], "kind": "kg", "wrap": 38},
        {"id": "h4", "x": 670, "y": 735, "w": 410, "h": 95, "title": "4. Synthesize safely", "body": ["Gemma primary, Gemini backup, fallback"], "kind": "router", "wrap": 38},
        {"id": "h5", "x": 670, "y": 880, "w": 410, "h": 95, "title": "5. Explain result", "body": ["used_facts, graph payload, missing_information"], "kind": "api", "wrap": 38},
    ]
    nodes = left + right
    boxes = {n["id"]: n for n in nodes}
    for chain in (["t1", "t2", "t3", "t4"], ["h1", "h2", "h3", "h4", "h5"]):
        for a, b in zip(chain, chain[1:]):
            c.arrow(boxes[a], boxes[b])
    for node in nodes:
        c.card(node)
    c.save("traditional_rag_vs_hybrid_graphrag")
    write_text("traditional_rag_vs_hybrid_graphrag.drawio", drawio_xml("Traditional RAG vs Hybrid GraphRAG", nodes, [(a, b, "") for chain in (["t1", "t2", "t3", "t4"], ["h1", "h2", "h3", "h4", "h5"]) for a, b in zip(chain, chain[1:])]))


def infographic() -> None:
    c = Canvas("How Our AI Answers Questions", "AAST AI Academic Advisor | Explainable Hybrid GraphRAG Academic Platform")
    c.title_block()
    evidence_group = {"id": "evidence_group", "x": 70, "y": 530, "w": 1060, "h": 255}
    nodes = [
        {"id": "query", "x": 340, "y": 230, "w": 240, "h": 115, "title": "Question", "body": ["student query", "conversation id"], "kind": "api"},
        {"id": "memory", "x": 620, "y": 230, "w": 240, "h": 115, "title": "Memory", "body": ["history", "recent subjects"], "kind": "memory"},
        {"id": "router", "x": 340, "y": 380, "w": 520, "h": 125, "title": "Brain Router", "body": ["intent + subsystem health", "KG, RAG, Hybrid, Decision, FAQ, fallback"], "kind": "router", "wrap": 43},
        {"id": "kg", "x": 115, "y": 615, "w": 300, "h": 115, "title": "Knowledge Graph", "body": ["Neo4j", "academic relationships"], "kind": "kg"},
        {"id": "rag", "x": 450, "y": 615, "w": 300, "h": 115, "title": "Vector RAG", "body": ["Qdrant", "BAAI/bge-m3 sources"], "kind": "rag"},
        {"id": "decision", "x": 785, "y": 615, "w": 300, "h": 115, "title": "Decision Support", "body": ["FastAPI", "program recommendations"], "kind": "decision"},
        {"id": "llm", "x": 225, "y": 835, "w": 750, "h": 130, "title": "LLM Synthesis", "body": ["Gemma primary, Gemini backup, deterministic fallback"], "kind": "router", "wrap": 62},
        {"id": "answer", "x": 340, "y": 1035, "w": 520, "h": 95, "title": "Grounded Answer", "body": ["final_answer, used_facts, missing_information"], "kind": "api", "wrap": 45},
    ]
    boxes = {n["id"]: n for n in nodes}
    c.rect(evidence_group["x"], evidence_group["y"], evidence_group["w"], evidence_group["h"], "panel", "hairline", radius=28, width=2)
    c.text(110, 562, "Verified evidence systems", 24, "ink", "bold")
    for a, b, label in [
        ("query", "router", ""),
        ("memory", "router", ""),
        ("router", "evidence_group", ""),
        ("evidence_group", "llm", ""),
        ("llm", "answer", ""),
    ]:
        c.arrow(boxes.get(a, evidence_group), boxes.get(b, evidence_group), label)
    for node in nodes:
        c.card(node)
    c.save("linkedin_infographic_1200x1200")


MERMAID = {
    "architecture_light.mmd": """
flowchart LR
    UI["User Interface<br/>React + Vite"]
    API["AI Orchestration Layer<br/>Node.js + Express"]
    Router["Brain Router<br/>KG / RAG / Hybrid / Decision"]
    Memory["Conversation Memory"]
    KG["Knowledge Graph<br/>Neo4j"]
    RAG["Vector RAG<br/>Qdrant + BAAI/bge-m3"]
    Decision["Decision Support Engine<br/>FastAPI"]
    LLM["LLM Synthesis<br/>Gemma, Gemini backup, fallback"]
    Answer["Grounded Answer<br/>used_facts + missing_information"]

    UI --> API --> Router
    API <--> Memory
    Router --> KG --> LLM
    Router --> RAG --> LLM
    Router --> Decision --> LLM
    LLM --> Answer --> UI
""",
    "request_lifecycle.mmd": """
flowchart TD
    A["1. Ask<br/>React UI sends query + cid"]
    B["2. Normalize + Remember<br/>Clean wording and load memory"]
    C["3. Route<br/>Brain Router scores intent and health"]
    D["4. Retrieve Evidence<br/>KG, RAG, Hybrid, Decision, FAQ"]
    E["5. Synthesize<br/>Gemma primary, Gemini backup, fallback"]
    F["6. Respond + Save<br/>Answer, graph, used facts, missing info"]

    A --> B --> C --> D --> E --> F
""",
    "how_the_ai_thinks.mmd": """
flowchart TD
    A["Remember<br/>conversation memory"]
    B["Understand<br/>normalize + infer intent"]
    C["Route<br/>Brain Router chooses path"]
    D["Retrieve<br/>Neo4j, Qdrant, Decision API"]
    E["Synthesize<br/>Gemma, Gemini backup, fallback"]
    F["Explain<br/>used facts + missing info"]
    G["Persist<br/>save the turn"]

    A --> B --> C --> D --> E --> F --> G
""",
    "traditional_rag_vs_hybrid_graphrag.mmd": """
flowchart LR
    subgraph T["Traditional RAG"]
        T1["Embed query"] --> T2["Retrieve chunks"] --> T3["Generate answer"]
    end
    subgraph H["Hybrid GraphRAG"]
        H1["Use memory"] --> H2["Brain Router"] --> H3["Neo4j + Qdrant + Decision API"] --> H4["LLM synthesis"] --> H5["Explain result"]
    end
""",
}


def write_docs() -> None:
    write_text(
        "README.md",
        """
# LinkedIn Post Assets

Project post name: Explainable Hybrid GraphRAG Academic Platform

Official repository name: AAST AI Academic Advisor

Generated assets use one square LinkedIn design system:

- `architecture_light`
- `request_lifecycle`
- `how_the_ai_thinks`
- `traditional_rag_vs_hybrid_graphrag`
- `linkedin_infographic_1200x1200`

Each diagram exports as PNG, SVG, and PDF at 1200x1200. Editable Mermaid and draw.io sources are included for the four technical diagrams.

Public-facing graphics contain no environment-specific paths.
""",
    )
    write_text(
        "source_architecture_evidence.md",
        """
# Source Architecture Evidence

The visuals use repository-relative evidence only.

## Official names

- `README.md`: `AAST AI Academic Advisor`
- `aast-ai-agent-main/backend/services/unifiedAnswerService.js`: `AAST Explainable Hybrid GraphRAG Academic Advisor`
- `aast-ai-agent-main/backend/services/brainRouter.js`: `AAST Explainable Hybrid Academic Super-Agent`

## Services

- `docker-compose.yml`: `frontend`, `backend`, `decision-api`, `rag-retriever`, `rag-answer`, `qdrant`, `neo4j`
- `aast-ai-agent-main/backend/README.md`: production entry point is `orchestrator.js`

## API flow

- `aast-ai-agent-main/backend/orchestrator.js`: `POST /api/chatbot/query`
- `aast-ai-agent-main/backend/orchestrator.js`: query normalization, conversation memory, subsystem health, Brain Router, route execution, unified synthesis, response enrichment

## Brain Router

- `aast-ai-agent-main/backend/services/brainRouter.js`: routes include `KG_DIRECT`, `KG_ONLY`, `RAG_DIRECT`, `RAG_ONLY`, `HYBRID_KG_RAG`, `DECISION_ENGINE`, `CAREER_ENGINE`, `FAQ`, and `LLM_FALLBACK`

## Memory

- `aast-ai-agent-main/backend/services/conversationService.js`: persistent conversation JSON, `lastRoute`, `conversationMemory`, recent subjects
- `aast-ai-agent-main/backend/services/decisionService.js`: decision-side session memory

## Retrieval

- `aast-ai-agent-main/backend/services/neo4jcontext.js`: Neo4j context retrieval and graph response construction
- `aast-ai-agent-main/backend/rag_system/phase3_retriever.py`: Qdrant collection `aast_academic_rag_production`, embedding model `BAAI/bge-m3`, `/search`, `/health`
- `aast-ai-agent-main/backend/services/ragService.js`: multi-pass RAG search and optional answer-engine fallback

## LLM

- `aast-ai-agent-main/backend/services/unifiedAnswerService.js`: final synthesis from Neo4j, RAG, FAQ, and Decision contexts
- `aast-ai-agent-main/backend/config/llmConfig.js`: default primary model `gemma4:e2b`, backup model `tinyllama:latest`
- `aast-ai-agent-main/backend/services/geminiService.js`: default Gemini model `gemini-2.5-flash`

## Decision Support

- `college-decision-system-backend/app/main.py`: FastAPI decision application
- `college-decision-system-backend/app/api/v1/routers/decisions.py`: `/api/v1/decisions/recommend`
- `college-decision-system-backend/app/api/v1/dependencies/security.py`: `X-Internal-Secret`
""",
    )
    write_text(
        "linkedin_post_caption.md",
        """
# LinkedIn Caption Draft

I built my graduation project around one question:

How can an academic AI assistant answer students with evidence, not guesses?

My project is an Explainable Hybrid GraphRAG Academic Platform, implemented as the AAST AI Academic Advisor.

The system combines:

- A Node.js orchestration layer with an explicit Brain Router
- Neo4j for academic graph facts and relationships
- Qdrant with BAAI/bge-m3 retrieval for policy evidence
- A FastAPI Decision Support Engine for program recommendations
- Persistent conversation memory for follow-up questions
- Gemma through Ollama for synthesis, with Gemini backup and deterministic fallback paths

The core idea is simple: not every question should use the same retrieval path.

The Brain Router decides whether a query needs graph facts, policy retrieval, both together, decision support, FAQ handling, or fallback synthesis. The final answer layer then uses only verified context and returns source-aware fields such as used facts, graph payloads, and missing information.

#GraphRAG #RAG #KnowledgeGraph #Neo4j #Qdrant #FastAPI #NodeJS #AcademicAI #GraduationProject #ExplainableAI
""",
    )


def write_mermaid() -> None:
    for name, content in MERMAID.items():
        write_text(name, content)


def write_manifest() -> None:
    generated = sorted(p.name for p in OUT.iterdir() if p.name != Path(__file__).name)
    write_text(
        "manifest.json",
        json.dumps(
            {
                "project_post_name": "Explainable Hybrid GraphRAG Academic Platform",
                "official_repository_name": "AAST AI Academic Advisor",
                "design_system": "square_1200_mobile_first",
                "exports": ["png", "svg", "pdf", "mmd", "drawio"],
                "generated_files": generated,
            },
            indent=2,
        ),
    )


def main() -> None:
    write_mermaid()
    architecture()
    lifecycle()
    thinking()
    comparison()
    infographic()
    write_docs()
    write_manifest()


if __name__ == "__main__":
    main()
