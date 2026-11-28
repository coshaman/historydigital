from pathlib import Path
import shutil
from xml.sax.saxutils import escape

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'submission'
SHOTS = ROOT / 'artifacts' / 'submission' / 'screenshots'
STORY = ROOT / 'output' / 'pdf' / 'MAIN01-short-story-ko.pdf'
URL = 'https://historydigital.vercel.app/'
TITLE = '자유인의 마차'
NAME = '박성현'
NUMBER = '202514276'
ALIAS = 'coshaman'
STEM = f'{NUMBER}_{NAME}_{TITLE}'
INK = '#211B18'
DARK = '#25201C'
PAPER = '#F1E8D8'
PAPER_BRIGHT = '#F9F4EA'
BRASS = '#C8A671'
WINE = '#743B33'
DIM = '#66594D'
SOFT = '#D8C8B0'
LINE = '#C5B396'

INTRO = (
    '1848년 페테르부르크에서 네크라소프와 파나예프의 《삽화 연감》은 인쇄를 마치고도 나오지 못했다. '
    '나는 인쇄공과 배달원의 사정도 궁금했다. '
    '게임에서는 인쇄소와 서점을 오가며 이들을 만나고, 금지된 책을 옮길지, 다친 사람에게 마차를 내줄지 고른다. '
    '소설은 그 뒤를 따라간다. 마부를 돕겠다던 서기는 주인의 차를 대접받는 동안 약속을 저버린다.'
    '\n\n나는 러시아 사회를 보며 지금 한국에서 일하고 살아가는 우리의 모습을 돌아보고 싶었다. '
    '윗사람의 뜻을 거스르기 어려워 침묵하는 일, 남을 돕고 싶어도 내 일자리가 먼저 걱정되는 일은 낯설지 않다. '
    '그래서 플레이어가 여러 인물의 처지에서 선택하고, 그 결과를 겪도록 했다. '
    '당시 사람들이 느꼈을 두려움과 망설임을 경험한 뒤, 오늘의 나는 곤란에 처한 사람을 위해 어디까지 나설 수 있을지 생각해 보았으면 한다.'
)
PROMPTS = (
    (
        '금지된 삽화 연감의 각본',
        '1848년 네크라소프·파나예프의 《삽화 연감》이 검열 허가를 받은 뒤 배포 금지된 실제 사건을 구현해. '
        '아브도티야 파나예바의 「탈니코프 가족」과 관련 출판 자료를 중심으로 편집·인쇄·검열·서점·구독자·사본 유통 및 후폭풍을 다양한 인물에게 빙의해 경험하도록 만들어.',
    ),
    (
        '역사 현장의 시제품을 본 뒤',
        '역사 현장 기능은 내가 원한것과 전혀 달라. 난 저렇게 글로 뜨는걸 말한게 아니라, 우리의 게임 상의 캐릭터들이 직접 움직이고 우리 게임 배경을 무대로 메타버스마냥 내가 움직이고 상호작용할 수 있는걸 원했어. '
        '현재 구현된건 너무 간략하고, 그냥 줄글에 불과해. 사건 하나당 4~5분은 플레이타임 있어서 여기에는 (그 장소로의 순간이동 외에도) 이동이나 대화, 추가적인 콘텐츠를 여러가지 넣어야해. '
        '단순 줄글이 아닌 제대로된 이벤트로 넣어줘.',
    ),
)
INTERVENTIONS = (
    ('인물', '제공한 각본에서 안나에게는 수선 대금과 동생의 공부를, 파벨에게는 운임과 배달 책임을 맡겼다. 파벨은 문서를 날라도 그 내용을 저절로 알지는 못하게 썼다.'),
    ('사건', '검열 허가, 재심, 배포 금지, 구독자 답신의 순서로 사건을 구성했다. 금지 뒤에는 품삯을 치르고 사본을 보관하거나 독자에게 보상하는 갈래를 짰다.'),
    ('퀘스트', '서점에서 부록을 묻고 인쇄소로 가는 도입, 허가 날짜와 교정쇄를 확인하는 일을 각본에 적었다. 같은 사건에 인쇄공·배달원·서기가 참여하게 설계했다.'),
)
COURSE = (
    ('플롯 설계', '비선형적·인터랙티브 플롯', '마차를 병원으로 보내면 나중에 마부를 다시 만난다. 연감을 먼저 보내면 산파의 외투를 맡겨 두 번째 마차를 부른다.',
     '2-2강 「AI 시대의 이야기 구성요소 재정의」'),
    ('세계관 조사', '문화·사회적 맥락 학습', '검열위원회의 재심 기록과 구독자 서한을 게임에서 읽을 수 있다. 문서의 날짜를 맞춰 아직 일어나지 않은 일을 먼저 알게 하지 않았다.',
     '4-1강 「AI가 만드는 세계관과 배경」'),
    ('게임 구현', '게임화된 이벤트형 스토리텔링', '인쇄소에서는 도제가 되어 활자를 골라 교정쇄를 만든다. 책을 찍는 일을 직접 해 본 뒤 배포 금지 소식을 접하게 했다.',
     '5-2강 「사용자 참여형 AI 스토리텔링」'),
    ('각본 검토', '편집자로서의 창작자', '《죄와 벌》에서 적빈을 다룬 구절을 직접 골랐다. AI가 쓴 대사에서 가난을 너무 가볍게 말하거나 인물이 자기 처지를 설명하기만 하는 부분을 지적했다.',
     '5-3강 「AI 스토리텔링의 미래와 도전과제」'),
)

