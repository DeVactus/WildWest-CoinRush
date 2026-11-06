// Cloudflare Pages Function: /api/leaderboard  (GET = top skor, POST = kirim skor)
// Database: Cloudflare D1, binding bernama "DB" (diatur di dashboard Pages).

const MAX_SCORE = 5_000_000;   // batas kewajaran
const MIN_GAP_SEC = 3;         // jeda minimal antar submit per IP

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

export async function onRequestGet({ env, request }) {
  if (!env.DB) return json({ error: 'DB binding missing' }, 500);
  const url = new URL(request.url);
  let limit = parseInt(url.searchParams.get('limit') || '10', 10);
  if (!Number.isFinite(limit)) limit = 10;
  limit = Math.max(1, Math.min(100, limit));

  const { results } = await env.DB.prepare(
    'SELECT name, score, wave, coins, character, created_at FROM scores ORDER BY score DESC, wave DESC, id ASC LIMIT ?'
  ).bind(limit).all();
  return json({ entries: results || [] });
}

export async function onRequestPost({ env, request }) {
  if (!env.DB) return json({ error: 'DB binding missing' }, 500);

  let data;
  try { data = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }

  const name = String(data.name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  const character = String(data.character ?? '').slice(0, 24);
  const score = Math.floor(Number(data.score));
  const wave = Math.floor(Number(data.wave));
  const coins = Math.floor(Number(data.coins ?? 0));

  if (name.length < 3) return json({ error: 'name too short' }, 400);
  if (![score, wave, coins].every(Number.isFinite)) return json({ error: 'invalid numbers' }, 400);
  if (score < 0 || score > MAX_SCORE || wave < 1 || wave > 500 || coins < 0) return json({ error: 'invalid score' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const recent = await env.DB.prepare(
    "SELECT 1 AS x FROM scores WHERE ip = ? AND created_at > datetime('now', ?) LIMIT 1"
  ).bind(ip, `-${MIN_GAP_SEC} seconds`).first();
  if (recent) return json({ error: 'too fast' }, 429);

  await env.DB.prepare(
    'INSERT INTO scores (name, score, wave, coins, character, ip) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(name, score, wave, coins, character, ip).run();

  const row = await env.DB.prepare('SELECT COUNT(*) + 1 AS rank FROM scores WHERE score > ?').bind(score).first();
  return json({ ok: true, rank: row ? row.rank : 1 });
}
