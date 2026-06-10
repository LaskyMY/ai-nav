// Page Content Indexer — extracts text from HTML files and stores in DB for search
import { initDB, upsertPageMeta, getPageMetas, closeDB } from "./db.js";

const BASE = "/Users/lasky_my/ai-nav";

// Strip HTML tags and extract readable text
function stripHtml(html) {
  let text = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

// Extract title from HTML
function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].trim() : '';
}

// Extract meta description
function extractDesc(html) {
  const m = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
  if (m) return m[1];
  // Try to get first meaningful paragraph
  const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i);
  if (!bodyMatch) return '';
  const text = stripHtml(bodyMatch[0]);
  return text.slice(0, 200);
}

// Deduce category from path and content
function deduceCategory(path, html) {
  if (path.includes('fitness') || path.includes('body-map')) return 'fitness';
  if (path.includes('vibe-coding') || path.includes('course')) return 'course';
  if (path.includes('puxing')) return 'self-improve';
  if (path.includes('psych') || path.includes('lying') || path.includes('interrogation') ||
      path.includes('complex') || path.includes('fallacies') || path.includes('paradox') ||
      path.includes('misconception') || path.includes('sleep') || path.includes('blood')) return 'psychology';
  if (path.includes('logic') || path.includes('game') || path.includes('music') ||
      path.includes('bertrand') || path.includes('causality') || path.includes('orbit') ||
      path.includes('emergence') || path.includes('probability') || path.includes('viscosity') ||
      path.includes('ai-concept') || path.includes('attention') || path.includes('gemstone') ||
      path.includes('llm') || path.includes('text-rendering')) return 'science';
  if (path.includes('esp32') || path.includes('soldering') || path.includes('multimeter') ||
      path.includes('tools-guide') || path.includes('hardware')) return 'hardware';
  if (path.includes('bilibili')) return 'hub';
  if (path.includes('clock') || path.includes('obd')) return 'tool';
  if (path.includes('index')) return 'core';
  if (path.includes('knowledge') || path.includes('sitemap') || path.includes('papers')) return 'hub';
  if (path.includes('financial')) return 'financial';
  return 'other';
}

// Known page titles (fallback if HTML title is generic)
const KNOWN_TITLES = {
  '/causality.html': '因果关系——为什么相关≠因果？',
  '/attention.html': '注意力机制到底在做什么？',
  '/logic-puzzle.html': '红蓝眼谜题——递归推理经典',
  '/game-theory.html': '游戏数学必胜策略',
  '/music-math.html': '音乐中的数学密码',
  '/gemstones.html': '宝石耐久度指南',
  '/bertrand-paradox.html': '伯特兰悖论——无穷多个概率？',
  '/ai-concepts.html': '从LLM到Agent Skill',
  '/psych-tricks.html': '10个实用人际心理技巧',
  '/lying-truth.html': '用真话说谎的13种方式',
  '/interrogation.html': '犯罪审讯技巧：REID vs PEACE',
  '/complexes.html': '12种常见心理情结',
  '/psych-effects.html': '心理效应大全（48个）',
  '/fallacies.html': '14种常见逻辑谬误',
  '/paradoxes.html': '10种常见悖论',
  '/misconceptions2.html': '12种常见误解',
  '/blood-types.html': '血型知识：ABO系统与Rh因子',
  '/sleep.html': '睡眠时长后果：从4小时到10小时',
  '/viscosity.html': '深入理解粘度——流体行为基础知识',
  '/probability.html': '大数定律与概率直觉——互动教学',
  '/orbit.html': '轨道模拟——重力弹弓与三体问题',
  '/emergence.html': '涌现复杂性——简单规则创造复杂系统',
  '/text-rendering.html': '文本渲染管线——从字体到屏幕',
  '/llm-anatomy.html': 'LLM关键词层级可视化',
  '/obd-dash.html': 'OBD赛车仪表盘',
};

// Main indexing function
async function indexAllPages() {
  await initDB();

  // Use existing page_meta entries as the source of truth for which pages exist
  const metas = await getPageMetas(false);
  let indexed = 0, errors = 0;

  for (const meta of metas) {
    let p = meta.path.startsWith('/') ? meta.path.slice(1) : meta.path;
    const filePath = BASE + '/' + p;
    try {
      const html = await Deno.readTextFile(filePath);
      const bodyText = stripHtml(html);
      const title = KNOWN_TITLES[meta.path] || extractTitle(html) || meta.title;
      const desc = meta.description || extractDesc(html);
      const category = meta.category !== 'other' ? meta.category : deduceCategory(meta.path, html);

      if (bodyText.length > 50) {
        await upsertPageMeta(meta.path, title, desc, bodyText, category);
        indexed++;
        console.log(`[index] ✅ ${meta.path} — ${bodyText.length} chars — ${category}`);
      } else {
        console.log(`[index] ⚠️  ${meta.path} — too short (${bodyText.length} chars)`);
      }
    } catch (e) {
      errors++;
      console.log(`[index] ❌ ${meta.path} — ${e.message}`);
    }
  }

  console.log(`\n[index] Done: ${indexed} indexed, ${errors} errors`);
  await closeDB();
}

if (import.meta.main) {
  await indexAllPages();
}