for name, path in [('sans', 'malgun.ttf'), ('bold', 'malgunbd.ttf'), ('serif', 'batang.ttc')]:
    pdfmetrics.registerFont(TTFont(name, f'C:/Windows/Fonts/{path}', subfontIndex=0))


def color(code):
    return colors.HexColor(code)


def doc(path, pagesize, subheading):
    c = Canvas(str(path), pagesize=pagesize, pageCompression=1)
    c.setTitle(f'{TITLE} | {subheading}')
    c.setAuthor(NAME)
    c.setSubject('19세기 러시아 역사 RPG와 단편소설')
    return c


def box(c, x, top, w, h, fill):
    c.setFillColor(color(fill))
    c.rect(x, c._pagesize[1] - top - h, w, h, fill=1, stroke=0)


def rule(c, x, top, w, shade=LINE):
    c.setStrokeColor(color(shade))
    c.setLineWidth(0.8)
    c.line(x, c._pagesize[1] - top, x + w, c._pagesize[1] - top)


def label(c, x, top, text, font='sans', size=11, shade=INK):
    c.setFont(font, size)
    c.setFillColor(color(shade))
    c.drawString(x, c._pagesize[1] - top - size, text)


def paragraph(c, x, top, width, text, *, size=11.5, leading=18, font='sans', shade=INK, max_height=None):
    style = ParagraphStyle('block', fontName=font, fontSize=size, leading=leading,
                           textColor=color(shade), alignment=TA_LEFT, splitLongWords=0)
    markup = text.replace('\n', '<br/>')
    p = Paragraph(markup, style)
    _, height = p.wrap(width, 10000)
    if max_height is not None and height > max_height:
        raise ValueError(f'Paragraph at {top} is {height} high, maximum is {max_height}: {text[:70]}')
    p.drawOn(c, x, c._pagesize[1] - top - height)
    return top + height


def photo(c, path, x, top, width, height, *, crop=None, matte=DARK):
    box(c, x, top, width, height, matte)
    with Image.open(path) as original:
        img = original.crop(crop) if crop else original.convert('RGB')
        scale = min(width / img.width, height / img.height)
        w, h = img.width * scale, img.height * scale
        c.drawImage(ImageReader(img), x+(width-w)/2, c._pagesize[1]-top-(height+h)/2, w, h)


def link(c, x, top, text=URL, size=12, shade=WINE):
    label(c, x, top, text, 'bold', size, shade)
    h = c._pagesize[1]
    c.linkURL(URL, (x, h-top-size-3, x + pdfmetrics.stringWidth(text, 'bold', size), h-top+2), relative=0)


def note_footer(c, n):
    rule(c, 42, 790, 511)
    label(c, 42, 800, f'{TITLE}    {ALIAS}', size=8, shade=DIM)
    label(c, 542, 800, str(n), size=8, shade=DIM)


