#!/usr/bin/env python3
"""Generate 6 fitness detail pages: chest, back, shoulders, legs, arms, core."""
import os

BASE = '/Users/lasky_my/ai-nav'

# ── Muscle data ──────────────────────────────────────────────
FITNESS = {
  "chest": {
    "title": "胸肌训练完全指南",
    "emoji": "🦾",
    "color": "#f87171",
    "color_name": "chest",
    "desc": "胸肌是你正面最显眼的肌肉。上胸决定饱满度，下胸决定轮廓。卧推是王牌动作。",
    "sections": [
      ("解剖结构", """胸大肌分为三个部分：
<b>上胸（锁骨部）</b> — 从锁骨到肱骨，决定胸肌的"饱满感"。很多人胸肌看起来平，就是因为上胸不够发达。上斜卧推和上斜飞鸟专门针对上胸。
<b>中胸（胸骨部）</b> — 胸大肌最大的部分，平板卧推的主要刺激区域。
<b>下胸（腹部）</b> — 从胸骨下部到肱骨，双杠臂屈伸和下斜卧推最有效。"""),
      ("核心动作", """<b>杠铃卧推</b> — 胸肌训练之王。肩胛骨收紧、脚踩实、杠铃下放到乳头位置。每组6-12次。
<b>哑铃飞鸟</b> — 拉伸感最强。手臂微弯保持不动，想象抱一棵大树。每组10-15次。
<b>绳索夹胸</b> — 持续张力。把绳索调到最高/最低/中间，分别刺激下胸/上胸/中胸。
<b>双杠臂屈伸</b> — 身体前倾30度，下放到上臂与地面平行。每组做到力竭。"""),
      ("训练计划", """<b>初学者（每周1次）</b>：平板卧推3×10 + 上斜哑铃卧推3×12 + 绳索夹胸2×15
<b>中级（每周2次）</b>：第1天：平板卧推4×8 + 上斜卧推3×10 + 飞鸟3×12。第2天：上斜卧推4×10 + 双杠臂屈伸3×力竭 + 绳索夹胸3×15
<b>避坑提示</b>：不要把杠铃弹在胸骨上！控制下放2秒、推起1秒。肩膀保持下沉，不要耸肩。"""),
      ("常见错误", """❌ 卧推时肩膀离开卧推凳 → 肩关节压力巨大，容易受伤
❌ 只用大重量做半程 → 肌肉在拉伸位置刺激最充分，全程动作更有效
❌ 忽略上胸 → 胸肌看起来下垂，没有"盔甲感"
❌ 飞鸟时手臂完全伸直 → 肘关节压力过大，手臂微弯才安全""")
    ],
    "exercises": [
      ("杠铃卧推", "中胸", "4×8-12", "胸肌整体厚度"),
      ("上斜哑铃卧推", "上胸", "3×10-12", "上胸饱满度"),
      ("哑铃飞鸟", "中胸", "3×12-15", "胸肌拉伸与宽度"),
      ("绳索夹胸", "中/下胸", "3×12-15", "持续张力与塑形"),
      ("双杠臂屈伸", "下胸", "3×力竭", "下胸线条"),
      ("俯卧撑", "整体", "3×力竭", "耐力与收尾"),
    ]
  },
  "back": {
    "title": "背部训练完全指南",
    "emoji": "🏋️",
    "color": "#6366f1",
    "color_name": "back",
    "desc": "背部决定你的倒三角体型。背阔肌是背部最大的肌肉，引体向上是最好的宽度动作。",
    "sections": [
      ("解剖结构", """背部由多个大肌群组成：
<b>背阔肌</b> — 背部面积最大的肌肉，从胸椎延伸到骨盆。宽度动作（引体向上、高位下拉）让它变宽，厚度动作（划船）让它变厚。
<b>斜方肌</b> — 分上中下三部分。上斜方负责耸肩，中下斜方负责肩胛骨回缩。过度训练上斜方会溜肩。
<b>竖脊肌</b> — 脊柱两侧的长条肌肉，负责脊柱伸展。硬拉是最好的竖脊肌训练。"""),
      ("核心动作", """<b>引体向上</b> — 背部宽度的王者动作。宽握、拉到下巴过杠。做不到的话用弹力带辅助或高位下拉代替。
<b>杠铃划船</b> — 背部厚度的核心动作。上身与地面45度角，杠铃沿大腿前侧拉到腹部。控制离心。
<b>高位下拉</b> — 引体向上的替代或补充。下拉时挺胸、肘向下后方拉。每组10-12次。
<b>哑铃划船</b> — 单侧训练纠正左右不平衡。一只手撑凳，另一只手把哑铃拉到髋部。"""),
      ("训练计划", """<b>初学者（每周1次）</b>：高位下拉3×12 + 坐姿划船3×12 + 哑铃划船3×10每侧
<b>中级（每周2次）</b>：第1天（宽度）：引体向上4×力竭 + 高位下拉3×10 + 直臂下压3×12。第2天（厚度）：杠铃划船4×8 + 哑铃划船3×10 + 坐姿划船3×12
<b>避坑提示</b>：划船类动作靠肘驱动，不是靠手臂拉！想象用肘关节去撞身后的人。"""),
      ("常见错误", """❌ 高位下拉时身体过度后仰 → 变成了划船，背阔肌刺激减少
❌ 划船时弓背 → 腰椎压力大，容易受伤。保持脊柱中立
❌ 引体向上只做半程 → 下放到手臂完全伸直，拉到下巴过杠
❌ 只用小臂发力 → 背部的意念是"肘驱动"，小臂只是钩子""")
    ],
    "exercises": [
      ("引体向上", "背阔肌宽度", "4×力竭", "背部宽度王牌"),
      ("高位下拉", "背阔肌", "3×10-12", "宽度训练"),
      ("杠铃划船", "背阔肌厚度", "4×8-12", "厚度核心"),
      ("哑铃划船", "背阔肌", "3×10每侧", "单侧平衡"),
      ("坐姿划船", "中背部", "3×12-15", "中背厚度"),
      ("直臂下压", "背阔肌", "3×12-15", "孤立收尾"),
    ]
  },
  "shoulders": {
    "title": "肩部训练完全指南",
    "emoji": "💪",
    "color": "#fb923c",
    "color_name": "shoulders",
    "desc": "肩膀决定上半身的宽度和立体感。三角肌分前中后三束，需要均衡发展。",
    "sections": [
      ("解剖结构", """三角肌分为三个独立的束：
<b>三角肌前束</b> — 肩膀正面。几乎所有推类动作（卧推、俯卧撑）都会用到前束。大多数人前束已经过度发达，不需要额外大量训练。
<b>三角肌中束</b> — 肩膀外侧。这是决定肩膀"宽度"的关键！侧平举是中束最有效的孤立动作。
<b>三角肌后束</b> — 肩膀后面。最容易被人忽略的一束。没有后束，肩膀从侧面看是平的、没有立体感。面拉和反向飞鸟专门训练后束。"""),
      ("核心动作", """<b>哑铃推举</b> — 肩部复合动作之王。坐姿减少借力，每组8-12次。
<b>侧平举</b> — 中束孤立动作。轻重量、高次数（15-20次）。不要甩！控制1秒上、2秒下的节奏。
<b>绳索面拉</b> — 后束最佳动作。把绳索拉到额头高度，同时外旋肩膀。每组12-15次。
<b>反向飞鸟</b> — 俯身或坐姿，手臂微弯向两侧打开。专注后束收缩。"""),
      ("训练计划", """<b>初学者（每周1次）</b>：哑铃推举3×10 + 侧平举3×15 + 反向飞鸟3×15
<b>中级（每周2次）</b>：第1天（侧重前中束）：哑铃推举4×8 + 侧平举4×15 + 前平举3×12。第2天（侧重中后束）：侧平举4×15 + 面拉3×12 + 反向飞鸟3×15
<b>避坑提示</b>：侧平举宁轻勿重！15kg甩上去不如8kg控制着做。肩关节容易受伤，充分热身是必须的。"""),
      ("常见错误", """❌ 侧平举重量太大 → 斜方肌代偿，肩膀没练到反而脖子粗了
❌ 推举时杠铃下放到脖子后面 → 肩关节极限位置，极易受伤
❌ 只练前束不练后束 → 肩膀前倾、圆肩，体态越来越差
❌ 不做热身 → 肩关节是人体最灵活的关节，也是最容易受伤的""")
    ],
    "exercises": [
      ("哑铃推举", "前束+中束", "4×8-12", "肩部复合动作"),
      ("侧平举", "中束", "4×15-20", "肩膀宽度关键"),
      ("绳索面拉", "后束", "3×12-15", "后束最佳动作"),
      ("反向飞鸟", "后束", "3×15-20", "后束孤立"),
      ("前平举", "前束", "3×12-15", "前束补充"),
      ("阿诺德推举", "前+中束", "3×10-12", "旋转刺激全束"),
    ]
  },
  "legs": {
    "title": "腿部训练完全指南",
    "emoji": "🦵",
    "color": "#34d399",
    "color_name": "legs",
    "desc": "腿部是人体最大的肌群。深蹲是力量训练之王。练腿不只为了好看——更关乎全身力量。",
    "sections": [
      ("解剖结构", """腿部包含多个大肌群：
<b>股四头肌</b> — 大腿前面，由四块肌肉组成。深蹲是最有效的复合动作。股四头肌的力量直接影响你的运动能力。
<b>腘绳肌</b> — 大腿后面，三块肌肉。很多人忽略腘绳肌训练，导致前后力量不平衡，增加膝盖受伤风险。
<b>臀大肌</b> — 人体体积最大的单块肌肉。不仅关乎体型，硬拉和深蹲的力量都依赖臀大肌。
<b>小腿肌群</b> — 腓肠肌（后面）和比目鱼肌。小腿耐力极强，需要高次数刺激。"""),
      ("核心动作", """<b>杠铃深蹲</b> — 力量训练的王者动作。杠铃放在斜方肌上（不是脖子上！），下蹲到大腿与地面平行或更低。每组5-10次。
<b>硬拉</b> — 后链肌群的终极动作。保持脊柱中立，杠铃贴近小腿，用臀部发力站起。每组3-8次。
<b>腿举</b> — 深蹲的机器替代方案。脚放在踏板上方偏外侧，下放到90度。每组10-15次。
<b>箭步蹲</b> — 单侧训练纠正不平衡。上身挺直，后膝轻触地面不撞击。每组10-12次每侧。"""),
      ("训练计划", """<b>初学者（每周1次）</b>：深蹲3×10 + 腿举3×12 + 腿弯举3×12 + 提踵3×20
<b>中级（每周2次）</b>：第1天（侧重股四头肌）：深蹲4×8 + 腿举3×10 + 腿屈伸3×12 + 箭步蹲3×10每侧。第2天（侧重后链）：硬拉4×5 + 罗马尼亚硬拉3×10 + 腿弯举3×12 + 臀推3×12
<b>避坑提示</b>：深蹲前充分热身膝盖和髋关节！练腿日消耗极大，训练前2小时要吃碳水。"""),
      ("常见错误", """❌ 深蹲时膝盖内扣 → 膝关节压力巨大，容易半月板损伤
❌ 深蹲只做半程 → 大腿没有下到平行线，股四头肌刺激不足
❌ 硬拉弓背 → 腰椎受伤的头号原因。宁轻勿重，保持脊柱中立
❌ 完全跳过练腿日 → 上半身壮如牛、下半身细如筷，比例失调""")
    ],
    "exercises": [
      ("杠铃深蹲", "股四头肌+臀", "4×6-10", "力量训练之王"),
      ("硬拉", "后链+竖脊肌", "3×3-8", "全身力量核心"),
      ("腿举", "股四头肌", "3×10-15", "安全替代深蹲"),
      ("箭步蹲", "股四+臀", "3×10每侧", "平衡+塑形"),
      ("腿弯举", "腘绳肌", "3×12-15", "后链孤立"),
      ("站姿提踵", "小腿", "4×15-25", "小腿线条"),
    ]
  },
  "arms": {
    "title": "手臂训练完全指南",
    "emoji": "💪",
    "color": "#f59e0b",
    "color_name": "arms",
    "desc": "粗壮的手臂是最直观的训练成果。肱三头肌占上臂2/3体积——想要粗手臂，三头比二头更重要。",
    "sections": [
      ("解剖结构", """手臂主要肌群：
<b>肱二头肌</b> — 手臂前侧，分长头和短头。弯举类动作直接刺激。长头在外侧，短头在内侧。锤式弯举可以额外刺激肱肌，让手臂看起来更厚。
<b>肱三头肌</b> — 手臂后侧，分长头、外侧头和内侧头。占上臂体积的2/3！想要粗手臂，三头比二头更重要。绳索下压和窄距卧推最有效。
<b>前臂肌群</b> — 前臂屈肌（内侧）和伸肌（外侧）。握力是所有拉类动作的基础。腕弯举和反握弯举专门训练。"""),
      ("核心动作", """<b>杠铃弯举</b> — 二头肌的经典动作。上臂夹紧身体不动，只有前臂移动。每组10-12次。
<b>锤式弯举</b> — 哑铃掌心相对，同时刺激肱肌。让手臂看起来更厚实。每组10-12次。
<b>窄距卧推</b> — 三头肌最好的复合动作。握距与肩同宽，杠铃下放到下胸位置。每组8-10次。
<b>绳索下压</b> — 三头肌孤立动作。上臂贴紧身体，用绳索或直杆，下压到手臂完全伸直。"""),
      ("训练计划", """<b>初学者（每周1次）</b>：杠铃弯举3×10 + 绳索下压3×12 + 锤式弯举2×12
<b>中级（每周1-2次）</b>：杠铃弯举3×10 + 牧师凳弯举3×12 + 窄距卧推3×8 + 绳索下压3×12 + 腕弯举2×15
<b>避坑提示</b>：手臂是相对小的肌群，不需要太多组数。9-12组二头+9-12组三头就足够了。超过20组反而影响恢复。"""),
      ("常见错误", """❌ 弯举时身体摇晃借力 → 重量太大，二头肌没有孤立刺激
❌ 只练二头不练三头 → 手臂从后面看是平的，前面看也不够粗
❌ 手臂训练放在大重量日的第二天 → 手臂还没恢复，影响训练效果
❌ 忽略离心阶段 → 控制下放（2-3秒）比快速弯举对肌肉刺激更大""")
    ],
    "exercises": [
      ("杠铃弯举", "肱二头肌", "3×10-12", "二头整体厚度"),
      ("锤式弯举", "肱肌+二头", "3×10-12", "手臂宽度"),
      ("绳索下压", "肱三头肌", "3×12-15", "三头孤立塑形"),
      ("窄距卧推", "肱三头肌", "3×8-10", "三头复合力量"),
      ("牧师凳弯举", "肱二头肌短头", "3×12-15", "二头肌峰"),
      ("腕弯举", "前臂屈肌", "3×15-20", "握力+前臂"),
    ]
  },
  "core": {
    "title": "核心训练完全指南",
    "emoji": "🎯",
    "color": "#a78bfa",
    "color_name": "core",
    "desc": "核心不只是腹肌。它是你所有力量传递的中枢。练核心的关键不是卷腹次数——是体脂率。",
    "sections": [
      ("解剖结构", """核心不仅仅是六块腹肌：
<b>腹直肌</b> — 我们常说的"六块腹肌"。分上腹和下腹，卷腹偏上腹，举腿偏下腹。但能不能看到腹肌取决于体脂率——男性15%以下、女性22%以下。
<b>腹横肌</b> — 最深层的腹肌，像天然的腰带。平板支撑是最好的训练方式。强大的腹横肌保护腰椎。
<b>腹斜肌</b> — 腹部两侧，分内外两层。俄罗斯转体和侧平板刺激腹斜肌。注意：过度训练腹斜肌会让腰看起来更粗。
<b>竖脊肌</b> — 下背核心。硬拉和山羊挺身训练。强壮的下背是防止腰伤的关键。"""),
      ("核心动作", """<b>平板支撑</b> — 核心稳定性的黄金动作。身体一条直线，臀部不要翘也不要塌。从30秒开始，目标是2分钟以上。
<b>卷腹</b> — 腹直肌上部的孤立动作。下背贴紧地面，用腹肌的力量把肩膀抬离地面，不是用脖子甩！
<b>悬垂举腿</b> — 下腹最有效的动作。悬挂在单杠上，膝盖或直腿向上抬起。每组做到力竭。
<b>健腹轮</b> — 全身核心的终极挑战。从膝盖位置开始，向前推直到身体几乎平行于地面，然后拉回来。"""),
      ("训练计划", """<b>初学者（每周2次）</b>：平板支撑3×30秒 + 卷腹3×15 + 死虫式3×10每侧
<b>中级（每周2-3次）</b>：平板支撑3×60秒 + 悬垂举腿3×力竭 + 卷腹3×20 + 健腹轮3×8 + 俄罗斯转体3×15每侧
<b>避坑提示</b>：练腹肌不能减肚子脂肪！体脂率是饮食决定的，不是卷腹决定的。想看到腹肌=饮食控制+有氧+核心训练三管齐下。"""),
      ("常见错误", """❌ 卷腹时用脖子使劲 → 双手放耳朵两侧不是抱头，用腹部发力不是脖子
❌ 平板支撑塌腰 → 核心没收紧等于没做，保持骨盆后倾
❌ 每天练腹肌 → 腹肌也是肌肉，需要48小时恢复。隔天练更有效
❌ 只做卷腹不练下背 → 前后不平衡导致骨盆前倾，下背痛""")
    ],
    "exercises": [
      ("平板支撑", "腹横肌+整体", "3×力竭", "核心稳定性"),
      ("卷腹", "腹直肌上部", "3×15-20", "上腹线条"),
      ("悬垂举腿", "腹直肌下部", "3×力竭", "下腹最佳动作"),
      ("健腹轮", "整体核心", "3×8-12", "全身核心挑战"),
      ("俄罗斯转体", "腹斜肌", "3×15每侧", "侧腹线条"),
      ("山羊挺身", "竖脊肌", "3×12-15", "下背强壮"),
    ]
  }
}

