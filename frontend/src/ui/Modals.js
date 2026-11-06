import { CONFIG, asset } from '../config.js';
import { audio } from '../systems/AudioManager.js';
import { Leaderboard } from '../systems/LeaderboardService.js';

let current = null;

function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v);
    }
    kids.flat().forEach((c) => { if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return el;
}

export function closeModal() {
    if (!current) return;
    document.removeEventListener('keydown', current.onKey, true);
    current.overlay.remove();
    const cb = current.onClose;
    current = null;
    if (cb) cb();
}

export function isModalOpen() { return !!current; }

function openModal(build, { onClose } = {}) {
    closeModal();
    audio.unlock();
    audio.sfx('click');
    const root = document.getElementById('ui-root');
    const modal = h('div', { class: 'cr-modal' });
    const overlay = h('div', { class: 'cr-overlay', onmousedown: (e) => { if (e.target === overlay) closeModal(); } }, modal);
    const closeBtn = h('button', { class: 'cr-close', 'aria-label': 'Close', text: '✕', onclick: closeModal });
    modal.append(closeBtn);
    build(modal, overlay);
    const onKey = (e) => {
        if (e.key === 'Escape') {
            const lb = overlay.querySelector('.cr-lightbox');
            if (lb) lb.remove(); else closeModal();
            e.stopPropagation();
        }
    };
    document.addEventListener('keydown', onKey, true);
    current = { overlay, onKey, onClose };
    root.append(overlay);
}

// ---------------- CREDITS ----------------
function loadCreatorPhoto(img) {
    // cek semua nama file sekaligus, pakai yang pertama ada (urutan = prioritas)
    const probes = CONFIG.CREATOR.photos.map((path) => new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => resolve(path);
        probe.onerror = () => resolve(null);
        probe.src = asset(path);
    }));
    Promise.all(probes).then((results) => {
        const found = results.find(Boolean);
        if (found) img.src = asset(found);
        else { img.src = asset(CONFIG.CREATOR.placeholder); img.dataset.placeholder = '1'; }
    });
}

export function openCredits() {
    const C = CONFIG.CREATOR;
    openModal((modal, overlay) => {
        const photo = h('img', { class: 'cr-credit-photo', alt: C.name, draggable: 'false' });
        loadCreatorPhoto(photo);
        photo.addEventListener('click', () => {
            const big = h('img', { src: photo.src, alt: C.name });
            const box = h('div', { class: 'cr-lightbox', onclick: () => box.remove() }, big);
            overlay.append(box);
        });

        modal.append(
            h('h2', { text: 'CREDITS' }),
            h('p', { class: 'cr-sub', text: 'The folks behind the gold rush' }),
            h('div', { class: 'cr-credit-photo-wrap' }, photo),
            h('p', { class: 'cr-credit-name', text: C.name }),
            h('p', { class: 'cr-credit-role', text: C.role }),
            h('p', { class: 'cr-credit-msg', text: C.message })
        );

        if (C.links && C.links.length) {
            modal.append(h('div', { class: 'cr-credit-links' },
                C.links.map((l) => h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer', text: l.label }))));
        }

        modal.append(
            h('div', { class: 'cr-credit-section' },
                h('h3', { text: ' MUSIK SIAPA TAU EMANG DEMEN YAKAN' }),
                h('div', { text: 'Lobby: "Lost Saga BGM - Wild West" (all rights belong to the original owners).' }),
                h('div', { text: 'Gameplay: original in-game synthesized western theme.' })),
            h('div', { class: 'cr-credit-section' },
                h('h3', { text: 'DIBUAT DENGAN' }),
                h('div', { text: 'Tenaga, Pikiran, Akal Sehat, dan Pemecutan AI yang tiada HENTI YHAHAHA HAYUKKK' })),
            h('div', { class: 'cr-center' }, h('button', { class: 'cr-btn', text: 'BACK', onclick: closeModal }))
        );
    });
}

// ---------------- LEADERBOARD ----------------
export function openLeaderboard(highlight) {
    openModal((modal) => {
        const badge = h('div', { class: 'cr-lb-badge', text: 'Loading bounties…' });
        const body = h('div', { class: 'cr-lb-empty', text: 'Riding to town…' });
        modal.append(
            h('h2', { text: 'LEADERBOARD' }),
            h('p', { class: 'cr-sub', text: 'Most wanted gold hunters' }),
            h('div', { style: 'text-align:center' }, badge),
            body,
            h('div', { class: 'cr-center' }, h('button', { class: 'cr-btn', text: 'BACK', onclick: closeModal }))
        );

        Leaderboard.top(10).then(({ entries, source }) => {
            if (!current) return;
            badge.className = 'cr-lb-badge ' + source;
            badge.textContent = source === 'online' ? '● ONLINE RANKING' : '● OFFLINE — saved on this device';
            if (!entries.length) { body.textContent = 'No outlaws yet. Be the first!'; return; }

            const table = h('table', { class: 'cr-lb-table' },
                h('thead', {}, h('tr', {},
                    h('th', { text: '#' }), h('th', { text: 'COWBOY' }),
                    h('th', { class: 'num', text: 'WAVE' }), h('th', { class: 'num', text: 'SCORE' }))),
                h('tbody', {}, entries.map((e, i) => {
                    const me = highlight && e.name === highlight.name && e.score === highlight.score;
                    return h('tr', { class: [i < 3 ? 'top' + (i + 1) : '', me ? 'me' : ''].join(' ') },
                        h('td', { text: String(i + 1) }), h('td', { text: e.name }),
                        h('td', { class: 'num', text: String(e.wave) }), h('td', { class: 'num', text: String(e.score) }));
                })));
            body.replaceWith(table);
        });
    });
}

// ---------------- SETTINGS ----------------
export function openSettings() {
    openModal((modal) => {
        const slider = (label, value, onInput) => {
            const val = h('span', { class: 'val', text: Math.round(value * 100) + '%' });
            const input = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(value * 100)) });
            input.addEventListener('input', () => { val.textContent = input.value + '%'; onInput(input.value / 100); });
            input.addEventListener('change', () => audio.sfx('coin'));
            return h('div', { class: 'cr-row' }, h('span', { text: label }), input, val);
        };

        const muteBtn = h('button', { class: 'cr-toggle' });
        const refresh = () => { muteBtn.textContent = audio.settings.muted ? 'OFF' : 'ON'; muteBtn.classList.toggle('off', audio.settings.muted); };
        muteBtn.addEventListener('click', () => { audio.toggleMute(); refresh(); audio.sfx('click'); });
        refresh();

        modal.append(
            h('h2', { text: 'SETTINGS' }),
            h('p', { class: 'cr-sub', text: 'Tune your saloon' }),
            h('div', { class: 'cr-row' }, h('span', { text: 'Sound' }), muteBtn),
            slider('Music', audio.settings.music, (v) => audio.setMusicVolume(v)),
            slider('Effects', audio.settings.sfx, (v) => audio.setSfxVolume(v)),
            h('div', { class: 'cr-controls' },
                h('div', {}, h('kbd', { text: 'WASD' }), ' / ', h('kbd', { text: 'ARROWS' }), '  move'),
                h('div', {}, h('kbd', { text: 'SPACE' }), '  jump over tumbleweeds & bullets'),
                h('div', {}, h('kbd', { text: 'ESC' }), ' / ', h('kbd', { text: 'P' }), '  pause   ', h('kbd', { text: 'M' }), '  mute')),
            h('div', { class: 'cr-center' }, h('button', { class: 'cr-btn', text: 'DONE', onclick: closeModal }))
        );
    });
}
