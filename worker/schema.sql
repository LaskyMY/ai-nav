-- AI Nav PostgreSQL Schema v2
-- Run: psql ai_nav < worker/schema.sql

-- Extensions for full-text search and fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ═══════════════════════════════════════
-- Core tables
-- ═══════════════════════════════════════

-- News articles from RSS/APIs
CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  title_cn TEXT,
  summary TEXT,
  source TEXT DEFAULT 'NPR',
  keywords TEXT,
  level TEXT DEFAULT 'normal',
  metric TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT news_title_unique UNIQUE (title)
);
CREATE INDEX IF NOT EXISTS idx_news_fetched ON news(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_title_trgm ON news USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_news_title_cn_trgm ON news USING gin(title_cn gin_trgm_ops);

-- Weather cache
CREATE TABLE IF NOT EXISTS weather (
  id SERIAL PRIMARY KEY,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  location_name TEXT,
  data JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weather_location ON weather(lat, lon);
CREATE INDEX IF NOT EXISTS idx_weather_fetched ON weather(fetched_at DESC);

-- AI-generated summaries
CREATE TABLE IF NOT EXISTS ai_summaries (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT,
  model TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_summaries_type ON ai_summaries(type, created_at DESC);

-- API usage tracking
CREATE TABLE IF NOT EXISTS usage_log (
  id SERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  model TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_endpoint ON usage_log(endpoint);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_log(created_at DESC);

-- Page view tracking
CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  title TEXT,
  view_count INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pages_path ON pages(path);
CREATE INDEX IF NOT EXISTS idx_pages_views ON pages(view_count DESC);

-- Financial daily briefs (from Tencent Docs)
CREATE TABLE IF NOT EXISTS financial_briefs (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  content TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT financial_briefs_unique UNIQUE (date, type)
);
CREATE INDEX IF NOT EXISTS idx_financial_date ON financial_briefs(date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_type ON financial_briefs(type);

-- ═══════════════════════════════════════
-- Page metadata + body content (v2: full-text search)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS page_meta (
  id SERIAL PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  body_text TEXT,
  category TEXT DEFAULT 'other',
  nav_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  indexed_at TIMESTAMPTZ,
  -- Full-text search vector
  search_vector tsvector
);
CREATE INDEX IF NOT EXISTS idx_page_meta_path ON page_meta(path);
CREATE INDEX IF NOT EXISTS idx_page_meta_category ON page_meta(category);
CREATE INDEX IF NOT EXISTS idx_page_meta_active ON page_meta(is_active);
CREATE INDEX IF NOT EXISTS idx_page_meta_search ON page_meta USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_page_meta_body_trgm ON page_meta USING gin(body_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_page_meta_title_trgm ON page_meta USING gin(title gin_trgm_ops);

-- ═══════════════════════════════════════
-- Course system
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS course_lessons (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  desc_text TEXT,
  stage INTEGER DEFAULT 1,
  num INTEGER DEFAULT 1,
  emoji TEXT DEFAULT '📖',
  is_active BOOLEAN DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_course_slug ON course_lessons(slug);

-- ═══════════════════════════════════════
-- Site configuration & navigation
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS site_config (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT
);

CREATE TABLE IF NOT EXISTS nav_items (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  path TEXT NOT NULL,
  icon TEXT,
  category TEXT DEFAULT 'main',
  sort_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_nav_visible ON nav_items(is_visible, sort_order);

CREATE TABLE IF NOT EXISTS changelog (
  id SERIAL PRIMARY KEY,
  entry_date DATE NOT NULL,
  version TEXT,
  title TEXT,
  description TEXT,
  category TEXT DEFAULT 'update'
);
CREATE INDEX IF NOT EXISTS idx_changelog_date ON changelog(entry_date DESC);

CREATE TABLE IF NOT EXISTS manual_content (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  description TEXT,
  content TEXT
);
CREATE INDEX IF NOT EXISTS idx_manual_slug ON manual_content(slug);

-- ═══════════════════════════════════════
-- Trigger: auto-update search_vector on page_meta
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION page_meta_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.body_text, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_page_meta_search ON page_meta;
CREATE TRIGGER trg_page_meta_search
  BEFORE INSERT OR UPDATE ON page_meta
  FOR EACH ROW EXECUTE FUNCTION page_meta_search_update();

-- ═══════════════════════════════════════
-- Helper: full-text search across all content
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION search_all(query_text TEXT, max_results INT DEFAULT 30)
RETURNS TABLE(
  type TEXT,
  title TEXT,
  description TEXT,
  path TEXT,
  category TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  -- 1. Page meta (title + description + body text) via tsvector
  SELECT 'page'::TEXT AS type,
         pm.title,
         COALESCE(pm.description, left(pm.body_text, 200)) AS description,
         pm.path,
         pm.category,
         ts_rank(pm.search_vector, plainto_tsquery('simple', query_text)) AS rank
  FROM page_meta pm
  WHERE pm.is_active = true
    AND pm.search_vector @@ plainto_tsquery('simple', query_text)

  UNION ALL

  -- 2. Course lessons
  SELECT 'course'::TEXT,
         cl.title,
         cl.desc_text AS description,
         ('./vibe-coding-lessons/' || cl.slug || '.html')::TEXT AS path,
         ('阶段' || cl.stage)::TEXT AS category,
         0.5::REAL AS rank
  FROM course_lessons cl
  WHERE cl.title ILIKE '%' || query_text || '%'
     OR cl.desc_text ILIKE '%' || query_text || '%'

  UNION ALL

  -- 3. Financial briefs
  SELECT 'financial'::TEXT,
         fb.title,
         left(fb.content, 200) AS description,
         './financial-news.html'::TEXT AS path,
         fb.type AS category,
         0.3::REAL AS rank
  FROM financial_briefs fb
  WHERE fb.content ILIKE '%' || query_text || '%'

  UNION ALL

  -- 4. News
  SELECT 'news'::TEXT,
         COALESCE(n.title_cn, n.title) AS title,
         n.summary AS description,
         ''::TEXT AS path,
         n.source AS category,
         0.2::REAL AS rank
  FROM news n
  WHERE n.title ILIKE '%' || query_text || '%'
     OR n.title_cn ILIKE '%' || query_text || '%'
     OR n.summary ILIKE '%' || query_text || '%'

  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