# ── Template ─────────────────────────────────────────────────
def page(m):
    t = m["title"]
    emoji = m["emoji"]
    color = m["color"]
    color_name = m["color_name"]
    desc = m["desc"]
    sections = m["sections"]
    exercises = m["exercises"]

    # Build section HTML
    sec_html = ""
    for i, (heading, body) in enumerate(sections):
        body_html = body.replace('\n', '<br>')
        sec_id = f"s{i+1}"
        sec_html += f'''<div class="content-section" id="{sec_id}">
<h2>{heading}</h2>
<p class="section-body">{body_html}</p>
</div>'''

    # Build exercise table rows
    ex_rows = ""
    for ex_name, target, sets, benefit in exercises:
        ex_rows += f'<tr><td>{ex_name}</td><td>{target}</td><td>{sets}</td><td>{benefit}</td></tr>'

    # Navigation links
    nav_links = {
        "chest":    ("back", "背部训练"),
        "back":     ("shoulders", "肩部训练"),
        "shoulders": ("legs", "腿部训练"),
        "legs":     ("arms", "手臂训练"),
        "arms":     ("core", "核心训练"),
        "core":     ("chest", "胸肌训练"),
    }
    prev_key, prev_label = None, None
    next_key, next_label = None, None
    keys = ["chest","back","shoulders","legs","arms","core"]
    idx = keys.index(color_name)
    if idx > 0:
        prev_key = keys[idx-1]
        prev_label = FITNESS[keys[idx-1]]["title"]
    if idx < len(keys)-1:
        next_key = keys[idx+1]
        next_label = FITNESS[keys[idx+1]]["title"]

    nav_html = ""
    if prev_key:
        nav_html += f'<a class="btn" href="./fitness-{prev_key}.html">← {prev_label}</a>'
    if next_key:
        nav_html += f'<a class="btn" href="./fitness-{next_key}.html">{next_label} →</a>'
    nav_html += f'<a class="btn" href="./fitness-muscles.html">📋 肌肉总览</a>'

    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
