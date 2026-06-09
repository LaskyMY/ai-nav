# AI Nav 页面设计规范 v1.0

> **权威来源** | 所有页面必须遵循 | 每次设计前必读 | 冒烟测试自动检查

---

## 设计哲学

液态玻璃（Glass Morphism）+ 暗色深空背景 + 流动渐变 + 微交互反馈。核心感觉：高级、冷静、科技、轻盈。

---

## 一、颜色系统

### CSS变量（必须使用，禁止硬编码）

```css
:root {
  --bg:    #0a0a0f;
  --a1:    #6366f1;   /* 主色-靛蓝紫 */
  --cyan:  #06B6D4;   /* 强调色-青色 */
  --pink:  #ec4899;   /* 点缀色-粉红 */
  --amber: #F59E0B;   /* 警告色-琥珀 */
  --green: #10B981;   /* 成功色-翠绿 */
  --red:   #EF4444;   /* 危险色-红色 */
  --tx:    rgba(255,255,255,.92);
  --tx2:   rgba(255,255,255,.55);
  --tx3:   rgba(255,255,255,.35);
  --tx4:   rgba(255,255,255,.18);
  --card-bg:    rgba(255,255,255,.06);
  --card-border:rgba(255,255,255,.08);
  --r: 16px;
  --ease: cubic-bezier(.22,1,.36,1);
}
```

### h1渐变动画（必须）

```css
background: linear-gradient(135deg, var(--a1), var(--cyan), var(--pink));
background-size: 300% 300%;
-webkit-background-clip: text; -webkit-text-fill-color: transparent;
animation: tFlow 5s ease-in-out infinite;
```

### 文字颜色层级

| 层级 | 颜色 | 用途 |
|------|------|------|
| L1 | rgba(255,255,255,.92) | 正文、卡片标题 |
| L2 | rgba(255,255,255,.55) | 描述文本 |
| L3 | rgba(255,255,255,.35) | 提示、元数据 |
| L4 | rgba(255,255,255,.18) | 占位、禁用 |

---

## 二、字体系统

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
```

| 元素 | 字号 | 字重 | 行高 |
|------|------|------|------|
| h1 | 26-30px | 700 | 1.3 |
| h2 | 16-20px | 700 | 1.4 |
| 正文 | 14-15px | 400 | 1.7-1.8 |
| 辅助 | 11-13px | 400 | 1.5 |
| 标签 | 9-11px | 600 | 1.3 |

---

## 三、间距系统（8px基准）

| Token | 值 | 用途 |
|-------|-----|------|
| xs | 4px | 图标间距 |
| sm | 8px | 元素间距 |
| md | 12px | 卡片间距 |
| lg | 16px | 页面padding |
| xl | 20-24px | 模块间距 |

```css
.container { max-width: 800px; padding: 20px; margin: 0 auto; }
@media (max-width: 500px) { .container { padding: 14px; } h1 { font-size: 22px; } }
```

---

## 四、背景系统

### 4.1 暗色基底
```css
body { background: var(--bg); overflow-x: hidden; }
```

### 4.2 光球（必须）
```html
<div class="bg">
  <div class="bg__orb"></div>
  <div class="bg__orb"></div>
