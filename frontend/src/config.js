// ===== COIN RUSH: WILD WEST - PENGATURAN GAMBAR / CREDITS / ONLINE =====
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const BASE = env.BASE_URL || '/';
export const asset = (path) => BASE + path;

export const CONFIG = {
    // Leaderboard online. Kalau backend belum jalan, otomatis simpan lokal di browser.
    API_URL: env.VITE_API_URL || '/api',

    // Musik lobby: urutan prioritas
    // 1) file lokal public/audio/lobby.mp3 (kalau ada)  2) YouTube di bawah  3) musik buatan game
    LOBBY_LOCAL_FILE: 'audio/lobby.mp3',
    LOBBY_YT_ID: 'loGBdncnR1M', // Lost Saga BGM - Wild West

    // ===== CREDITS =====  (EDIT BAGIAN INI)
    CREATOR: {
        name: 'Kelompok RDR',
        role: 'Mata Kuliah Pemrograman Objek',
        message: 'Radiel Sabriansyah [2550231025] Devlin Permana [2550231010] Rafki Ahmad Fauzan [2550231033]',
        // Taruh foto di frontend/public/images/ dengan salah satu nama ini:
        photos: [
            'images/creator.jpg',
            'images/creator.jpeg',
            'images/creator.png',
            'images/creator.webp'
        ],
        placeholder: 'images/creator-placeholder.svg',
        links: [
            // { label: 'Instagram', url: 'https://instagram.com/username' }
        ]
    },

    MAX_NAME: 16,
    MIN_NAME: 3
};