<meta name="theme-color" content="#0a0a0f">
<title>{t} · AI Nav 健身</title>
<link rel="stylesheet" href="./shared.css">
<link rel="icon" href="./icon.svg">
<style>
:root{{--bg:#0a0a0f;--card-bg:rgba(255,255,255,.06);--card-border:rgba(255,255,255,.08);--a1:#6366f1;--cyan:#06B6D4;--pink:#ec4899;--amber:#F59E0B;--green:#10B981;--tx:rgba(255,255,255,.92);--tx2:rgba(255,255,255,.55);--tx3:rgba(255,255,255,.35);--tx4:rgba(255,255,255,.18);--r:18px;--ease:cubic-bezier(.22,1,.36,1)}}
*,::before,::after{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--tx);font-size:15px;line-height:1.7;min-height:100vh;padding-bottom:80px;-webkit-font-smoothing:antialiased;overflow-x:hidden}}
.bg{{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0}}
.bg__orb{{position:absolute;border-radius:50%;filter:blur(120px);opacity:.35}}
.bg__orb:nth-child(1){{width:500px;height:500px;background:radial-gradient(circle,{color} 0%,transparent 70%);top:-15%;left:-10%;animation:floatOrb 20s ease-in-out infinite}}
.bg__orb:nth-child(2){{width:400px;height:400px;background:radial-gradient(circle,var(--a1) 0%,transparent 70%);bottom:-10%;right:-8%;animation:floatOrb 24s ease-in-out infinite reverse}}
.bg__orb:nth-child(3){{width:350px;height:350px;background:radial-gradient(circle,var(--pink) 0%,transparent 70%);top:50%;left:50%;animation:floatOrb 22s ease-in-out infinite;animation-delay:-7s}}
@keyframes floatOrb{{0%,100%{{transform:translate(0,0)scale(1)}}25%{{transform:translate(80px,-60px)scale(1.15)}}50%{{transform:translate(-40px,40px)scale(.9)}}75%{{transform:translate(-60px,-30px)scale(1.1)}}}}
.glow-spot{{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:1}}
.wrap{{max-width:760px;margin:0 auto;padding:20px;position:relative;z-index:1}}

