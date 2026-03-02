import { Article } from "@/lib/schema";

function cleanSummary(value: string) {
  return value.replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
}

function extractDuration(text: string) {
  const match = text.match(/再生時間[:：]\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/);
  return match?.[1] ?? "";
}

function extractTags(text: string) {
  const match = text.match(/タグ[:：]\s*([^\n]+)/);
  if (!match) return [];
  return match[1]
    .split("/")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function hasJapanese(text: string) {
  return /[ぁ-んァ-ヶ一-龠]/.test(text);
}

function isThinTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return true;
  if (trimmed.length <= 3) return true;
  if (/^(AV|JAV)$/i.test(trimmed)) return true;
  if (/^-?short-/i.test(trimmed)) return true;
  if (/^[A-Z]{2,}\d{2,}/.test(trimmed)) return true;
  if (!hasJapanese(trimmed) && trimmed.length <= 14) return true;
  return false;
}

function isNoiseTag(tag: string) {
  const trimmed = tag.trim();
  if (!trimmed) return true;
  if (/^(AV|JAV)$/i.test(trimmed)) return true;
  if (/^[A-Z0-9_-]{2,}$/.test(trimmed) && !/[ぁ-んァ-ヶ一-龠]/.test(trimmed)) {
    return true;
  }
  if (trimmed.length === 1) return true;
  return false;
}

export function stripTagPrefix(tag: string) {
  return tag.replace(/^(genre|maker):/i, "").trim();
}

function shorten(text: string, max = 70) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

const ROLE_KEYWORDS = [
  "お姉さん",
  "お姉ちゃん",
  "巨乳",
  "美乳",
  "美尻",
  "美脚",
  "スレンダー",
  "グラマー",
  "人妻",
  "熟女",
  "ギャル",
  "清楚",
  "清純",
  "JK",
  "女子校生",
  "学生",
  "大学生",
  "OL",
  "ナース",
  "メイド",
  "アイドル",
  "教師",
  "先生",
  "受付嬢",
  "秘書",
  "店員",
  "モデル",
  "女医",
  "女子大生",
  "女子アナ",
  "スポーツ系",
  "素人",
];

const SITUATION_KEYWORDS = [
  "ナンパ",
  "初撮り",
  "ハメ撮り",
  "逆レイプ",
  "寝取られ",
  "痴漢",
  "不倫",
  "浮気",
  "合コン",
  "パーティ",
  "風呂",
  "お風呂",
  "温泉",
  "野外",
  "車内",
  "ホテル",
  "マッサージ",
  "整体",
  "面接",
  "家庭教師",
  "個人撮影",
  "パイパン",
  "着エロ",
  "拘束",
  "監禁",
];

const ACTION_KEYWORDS = [
  "フェラ",
  "クンニ",
  "騎乗位",
  "立ちバック",
  "バック",
  "手コキ",
  "指マン",
  "指責め",
  "乳首",
  "パイズリ",
  "顔射",
  "潮吹き",
  "中出し",
  "口内",
  "ごっくん",
  "アナル",
  "電マ",
  "手マン",
  "素股",
  "玩具",
  "おもちゃ",
  "ローター",
  "バイブ",
  "イラマチオ",
  "口内射精",
  "連続",
  "3P",
  "4P",
  "乱交",
  "二穴",
  "キス",
  "接吻",
  "パイ揉み",
  "乳揉み",
  "顔舐め",
  "足舐め",
  "コスプレ",
];

function pickTag(tags: string[], keywords: string[]) {
  return tags.find((tag) => keywords.some((key) => tag.includes(key))) ?? "";
}

function buildActionPhrase(tag: string) {
  if (!tag) return "";
  const map: Record<string, string> = {
    フェラ: "濃厚フェラで悶絶",
    クンニ: "クンニで敏感に乱れる",
    騎乗位: "騎乗位で腰振り",
    立ちバック: "立ちバックで激しく貫かれ",
    バック: "バックで激しく貫かれ",
    手コキ: "手コキで責めまくり",
    指マン: "指マンでとろける",
    乳首: "乳首責めで感じまくり",
    パイズリ: "パイズリで奉仕",
    顔射: "顔射でフィニッシュ",
    潮吹き: "連続潮吹きで絶頂",
    中出し: "中出しでイキまくり",
    口内: "口内で濃厚ごっくん",
    ごっくん: "ごっくんで満たされる",
    アナル: "アナルで悶絶",
    電マ: "電マでビクビク",
  };
  return map[tag] || `${tag}で悶絶`;
}

