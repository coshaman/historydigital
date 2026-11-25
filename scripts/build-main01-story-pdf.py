from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "narrative" / "MAIN01-short-story-ko.md"
OUTPUT = ROOT / "output" / "pdf" / "MAIN01-short-story-ko.pdf"
BODY_LIMIT = "## 사료와 문학적 근거"
FONT = Path("C:/Windows/Fonts/malgun.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/malgunbd.ttf")
FONT_SERIF = Path("C:/Windows/Fonts/batang.ttc")


def to_markup(text: str) -> str:
    text = escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r"<font name='Story'>\1</font>", text)
    return text


def add_footer(canvas, doc):
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(colors.HexColor("#b8a27b"))
    canvas.setLineWidth(0.45)
    canvas.line(24 * 2.54, 18 * 2.54, width - 24 * 2.54, 18 * 2.54)
    canvas.setFont("Story", 8)
    canvas.setFillColor(colors.HexColor("#756b5b"))
    canvas.drawString(24 * 2.54, 14 * 2.54, doc.title)
    canvas.drawRightString(width - 24 * 2.54, 14 * 2.54, str(doc.page))
    canvas.restoreState()


def main():
    if not FONT.exists() or not FONT_BOLD.exists():
        raise SystemExit("맑은 고딕 글꼴을 찾을 수 없습니다.")
    markdown = SOURCE.read_text(encoding="utf-8")
    title_and_body, source_notes = markdown.split(BODY_LIMIT, 1)
    title_match = re.search(r"(?m)^# (.+)$", title_and_body)
    title = title_match.group(1).strip() if title_match else "자유인의 마차"
    body = re.sub(r"(?m)^# .+\r?\n", "", title_and_body).strip()
    body_chars = len(re.sub(r"\s", "", body))
    if body_chars <= 4000:
        raise SystemExit(f"소설 본문이 4,000자 미만입니다: 공백 제외 {body_chars}자")

    pdfmetrics.registerFont(TTFont("Story", str(FONT), subfontIndex=0))
    pdfmetrics.registerFont(TTFont("Story-Bold", str(FONT_BOLD), subfontIndex=0))
    pdfmetrics.registerFont(TTFont("Story-Body", str(FONT_SERIF if FONT_SERIF.exists() else FONT), subfontIndex=0))
    pdfmetrics.registerFontFamily("Story", normal="Story", bold="Story-Bold", italic="Story", boldItalic="Story-Bold")

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="StoryTitle", fontName="Story-Bold", fontSize=24, leading=32,
        alignment=TA_CENTER, textColor=colors.HexColor("#29251f"), spaceAfter=12,
    ))
    styles.add(ParagraphStyle(
        name="StoryDeck", fontName="Story", fontSize=9, leading=15,
        alignment=TA_CENTER, textColor=colors.HexColor("#897858"), spaceAfter=26,
    ))
    styles.add(ParagraphStyle(
        name="StoryBody", fontName="Story-Body", fontSize=11.2, leading=18.1,
        alignment=TA_LEFT, textColor=colors.HexColor("#2d2924"),
        spaceAfter=9.2, wordWrap="CJK", allowWidows=0, allowOrphans=0,
    ))
    styles.add(ParagraphStyle(
        name="SourceHeading", fontName="Story-Bold", fontSize=16, leading=24,
        textColor=colors.HexColor("#29251f"), spaceAfter=14,
    ))
    styles.add(ParagraphStyle(
        name="SourceNote", fontName="Story", fontSize=8.5, leading=14,
        textColor=colors.HexColor("#514a3f"), leftIndent=10, firstLineIndent=-10,
        spaceAfter=8, wordWrap="CJK",
    ))
    styles.add(ParagraphStyle(
        name="SourceAfterword", fontName="Story", fontSize=8.5, leading=14,
        textColor=colors.HexColor("#514a3f"), spaceBefore=8, wordWrap="CJK",
    ))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4, title=title, author="",
        leftMargin=24 * 2.54, rightMargin=24 * 2.54,
        topMargin=23 * 2.54, bottomMargin=25 * 2.54,
        pageCompression=1,
    )
    story = [
        Spacer(1, 8 * 2.54),
        Paragraph(escape(title), styles["StoryTitle"]),
        Paragraph("러시아 제국, 1848년 · 금지된 삽화 연감", styles["StoryDeck"]),
    ]
    for paragraph in re.split(r"\n\s*\n", body):
        text = paragraph.strip()
        if text:
            story.append(Paragraph(to_markup(text), styles["StoryBody"]))

    story.extend([PageBreak(), Paragraph("사료와 문학적 근거", styles["SourceHeading"])])
    for line in source_notes.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("- "):
            story.append(Paragraph("• " + to_markup(line[2:]), styles["SourceNote"]))
        else:
            story.append(Paragraph(to_markup(line), styles["SourceAfterword"]))

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    print(f"PDF={OUTPUT}")
    print(f"STORY_BODY_CHARS_EXCLUDING_WHITESPACE={body_chars}")
    print(f"PDF_BYTES={OUTPUT.stat().st_size}")


if __name__ == "__main__":
    main()