h1{{font-size:26px;font-weight:700;margin:12px 0 4px;background:linear-gradient(135deg,{color},var(--cyan),var(--pink));background-size:300% 300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:tFlow 5s ease-in-out infinite}}
@keyframes tFlow{{0%{{background-position:0% 50%}}50%{{background-position:100% 100%}}100%{{background-position:0% 50%}}}}
.hero-desc{{font-size:13px;color:var(--tx3);margin-bottom:16px}}

h2{{font-size:17px;font-weight:700;color:{color};margin:24px 0 10px;border-left:3px solid {color};padding-left:12px}}
h3{{font-size:14px;font-weight:700;color:var(--tx);margin:16px 0 8px}}

/* Reading modes */
.reading-mode{{display:flex;gap:8px;margin:16px 0}}
.mode-btn{{flex:1;padding:12px 8px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:var(--tx3);font-size:11px;cursor:pointer;text-align:center;transition:all .3s;font-family:inherit}}
.mode-btn:hover{{border-color:rgba(99,102,241,.2);color:var(--tx2)}}
.mode-btn.active{{border-color:rgba(99,102,241,.4);background:rgba(99,102,241,.1);color:var(--a1);font-weight:600}}
.mode-time{{display:block;font-size:22px;font-weight:700;margin-bottom:2px}}
.mode-label{{font-size:10px;opacity:.6}}