def author_note():
    c = doc(OUT / f'{STEM}_작가노트 및 제작기록.pdf', A4, '작가 노트 및 제작 기록')
    box(c, 0, 0, 595.3, 842, PAPER_BRIGHT)
    label(c, 42, 33, '작가 노트 및 제작 기록', 'bold', 10.5, WINE)
    label(c, 41, 54, TITLE, 'serif', 37)
    label(c, 42, 112, f'{NAME} ({ALIAS})    {NUMBER}', 'sans', 10, DIM)
    label(c, 405, 112, '역사 RPG와 단편소설', 'sans', 10, DIM)
    photo(c, SHOTS / 'NORMAL-MAIN01-CARRIAGE-DECISION-1440x900.png', 42, 138, 511, 179,
          crop=(28, 300, 1413, 785))
    label(c, 42, 323, '게임 화면  ·  소피야의 집에서 마차를 어디로 보낼지 고르는 장면', size=8.5, shade=DIM)
    y = 346
    for part in INTRO.split('\n\n'):
        y = paragraph(c, 42, y, 511, escape(part), font='serif', size=11.3, leading=16.5, max_height=106) + 9
    if y > 529:
        raise ValueError(f'The introduction reaches the strategy section at {y}')
    rule(c, 42, 530, 511)
    label(c, 42, 541, '두 가지 표현 전략', 'bold', 11, WINE)
    paragraph(c, 42, 561, 240, '게임에서는 인쇄소에서 골목까지 직접 걷게 했다. 장면에서 읽은 문서가 다음 선택의 근거가 된다.',
              size=10.15, leading=14.8, max_height=46)
    paragraph(c, 313, 561, 240, '소설에는 청어와 빵이 거듭 나온다. 처음에는 외상값을 걱정하고, 마지막에는 내일 먹을 빵을 싸 둔다.',
              size=10.15, leading=14.8, max_height=46)
    rule(c, 42, 615, 511)
    label(c, 42, 626, '직접 쓴 각본과 인물 설정', 'bold', 11, WINE)
    for i, (area, detail) in enumerate(INTERVENTIONS):
        y = 647 + i * 32
        label(c, 42, y, area, 'bold', 9.5)
        paragraph(c, 87, y, 466, escape(detail), size=9.85, leading=13, max_height=28)
    label(c, 42, 755, '웹사이트  도시의 손들  ›  역사 현장  ›  금지된 삽화 연감', 'sans', 9.6)
    link(c, 42, 770, size=10.4)
    note_footer(c, 1)
    c.showPage()

    box(c, 0, 0, 595.3, 842, PAPER_BRIGHT)
    label(c, 42, 39, '제작 기록', 'serif', 29)
    rule(c, 42, 88, 511)
    label(c, 42, 103, '사용한 AI 도구', 'bold', 12, WINE)
    paragraph(c, 42, 124, 511,
              '각본과 인물 설정을 제공하고, OpenAI Codex로 게임 코드와 대사·소설 초안을 만들었다. '
              '초안을 읽으며 수정할 곳과 참고할 문장을 골랐다. 게임 속 자유 대화는 OpenAI API로 생성한다.',
              size=10.7, leading=15.4, max_height=48)
    label(c, 42, 181, '주요 프롬프트 원문 발췌', 'bold', 12, WINE)
    y = 204
    for heading, prompt in PROMPTS:
        label(c, 42, y, heading, 'bold', 9.9, DIM)
        y = paragraph(c, 52, y+17, 501, escape(f'“{prompt}”'), font='serif', size=11, leading=16.0, max_height=128) + 12
    if y > 430:
        raise ValueError(f'The prompts reach the course section at {y}')
    rule(c, 42, 443, 511)
    label(c, 42, 455, '수업 내용을 적용한 곳', 'bold', 12, WINE)
    y = 477
    for i, (step, concept, desc, _) in enumerate(COURSE, 1):
        label(c, 42, y, f'{step}  ·  {concept}', 'bold', 11, INK)
        x = 42 + pdfmetrics.stringWidth(f'{step}  ·  {concept}', 'bold', 11) + 5
        label(c, x, y-1, str(i), 'sans', 8, WINE)
        paragraph(c, 42, y+17, 511, escape(desc), size=10.4, leading=14, max_height=29)
        y += 50
    rule(c, 42, 688, 511)
    for i, (_, _, _, lecture) in enumerate(COURSE, 1):
        label(c, 42, 698+(i-1)*16, f'{i}  {lecture}', size=9.3, shade=DIM)
    note_footer(c, 2)
    c.showPage()
    c.save()