</div>
```
- 2个光球，filter: blur(120px), opacity: 0.4
- floatOrb动画，20s/24s错开

### 4.3 鼠标光晕（必须，移动端自动禁用）
```html
<div class="glow-spot" id="glowSpot"></div>
```
- rAF驱动，lerp 0.05平滑跟随
- 420px径向渐变，多层色停止点
- 触摸设备自动跳过

---

## 五、液态玻璃

### 卡片
```css
background: var(--card-bg);
backdrop-filter: saturate(180%) blur(40px);
border: 1px solid var(--card-border);
border-radius: var(--r);
box-shadow: 0 0 60px rgba(99,102,241,.04), 0 4px 24px rgba(0,0,0,.1);
```
- 必须有 `::after` 光泽伪元素
- hover: translateY(-2px) + 发光box-shadow
- active: scale(.98)

### 顶栏
```css
position: sticky; top: 0; z-index: 50;
background: rgba(24,24,32,.78);
backdrop-filter: saturate(200%) blur(60px);
border-radius: 0 0 22px 22px;
```
- 左: 返回按钮 | 右: 主页按钮

### 底栏
```css
position: fixed; bottom: 12px; z-index: 100;
border-radius: 22px;
```
- 三个按钮: 返回 | ↑顶部 | 主页

---

## 六、动画系统

| 动画 | 时长 | 触发 |
|------|------|------|
| tFlow标题 | 5s | 自动循环 |
| floatOrb光球 | 20-24s | 自动循环 |
| fadeUp卡片 | .5s | 页面加载 |
| hover抬高 | .35s | :hover |
| active缩放 | .12s | :active scale(.96) |
| 光晕跟随 | 连续 | mousemove rAF |

- 只动画 transform + opacity（GPU加速）
- 禁用动画 width/height

---

## 七、组件库

### 必选组件（所有页面）

| # | 组件 | 要求 |
|---|------|------|
| 1 | DOCTYPE + lang="zh-CN" | 必须 |
| 2 | viewport meta | 必须 |
| 3 | theme-color meta | 必须 |
| 4 | CSS :root变量 | 必须 |
| 5 | body bg #0a0a0f | 必须 |
| 6 | 光球 .bg | 必须（2个） |
| 7 | 光晕 #glowSpot | 必须 |
| 8 | 顶栏 .header | 必须（时钟除外） |
| 9 | h1渐变动画 | 必须 |
| 10 | 卡片玻璃+::after | 必须 |
| 11 | 返回链接 | 必须 |
| 12 | 底栏 .bottom-nav | 必须（时钟除外） |
| 13 | FAB回到顶部 | 必须（时钟除外） |
| 14 | 光晕JS脚本 | 必须 |
| 15 | system-ui字体 | 必须 |
| 16 | @media mobile | 必须 |
| 17 | antialiased | 必须 |
| 18 | overflow-x hidden | 必须 |

### 按钮规范
```css
.btn { padding:10px 18px; border-radius:10px; backdrop-filter:blur(20px); }
```
5种类型: .btn / .btn.primary / .btn.green / .btn.danger / .btn.orange

---

## 八、页面分类

| 分类 | 示例 | 顶栏 | 底栏 | FAB | 光球 |
|------|------|:--:|:--:|:--:|:--:|
| Hub页 | knowledge, manual, hardware | ✅ | ✅ | ✅ | ✅ |
| 内容页 | financial-news, vibe-coding/* | ✅ | ✅ | ✅ | ✅ |
| 工具页 | esp32-* | ✅ | ✅ | ✅ | ✅ |
| 时钟 | clock* | ❌ | ❌ | ❌ | ❌ |

**时钟看板是唯一例外**——全屏沉浸式仪表盘。

---

## 九、QA检查清单（每次设计后用）

```
[ ] 页面有 <!DOCTYPE html> + lang
[ ] 页面有 viewport meta
[ ] 页面有 theme-color meta (#0a0a0f)
[ ] 页面有 CSS :root 变量块
[ ] 页面有 body { background: var(--bg) }
[ ] 页面有 <div class="bg"><div class="bg__orb">
[ ] 页面有 <div class="glow-spot" id="glowSpot">
[ ] 页面有 <div class="header"> (非时钟页)
[ ] h1 有渐变色 + tFlow 动画
[ ] .card 有玻璃效果 + ::after 光泽
[ ] 页面有返回链接 (非Hub页)
[ ] 页面有 <div class="bottom-nav"> (非时钟页)
[ ] 页面有 FAB 回到顶部 (非时钟页)
[ ] 页面有光晕 JS 脚本
[ ] 字体为 system-ui
[ ] 有 @media (max-width:500px)
[ ] -webkit-font-smoothing: antialiased
[ ] body { overflow-x: hidden }
[ ] 无硬编码色值（全部用CSS变量）
[ ] 无外部字体加载
[ ] 无外部CSS/JS框架依赖
```

---

> 最后更新: 2026-06-10 | 版本: v1.0 | 基于 index.html + knowledge.html 提炼

---

## 十、开发工作流（强制遵循）

### 每次修改页面必须执行：

```
1. 对照 §九 QA检查清单 逐项自查
2. 运行冒烟测试: deno run --allow-net --allow-read tests/smoke-test.js
3. 确保 设计规范QA 全部 PASS
4. git add -A
5. git commit -m "描述修改内容"
6. git push
7. 验证 GitHub Pages 部署成功
```

### 每次提交必须包含：
- [ ] 修改的文件已 git add
- [ ] commit message 清晰描述改动
- [ ] 冒烟测试通过 (100%)
- [ ] 设计规范QA通过 (100%)
- [ ] 版本号已更新 (如果有功能变更)
- [ ] 更新日志已追加 (如果有功能变更)

### 禁止行为：
- ❌ 修改后不提交直接告诉用户"完成了"
- ❌ 提交但不推送
- ❌ 跳过冒烟测试
- ❌ 新页面不遵循设计规范

> ⚠️ 违反以上规则 = 工作未完成

---

## 十一、主页完整元素清单（所有子页面必须对标）

### 主页 header 包含元素：

| # | 元素 | ID/Class | 说明 |
|---|------|----------|------|
| 1 | Logo | .header-logo | 渐变色网站名称 |
| 2 | 搜索栏 | #searchInput | 搜索工具/论文 |
| 3 | **实时时钟** | #clock | 动态显示 HH:MM |
| 4 | **天气徽章** | #weatherBadge | 天气图标+温度 |
| 5 | 收藏按钮 | #favBtn | ⭐ 收藏 |
| 6 | **版本号** | #topVer | v-xx |

### 子页面 header 必须包含（shared.js v3 自动注入）：

| # | 元素 | 说明 |
|---|------|------|
| 1 | 返回按钮 | 链接到父页面 |
| 2 | 页面标题 | 从 `<title>` 提取 |
| 3 | **实时时钟** | HH:MM 每30秒更新 |
| 4 | **版本号** | 从 localStorage 读取 |
| 5 | 主页按钮 | ⌂ 链接到 index |

### 背景系统（所有页面）：

| # | 元素 | 数量 | 说明 |
|---|------|:--:|------|
| 1 | 光球 .bg__orb | 3个 | 紫/粉/青 三色，blur 120px |
| 2 | 光晕 .glow-spot | 1个 | 420px径向渐变，鼠标跟随 |
| 3 | 底色 | #0a0a0f | 深空蓝黑 |

### 底部系统（所有页面，时钟除外）：

| # | 元素 | 说明 |
|---|------|------|
| 1 | 底栏 .bottom-nav | ↑顶部 ←返回 ⌂主页 |
| 2 | FAB .fab-top | ↑ 浮动回到顶部 |


---

## 十二、页面四级分类与完整元素对照表

### A级：主页 (index.html)
**特征：** 全功能页面，所有元素齐全
| 区域 | 必须元素 |
|------|---------|
| 顶栏 | Logo · 搜索 · 时钟 · 天气 · 收藏 · 版本号 |
| 内容 | Hero卡片 · 待办 · 每日任务 · 金融简报 · Insights · 趋势/论文/统计Tab |
| 底栏 | 15个导航按钮(iOS Tab Bar风格) |
| 背景 | 3光球 · 鼠标光晕 |

### B级：Hub页 (knowledge, manual, hardware, dashboards, sitemap)
**特征：** 目录式聚合页
| 区域 | 必须元素 |
|------|---------|
| 顶栏(自动) | 返回 · 标题 · 时钟 · 版本 · 主页 |
| 内容 | Hero(emoji+h1+描述) · 统计数字 · 分类标题 · 卡片列表(fadeUp) |
| 底栏(自动) | ↑顶部 · ←返回 · ⌂主页 |
| FAB(自动) | ↑浮动按钮 |
| 背景(自动) | 3光球 · 光晕 |

### C级：内容页 (vibe-coding-lessons/*, financial-news, papers, changelog, 手册4页)
**特征：** 长文阅读/数据展示
| 区域 | 必须元素 |
|------|---------|
| 顶栏(自动) | 返回 · 标题 · 时钟 · 版本 · 主页 |
| 内容 | 面包屑 · 进度条(可选) · TOC(可选) · h1+描述 · 卡片内容 · 导航按钮 · **返回链接** |
| 底栏(自动) | ↑顶部 · ←返回 · ⌂主页 |
| FAB(自动) | ↑浮动按钮 |
| 背景(自动) | 3光球 · 光晕 |

### D级：工具页 (esp32-*)
**特征：** 功能型交互页
| 区域 | 必须元素 |
|------|---------|
| 顶栏(自动) | 返回 · 标题 · 时钟 · 版本 · 主页 |
| 内容 | 连接状态 · 控制卡片 · 表单 · 日志区 · **返回链接** |
| 底栏(自动) | ↑顶部 · ←返回 · ⌂主页 |
| FAB(自动) | ↑浮动按钮 |
| 背景(自动) | 3光球 · 光晕 |

### E级：时钟页 (clock*) — 豁免
**特征：** 全屏沉浸式仪表盘，独立设计系统

---

## 十三、字体层级系统（完整版）

| 层级 | 标签 | 字号 | 字重 | 颜色 | 行高 | 用途 |
|------|------|------|------|------|------|------|
| H0 | .hero h1 | 26-30px | 700 | 渐变动画 | 1.2 | 页面主标题 |
| H1 | h1 | 22-26px | 700 | 渐变动画 | 1.3 | 内容标题 |
| H2 | h2 | 16-20px | 700 | var(--cyan) | 1.4 | 段落标题 |
| H3 | h3 | 15-16px | 600 | rgba(255,.85) | 1.5 | 子标题 |
| H4 | h4 | 14px | 600 | var(--tx) | 1.5 | 卡片标题 |
| P | p, li | 13-15px | 400 | var(--tx2) | 1.7-1.8 | 正文 |
| SM | .meta, .sub | 10-12px | 400 | var(--tx3) | 1.4 | 辅助/元数据 |
| XS | .tag, .badge | 9-11px | 600 | 半透明 | 1.3 | 标签/徽章 |
| CODE | code, pre | 11-13px | 400 | 等宽字体 | 1.5-1.6 | 代码 |

### 字体规则：
1. 标题必须用 system-ui 且 letter-spacing: -.01em ~ -.03em
2. 正文不得小于 13px（移动端）
3. 代码必须用等宽字体栈
4. 所有文字颜色必须从CSS变量选取，禁止硬编码

---

## 十四、间距系统（完整版）

### 基于4px的8点网格系统

| Token | 值 | CSS示例 | 用途 |
|-------|-----|---------|------|
| 2xs | 2px | gap:2px | 图标微调 |
| xs | 4px | gap:4px; padding:4px | 紧密元素 |
| sm | 8px | gap:8px; margin:8px | 标签间距 |
| md | 12px | gap:12px; margin-bottom:12px | 卡片间距(标准) |
| lg | 16px | padding:16px | 卡片内边距 |
| xl | 20px | padding:20px; margin:20px | 容器内边距 |
| 2xl | 24px | margin:24px 0 | 模块间距 |
| 3xl | 32px | margin:32px 0 | 大模块间距 |
| 4xl | 40px+ | padding-top:40px | Hero区域 |

### 必须遵守的间距规则：
1. 卡片之间间距统一 12px（用 md）
2. 段落之间间距 8px（用 sm）
3. 容器左右内边距 20px（桌面）/ 14px（移动端）
4. Header 与内容之间间距 12px
5. 不允许使用奇数间距值（除1px边框外）

---

## 十五、卡片类型系统

| 类型 | Class | 背景 | 边框 | 用途 |
|------|-------|------|------|------|
| 默认 | .card | rgba(255,.06) | rgba(255,.08) | 通用内容 |
| 可点击 | .card (cursor:pointer) | +hover: translateY(-2px) | +hover: 紫色发光 | 导航链接 |
| 成功 | .card-ok | +左绿边框3px | rgba(16,185,129,.4) | 完成/成功 |
| 警告 | .card-warn | +左琥珀边框3px | rgba(245,158,11,.4) | 警告/注意 |
| 危险 | .card-danger | +左红边框3px | rgba(239,68,68,.4) | 错误/危险 |

每种卡片必须包含：
- backdrop-filter: saturate(180%) blur(40px)
- ::after 光泽伪元素
- border-radius: 16px
- overflow: hidden

---

## 十六、数据加载三态规范

每个展示数据的区域必须处理三种状态：

### 16.1 加载中
```html
<div class="loading">⏳ 加载中...</div>
```
- 文字颜色: var(--tx3)
- 可选脉冲动画

### 16.2 加载失败
```html
<div class="error-state">⚠️ 加载失败，请检查网络</div>
```
- 提供重试按钮
- 显示具体错误原因

### 16.3 空数据
```html
<div class="empty-state">📭 暂无数据</div>
```
- 说明数据来源
- 提供操作引导

---

## 十七、页面自检清单（每次提交前必须逐项确认）

```
[ ] 1. 顶栏: 返回按钮 + 标题 + 时钟 + 版本号 + 主页按钮
[ ] 2. 底栏: ↑顶部 + ←返回 + ⌂主页
[ ] 3. FAB: 右下角↑浮动按钮
[ ] 4. 背景: 3个光球(紫/粉/青) + 光晕div
[ ] 5. 光晕JS: glowSpot rAF跟随鼠标
[ ] 6. h1: 渐变文字 + tFlow动画
[ ] 7. .card: 玻璃效果 + ::after光泽
[ ] 8. 字体: system-ui + antialiased
[ ] 9. 间距: 卡片间距12px, 容器padding20px
[ ] 10. 颜色: 全部CSS变量, 无硬编码
[ ] 11. 返回链接: 页面底部有"← 返回XXX"
[ ] 12. 移动端: @media(max-width:500px)
[ ] 13. 数据态: 加载中/失败/空数据三态
[ ] 14. 提交: git add + commit + push
[ ] 15. 测试: 冒烟测试100%通过
[ ] 16. 日志: 更新版本号+更新日志
```

---

> 最后更新: 2026-06-10 | 版本: v2.0 | 基于全站逐页审查

---

## 十八、开发流程（强制）

### 每次开发前必须：
1. **写计划** — 列出要修改的文件、要新增的功能、影响范围
2. **对照规范** — 逐项检查本文档 §十七 的16项清单
3. **评估影响** — 是否会破坏现有页面？是否需要数据库变更？
4. **用户确认** — 计划发用户审核，通过后再动手

### 每次开发后必须：
1. **自查** — §十七 16项逐项打勾
2. **冒烟测试** — `deno run --allow-net --allow-read tests/smoke-test.js` 必须100%
3. **git add + commit + push** — 缺一不可
4. **汇报结果** — PASS/FAIL数量、修改文件列表、新版本号

### 禁止：
- ❌ 没有计划直接写代码
- ❌ 改完不提
- ❌ 提了不推
- ❌ 跳过测试
- ❌ 修改后不汇报结果

> ⚠️ 违反以上规则 = 工作未完成，需重新执行


---

## 十九、计划前必问（强制）

### 每次大型改动前，必须先：
1. **列出决策点** — 哪些地方有多个方案可选？
2. **向用户提问** — 不能自己猜，必须让用户选择
3. **等确认** — 用户回答后再更新计划
4. **再执行** — 按确认后的计划执行

### 禁止：
- ❌ 遇到选择自己拍板
- ❌ 不问直接做
- ❌ 做完才说"我选了这个方案"

> ⚠️ 用户是最终决策者。AI负责列出选项和推荐，不负责替用户做决定。