.content-section{{margin:12px 0;transition:all .3s}}
.content-section.hidden{{display:none}}
.section-body{{font-size:14px;color:var(--tx2);line-height:1.9}}

/* Exercise table */
.ex-table{{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.06)}}
.ex-table td,.ex-table th{{border:1px solid rgba(255,255,255,.05);padding:10px 14px;text-align:left}}
.ex-table th{{background:rgba(255,255,255,.04);color:{color};font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.03em}}
.ex-table td{{color:var(--tx2)}}
.ex-table tr:hover td{{background:rgba(255,255,255,.02)}}
.ex-table td:first-child{{font-weight:600;color:var(--tx)}}

/* Card */
.card{{background:var(--card-bg);backdrop-filter:saturate(180%) blur(40px);-webkit-backdrop-filter:saturate(180%) blur(40px);border:1px solid var(--card-border);border-radius:var(--r);padding:18px;margin:12px 0;position:relative;overflow:hidden}}
.card::after{{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,.04) 0%,transparent 45%,transparent 65%,rgba(255,255,255,.01) 100%);pointer-events:none}}
.card-tip{{background:rgba(99,102,241,.04);border-color:rgba(99,102,241,.15)}}

/* Nav */
.nav-btns{{display:flex;gap:8px;margin:28px 0 12px;flex-wrap:wrap}}
.btn{{display:inline-block;padding:10px 18px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:var(--tx2);font-size:12px;text-decoration:none;transition:all .25s;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}}
.btn:hover{{border-color:rgba(99,102,241,.25);color:var(--tx);background:rgba(255,255,255,.08)}}

