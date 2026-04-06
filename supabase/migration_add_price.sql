-- articles テーブルに価格カラムを追加（セール判定用）
-- 実行: Supabase Dashboard > SQL Editor でこのSQLを実行してください

ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS price integer;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS list_price integer;

-- セール中の作品を効率的に検索するためのインデックス
CREATE INDEX IF NOT EXISTS idx_articles_on_sale
  ON public.articles (type, published_at DESC)
  WHERE price IS NOT NULL AND list_price IS NOT NULL AND price < list_price;
