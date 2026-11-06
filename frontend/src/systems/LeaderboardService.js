import { CONFIG } from '../config.js';

const KEY = 'coinrush.leaderboard.v1';
const TIMEOUT = 3500;

function readLocal() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function writeLocal(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50))); } catch { /* ignore */ }
}

function sortEntries(list) {
    return [...list].sort((a, b) => b.score - a.score || b.wave - a.wave);
}

async function http(path, options = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
        const res = await fetch(CONFIG.API_URL + path, {
            ...options,
            signal: ctrl.signal,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Leaderboard: online (Flask API) dengan cadangan lokal di browser.
 * Dipakai game over + menu, jadi tinggal nyalakan backend untuk go-online.
 */
export const Leaderboard = {
    async submit(entry) {
        const clean = {
            name: String(entry.name || 'COWBOY').slice(0, CONFIG.MAX_NAME),
            score: Math.max(0, Math.floor(entry.score || 0)),
            wave: Math.max(1, Math.floor(entry.wave || 1)),
            coins: Math.max(0, Math.floor(entry.coins || 0)),
            character: String(entry.character || ''),
            created_at: new Date().toISOString()
        };

        // selalu simpan lokal
        const local = sortEntries([...readLocal(), clean]);
        writeLocal(local);
        let rank = local.findIndex((e) => e === clean || (e.created_at === clean.created_at && e.score === clean.score)) + 1;
        let source = 'local';

        try {
            const res = await http('/leaderboard', { method: 'POST', body: JSON.stringify(clean) });
            if (res && res.rank) { rank = res.rank; source = 'online'; }
        } catch { /* backend belum aktif: pakai lokal */ }

        return { rank, source, entry: clean };
    },

    async top(limit = 10) {
        try {
            const res = await http('/leaderboard?limit=' + limit);
            if (res && Array.isArray(res.entries)) return { entries: res.entries.slice(0, limit), source: 'online' };
        } catch { /* fallback */ }
        return { entries: sortEntries(readLocal()).slice(0, limit), source: 'local' };
    }
};
