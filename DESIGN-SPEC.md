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