.back{{text-align:center;margin-top:24px}}.back a{{color:var(--tx4);font-size:11px;text-decoration:none}}

@media(max-width:600px){{.wrap{{padding:14px}}h1{{font-size:20px}}.ex-table td,.ex-table th{{padding:6px 8px;font-size:11px}}.reading-mode{{flex-wrap:wrap}}}}
</style>
</head>
<body>
<div class="bg"><div class="bg__orb"></div><div class="bg__orb"></div><div class="bg__orb"></div></div>
<div class="glow-spot" id="glowSpot"></div>

<div class="wrap">
<h1>{emoji} {t}</h1>
<p class="hero-desc">{desc}</p>

<!-- 136 Reading Modes -->
<div class="reading-mode">
  <button class="mode-btn active" onclick="setMode('1min',this)"><span class="mode-time">1</span><span class="mode-label">分钟速览</span></button>
  <button class="mode-btn" onclick="setMode('3min',this)"><span class="mode-time">3</span><span class="mode-label">分钟精读</span></button>
  <button class="mode-btn" onclick="setMode('6min',this)"><span class="mode-time">6</span><span class="mode-label">分钟深读</span></button>
</div>

{sec_html}

<!-- Training Plan Summary -->
<h2>📋 训练动作一览</h2>
<table class="ex-table">
<thead><tr><th>动作</th><th>目标区域</th><th>组数×次数</th><th>作用</th></tr></thead>
<tbody>{ex_rows}</tbody>
</table>