def slide(c, dark=False):
    box(c, 0, 0, 1280, 720, DARK if dark else PAPER)


def slide_title(c, text, top=53, dark=False):
    label(c, 68, top, text, 'serif', 49, PAPER if dark else INK)


def presentation():
    c = doc(OUT / f'{STEM}_발표자료.pdf', (1280, 720), '발표 자료')
    carriage = SHOTS / 'NORMAL-MAIN01-CARRIAGE-DECISION-1440x900.png'
    salon = SHOTS / 'NORMAL-MAIN01-SOFIYA-SALON-AFTERMATH-1440x900.png'
    storage = SHOTS / 'NORMAL-MAIN01-STORAGE-SHELVES-1440x900.png'
    typeset = SHOTS / 'NORMAL-MAIN01-PRINTWORK-TYPESET-1440x900.png'
    source = SHOTS / 'NORMAL-MAIN01-TALNIKOV-DOCUMENT-1440x900.png'
    ending = SHOTS / 'NORMAL-MAIN01-DRIVER-RETURN.png'

    slide(c, True)
    photo(c, salon, 502, 85, 710, 514, crop=(28, 115, 1413, 785))
    rule(c, 68, 177, 358, BRASS)
    label(c, 68, 203, '1848년 페테르부르크', 'sans', 20, BRASS)
    label(c, 65, 244, TITLE, 'serif', 65, PAPER)
    label(c, 68, 341, '역사 RPG와 단편소설', 'sans', 24, SOFT)
    label(c, 68, 611, f'{NUMBER}  {NAME}  ({ALIAS})', 'sans', 18, SOFT)
    c.showPage()

    slide(c)
    slide_title(c, '러시아의 이야기에서 한국을 돌아보다')
    label(c, 69, 134, '1848년, 인쇄를 마친 연감의 배포가 금지됐다.', 'sans', 26, WINE)
    rule(c, 69, 201, 450)
    paragraph(c, 69, 235, 440,
              '책을 금지하는 결정은 관청에서 내린다. 인쇄소의 도제는 내일도 일하러 와야 하는지 묻는다. 같은 사건이 이들에게는 얼마나 다르게 닥칠까.',
              font='serif', size=27, leading=40, max_height=200)
    paragraph(c, 69, 452, 440,
              '오늘 한국에서도 직장이나 생계 때문에 옳다고 생각하는 말을 삼키곤 한다. 그 망설임을 떠올리며 당시 사람들의 선택을 경험하게 하고 싶었다.',
              size=22, leading=33, shade=DIM, max_height=145)
    photo(c, storage, 574, 194, 638, 400)
    label(c, 574, 608, '배포가 막힌 인쇄물을 창고에 분류하는 화면', 'sans', 17, DIM)
    c.showPage()

    slide(c)
    slide_title(c, '인쇄소에서 시작하는 플레이')
    shots = [
        (typeset, '조판을 맡다', '활자를 골라 교정쇄를 만든다.'),
        (source, '원문을 읽다', '러시아어와 한국어로 같은 문서를 읽는다.'),
        (carriage, '마차를 보내다', '한 대의 마차를 어디로 보낼지 고른다.'),
    ]
    for i, (path, heading, detail) in enumerate(shots):
        x = 68+i*390
        photo(c, path, x, 180, 364, 227)
        label(c, x, 434, heading, 'serif', 35)
        paragraph(c, x, 490, 340, escape(detail), size=20, leading=31, shade=DIM, max_height=65)
    rule(c, 68, 587, 1144)
    paragraph(c, 68, 611, 1130,
              '게임은 인물의 처지에서 선택하고 결과를 겪게 한다. 소설에서는 청어와 빵이 거듭 등장한다. 외상값으로 시작한 이야기는 마부가 내일 먹을 빵을 싸는 장면으로 끝난다.',
              size=22, leading=32, max_height=68)
    c.showPage()

    slide(c, True)
    slide_title(c, '내가 쓴 각본 속 인물들', dark=True)
    rule(c, 68, 142, 1144, BRASS)
    label(c, 68, 188, '안나', 'serif', 36, PAPER)
    label(c, 68, 239, '수선 일을 하는 구독자', 'sans', 20, BRASS)
    paragraph(c, 68, 287, 510,
              '받을 돈이 밀려 있고 동생에게 빌려줄 책도 필요하다. 누군가 자신을 가난한 노동자의 표본처럼 대하면 화를 내는 인물로 썼다.',
              size=25, leading=39, shade=SOFT, max_height=161)
    label(c, 677, 188, '파벨', 'serif', 36, PAPER)
    label(c, 677, 239, '인쇄물을 나르는 배달원', 'sans', 20, BRASS)
    paragraph(c, 677, 287, 510,
              '배달을 그만두면 일감을 잃는다. 계속하면 검문에 걸릴 수 있다. 길과 수취인은 알아도, 봉투 속 내용은 읽기 전까지 모르게 설정했다.',
              size=25, leading=39, shade=SOFT, max_height=161)
    rule(c, 68, 519, 1144, BRASS)
    paragraph(c, 68, 549, 1130,
              '각본에는 인물마다 돈이 필요한 이유, 알고 있는 일, 모르는 일, 서로 부딪히는 이유를 적었다.',
              font='serif', size=28, leading=41, shade=PAPER, max_height=83)
    label(c, 70, 647, '제공한 V47 시나리오의 안나·파벨 설정에서', 'sans', 16, BRASS)
    c.showPage()

    slide(c)
    slide_title(c, '각본을 게임과 소설로 옮기며')
    label(c, 69, 145, '구현과 초안 작성에 Codex를 썼다.', 'sans', 25, WINE)
    rule(c, 69, 209, 1144)
    label(c, 69, 241, '직접 구성한 장면', 'bold', 20, WINE)
    paragraph(c, 69, 285, 520,
              '서점에서 부록을 묻는다.\n인쇄소에서 교정쇄를 확인한다.\n금지 뒤에는 남은 돈과 책을 처리한다.',
              font='serif', size=28, leading=43, max_height=178)
    label(c, 678, 241, 'AI로 만든 부분', 'bold', 20, WINE)
    paragraph(c, 678, 285, 510,
              '맵과 퀘스트 코드를 만들고, 대사와 소설 초안을 작성했다. 자유 대화에는 OpenAI API를 연결했다.',
              size=25, leading=39, max_height=178)
    rule(c, 69, 505, 1144)
    paragraph(c, 69, 543, 1110,
              'AI 덕분에 각본을 플레이해 보며 고칠 수 있었다. 하지만 대사는 길고 비슷했다. '
              '내가 고른 《죄와 벌》의 구절을 참고 자료로 주고, 가난을 가볍게 다룬 말과 억지로 교훈을 붙인 문장을 지적했다.',
              size=23, leading=36, shade=DIM, max_height=125)
    c.showPage()

    slide(c, True)
    slide_title(c, '마차를 보낸 뒤에도 할 일이 남는다', dark=True)
    photo(c, ending, 587, 162, 626, 387, crop=(28, 116, 1413, 833))
    paragraph(c, 69, 219, 474,
              '어디서 주무실 거냐고 스테판이 물었다.\n마부는 빵을 반으로 갈라 한쪽을 도로 쌌다.',
              font='serif', size=34, leading=54, shade=PAPER, max_height=226)
    label(c, 69, 447, '단편소설 《자유인의 마차》에서', size=17, shade=SOFT)
    paragraph(c, 69, 492, 474,
              '돕겠다고 선택한 뒤에도 책임질 수 있을까. 게임 밖의 내 생활에서도 묻고 싶은 말이다.',
              size=20, leading=30, shade=SOFT, max_height=70)
    rule(c, 69, 579, 1144, BRASS)
    label(c, 69, 604, '도시의 손들  ›  역사 현장  ›  금지된 삽화 연감', size=21, shade=PAPER)
    link(c, 69, 644, size=19, shade=BRASS)
    c.showPage()
    c.save()


if __name__ == '__main__':
    assert len(''.join(INTRO.split())) >= 300
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copy2(STORY, OUT / f'{STEM}.pdf')
    author_note()
    presentation()
    print(f'Intro excluding whitespace: {len("".join(INTRO.split()))}')
    for path in sorted(OUT.glob('*.pdf')):
        print(path)