function hashSeed(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function shuffleWithSeed<T>(items: T[], seed: string) {
  const arr = [...items];
  let state = hashSeed(seed) || 1;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickVariant<T>(items: T[], seed: string) {
  if (items.length === 0) return items[0] as T;
  const idx = hashSeed(seed) % items.length;
  return items[idx];
}

function buildTitleFromTags(tags: string[], actress: string, seed: string) {
  const shuffledTags = shuffleWithSeed(tags, seed);
  const role = pickTag(shuffledTags, ROLE_KEYWORDS);
  const situation = pickTag(shuffledTags, SITUATION_KEYWORDS);
  const shuffledActions = shuffleWithSeed(
    shuffledTags.filter((tag) => ACTION_KEYWORDS.some((key) => tag.includes(key))),
    `${seed}-actions`
  );
  const action1 = shuffledActions[0] ?? pickTag(shuffledTags, ACTION_KEYWORDS);
  const action2 = shuffledActions.find((tag) => tag && tag !== action1) ?? "";

  const headline = role || actress || situation || action1 || tags[0] || "";
  const actionPhrase1 = buildActionPhrase(action1);
  const actionPhrase2 = buildActionPhrase(action2 || "");

  const subject = actress ? `${actress}` : role ? `${role}` : "";
  const prefix = headline ? `【${headline}】` : "";

  const templates = [
    `${prefix}${subject ? `${subject}が` : ""}${situation ? `${situation}で` : ""}${actionPhrase1 ? `${actionPhrase1}！` : ""}${actionPhrase2 ? `さらに${actionPhrase2}！` : ""}`,
    `${prefix}${subject ? `${subject}の` : ""}${situation ? `${situation}で` : ""}${actionPhrase1 ? `${actionPhrase1}！` : ""}${actionPhrase2 ? `続けて${actionPhrase2}！` : ""}`,
    `${prefix}${subject ? `${subject}が` : ""}${actionPhrase1 ? `${actionPhrase1}！` : ""}${situation ? `${situation}で` : ""}${actionPhrase2 ? `止まらず${actionPhrase2}！` : ""}`,
    `${prefix}${subject ? `${subject}が` : ""}${situation ? `${situation}で` : ""}${actionPhrase1 ? `${actionPhrase1}！` : ""}${actionPhrase2 ? `たまらず${actionPhrase2}！` : ""}`,
    `${prefix}${subject ? `${subject}が` : ""}${actionPhrase1 ? `${actionPhrase1}！` : ""}${actionPhrase2 ? `おかわり${actionPhrase2}！` : ""}`,
    `${prefix}${subject ? `${subject}の` : ""}${actionPhrase1 ? `${actionPhrase1}！` : ""}${situation ? `${situation}で` : ""}${actionPhrase2 ? `一気に${actionPhrase2}！` : ""}`,
    `${prefix}${subject ? `${subject}が` : ""}${situation ? `${situation}で` : ""}${actionPhrase1 ? `${actionPhrase1}！` : ""}${actionPhrase2 ? `追い打ち${actionPhrase2}！` : ""}`,
    `${prefix}${subject ? `${subject}が` : ""}${actionPhrase1 ? `${actionPhrase1}！` : ""}${situation ? `${situation}で` : ""}${actionPhrase2 ? `最後に${actionPhrase2}！` : ""}`,
    `${prefix}${subject ? `${subject}の` : ""}${actionPhrase1 ? `${actionPhrase1}！` : ""}${actionPhrase2 ? `止まらず${actionPhrase2}！` : ""}`,
  ];

  const fallback = `${prefix}${subject ? `${subject}が` : ""}淫らに乱れる！`;
  const composed = pickVariant(templates, seed).replace(/\s+/g, " ").trim();
  return composed || fallback;
}

export function getTokyoMotionTags(
  item: Pick<Article, "summary" | "meta_genres">
) {
  const summary = cleanSummary(item.summary || "");
  const tags =
    (item.meta_genres && item.meta_genres.filter(Boolean))?.length
      ? (item.meta_genres || [])
      : extractTags(summary);
  return Array.from(
    new Set(
      tags.map((tag) => stripTagPrefix(tag).trim()).filter(Boolean)
    )
  );
}

export function buildTokyoMotionTitle(
  item: Pick<Article, "title" | "summary" | "meta_genres" | "related_actresses" | "slug">
) {
  const title = cleanSummary(item.title);
  const actress = item.related_actresses?.[0] ?? "";
  const tags = getTokyoMotionTags(item).filter((tag) => !isNoiseTag(tag));
  const hasCuratedInfo = tags.length > 0 || Boolean(actress);
  const seed = item.slug || title || actress || tags.join("-");
  const composed = buildTitleFromTags(tags, actress, seed);
  if (hasCuratedInfo && composed) return composed;
  if (title.startsWith("【") && title.includes("】")) {
    return actress && !title.includes(actress) ? `【${actress}】${title}` : title;
  }
  if (!isThinTitle(title) && (hasJapanese(title) || title.length >= 18)) {
    return actress && !title.includes(actress) ? `【${actress}】${title}` : title;
  }
  if (composed) return composed;
  if (actress && !title.includes(actress)) return `【${actress}】${title}`;
  return title;
}

export function buildTokyoMotionDescription(
  item: Pick<Article, "title" | "summary" | "meta_genres">
) {
  const summary = cleanSummary(item.summary || "");
  const duration = extractDuration(summary);
  const safeTags = getTokyoMotionTags(item).slice(0, 3);
  const parts: string[] = [];

  if (safeTags.length > 0) {
    parts.push(`タグ: ${safeTags.join(" / ")}`);
  }
  if (duration) {
    parts.push(`再生時間: ${duration}`);
  }

  if (parts.length === 0) {
    return shorten(summary, 60);
  }
  return parts.join(" | ");
}