<!-- Tip Card -->
<div class="card card-tip">
<h3>💡 关键提示</h3>
<p style="font-size:13px;color:var(--tx2);line-height:1.8">训练前做10分钟动态热身（特别是目标关节）。每个动作先做1-2组轻重量热身。控制离心阶段（下放2-3秒），肌肉在拉伸位置受到的刺激最大。训练后30分钟内补充蛋白质。</p>
</div>

<!-- Navigation -->
<div class="nav-btns">{nav_html}</div>
<div class="back"><a href="./fitness-muscles.html">← 返回肌肉总览</a> · <a href="./index.html">返回首页</a></div>
</div>

<script>
// 136 Reading Mode
function setMode(mode,btn){{
  document.querySelectorAll('.mode-btn').forEach(function(b){{b.classList.remove('active')}});
  btn.classList.add('active');
  var sections=document.querySelectorAll('.content-section');
  if(mode==='1min'){{
    // Show only first section
    sections.forEach(function(s,i){{s.classList.toggle('hidden',i!==0)}});
  }}else if(mode==='3min'){{
    // Show first 2 sections
    sections.forEach(function(s,i){{s.classList.toggle('hidden',i>=2)}});
  }}else{{
    // Show all
    sections.forEach(function(s){{s.classList.remove('hidden')}});
  }}
}}

// Glow
(function(){{var g=document.getElementById('glowSpot');if(!g||'ontouchstart' in window)return;var x=window.innerWidth/2,y=window.innerHeight/2,tx=x,ty=y;document.addEventListener('mousemove',function(e){{tx=e.clientX;ty=e.clientY}});function anim(){{x+=(tx-x)*0.05;y+=(ty-y)*0.05;g.style.background='radial-gradient(circle 420px at '+x.toFixed(0)+'px '+y.toFixed(0)+'px,rgba(99,102,241,.06) 0%,rgba(236,72,153,.035) 18%,rgba(6,182,212,.02) 42%,transparent 70%)';requestAnimationFrame(anim)}}anim()}})();
</script>
<script src="./shared.js"></script>
</body>
</html>'''

# ── Generate ──────────────────────────────────────────────────
for key, data in FITNESS.items():
    filepath = os.path.join(BASE, f'fitness-{key}.html')
    content = page(data)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Created: fitness-{key}.html ({len(content)} bytes)')

print('\nDone. 6 pages generated.')
