import Phaser from 'phaser';
import { audio } from '../systems/AudioManager.js';

export const FONT_TITLE = "Rye, Georgia, serif";
export const FONT_BODY = "'Special Elite', Georgia, serif";

export const COL = {
    wood: 0x542719, woodDark: 0x3a1f12, woodLight: 0xA85E35,
    cream: 0xFFF1C2, gold: 0xFFD76A, red: 0xA83C32, green: 0x326B42
};

export function lerpColor(a, b, t) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

/** Gradient vertikal dari strip-strip kotak */
export function gradientRect(scene, x, y, w, h, top, bottom, steps = 28) {
    const g = scene.add.graphics();
    const sh = h / steps;
    for (let i = 0; i < steps; i++) {
        g.fillStyle(lerpColor(top, bottom, i / (steps - 1)), 1);
        g.fillRect(x, y + i * sh, w, sh + 1);
    }
    return g;
}

export function text(scene, x, y, str, size, color = '#FFF1C2', opts = {}) {
    return scene.add.text(x, y, str, {
        fontFamily: opts.body ? FONT_BODY : FONT_TITLE,
        fontSize: `${size}px`,
        color,
        stroke: opts.stroke,
        strokeThickness: opts.strokeThickness || 0,
        align: opts.align || 'center',
        ...(opts.style || {})
    }).setOrigin(opts.ox ?? 0.5, opts.oy ?? 0.5);
}

export const DESIGN_W = 1000;
export const DESIGN_H = 600;

/** Zoom agar area desain 1000x600 selalu muat (contain) di layar manapun */
export function viewInfo(scene) {
    const w = scene.scale.width, h = scene.scale.height;
    const z = Math.min(w / DESIGN_W, h / DESIGN_H);
    return { w, h, z, vw: w / z, vh: h / z };
}

/** Kamera: area 1000x600 di tengah layar, sisanya latar yang diperluas. Panggil di awal create() */
export function fitCamera(scene) {
    const apply = () => {
        const cam = scene.cameras.main;
        const { w, h, z } = viewInfo(scene);
        cam.setSize(w, h);
        cam.setZoom(z);
        cam.centerOn(DESIGN_W / 2, DESIGN_H / 2);
    };
    apply();
    scene.scale.on('resize', apply);
    scene.events.once('shutdown', () => scene.scale.off('resize', apply));
}

/** Koordinat desain -> piksel layar (untuk elemen HTML yang menimpa canvas) */
export function designToScreen(scene, x, y) {
    const r = scene.game.canvas.getBoundingClientRect();
    const { w, h, z } = viewInfo(scene);
    const kx = r.width / w, ky = r.height / h;
    return {
        x: r.left + ((x - DESIGN_W / 2) * z + w / 2) * kx,
        y: r.top + ((y - DESIGN_H / 2) * z + h / 2) * ky,
        k: z * kx
    };
}

/** Vignette gelap di pinggir layar */
export function addVignette(scene, depth = 800, alpha = 0.55) {
    const key = 'vignette';
    if (!scene.textures.exists(key)) {
        const tex = scene.textures.createCanvas(key, 1000, 600);
        const ctx = tex.getContext();
        const g = ctx.createRadialGradient(500, 300, 230, 500, 300, 660);
        g.addColorStop(0, 'rgba(20,8,2,0)');
        g.addColorStop(1, 'rgba(20,8,2,1)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1000, 600);
        tex.refresh();
    }
    const img = scene.add.image(500, 300, key).setDepth(depth).setAlpha(alpha);
    const fit = () => { const v = viewInfo(scene); img.setDisplaySize(v.vw + 4, v.vh + 4); };
    fit();
    scene.scale.on('resize', fit);
    scene.events.once('shutdown', () => scene.scale.off('resize', fit));
    return img;
}

/** Papan kayu: dipakai tombol, HUD, banner */
export function plank(scene, g, x, y, w, h, opts = {}) {
    const base = opts.color ?? COL.wood;
    g.fillStyle(0x000000, 0.28).fillRoundedRect(x + 3, y + 5, w, h, 8);
    g.fillStyle(base, 1).fillRoundedRect(x, y, w, h, 8);
    g.fillStyle(lerpColor(base, 0xFFFFFF, 0.14), 1).fillRoundedRect(x + 3, y + 3, w - 6, Math.min(h * 0.42, 24), { tl: 6, tr: 6, bl: 0, br: 0 });
    g.lineStyle(1, lerpColor(base, 0x000000, 0.35), 0.7);
    for (let i = 1; i < 4; i++) g.lineBetween(x + 10, y + (h * i) / 4, x + w - 10, y + (h * i) / 4 + (i % 2 ? 1 : -1));
    g.lineStyle(3, COL.woodDark, 1).strokeRoundedRect(x, y, w, h, 8);
    g.fillStyle(0xE5B06D, 1);
    [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]].forEach(([nx, ny]) => g.fillCircle(nx, ny, 2.2));
}

export function woodButton(scene, x, y, w, h, label, callback, opts = {}) {
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    const draw = (color) => { g.clear(); plank(scene, g, -w / 2, -h / 2, w, h, { color }); };
    draw(opts.color ?? COL.wood);
    const t = text(scene, 0, -1, label, opts.size || 20, '#FFF1C2', { stroke: '#3a1f12', strokeThickness: 3 });
    const hit = scene.add.rectangle(0, 0, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    c.add([g, t, hit]);

    // noTween: dipakai di menu pause (tween game sedang dibekukan)
    const grow = (k) => (opts.noTween ? c.setScale(k) : scene.tweens.add({ targets: c, scale: k, duration: 110 }));
    hit.on('pointerover', () => { draw(COL.woodLight); grow(1.06); });
    hit.on('pointerout', () => { draw(opts.color ?? COL.wood); grow(1); });
    hit.on('pointerdown', () => {
        audio.unlock();
        audio.sfx('click');
        if (!opts.noTween) scene.tweens.add({ targets: c, scale: 0.95, duration: 70, yoyo: true });
        callback();
    });
    c.setSize(w, h);
    c.label = t;
    return c;
}

export function fadeIn(scene) {
    scene.cameras.main.fadeIn(260, 20, 10, 5);
}

export function fadeTo(scene, key, data) {
    if (scene._leaving) return;
    scene._leaving = true;
    scene.cameras.main.fadeOut(240, 20, 10, 5);
    scene.cameras.main.once('camerafadeoutcomplete', () => {
        scene._leaving = false;
        scene.scene.start(key, data);
    });
}

/** Tombol speaker pojok kanan atas */
export function soundButton(scene, x = 960, y = 38) {
    const c = scene.add.container(x, y).setDepth(900);
    const bg = scene.add.circle(0, 0, 21, COL.wood).setStrokeStyle(3, COL.woodDark);
    const note = scene.add.text(0, -1, '♪', { fontFamily: 'Arial', fontSize: '26px', color: '#FFF1C2', fontStyle: 'bold' }).setOrigin(0.5);
    const slash = scene.add.rectangle(0, 0, 34, 4, 0xff5b6b).setAngle(-45);
    c.add([bg, note, slash]);
    const refresh = () => { slash.setVisible(audio.settings.muted); note.setAlpha(audio.settings.muted ? 0.5 : 1); };
    refresh();
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => { audio.unlock(); audio.toggleMute(); audio.sfx('click'); refresh(); });
    return c;
}

/**
 * Latar gurun lengkap: langit gradient, matahari, mesa, kota, tanah, kaktus, awan, debu.
 * Dipakai MainMenu, CharacterSelect, PlayerSetup.
 */
export function desertBackdrop(scene, opts = {}) {
    scene.add.rectangle(500, -1500, 6000, 3000, 0xF6CE86).setDepth(-101);
    gradientRect(scene, -2000, 0, 5000, 470, 0xF6CE86, 0xDF8F4F, 32).setDepth(-100);

    // matahari + sinar berputar
    const sun = scene.add.container(opts.sunX ?? 780, opts.sunY ?? 150).setDepth(-95);
    const rays = scene.add.graphics();
    rays.fillStyle(0xFFE8A0, 0.16);
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        rays.fillTriangle(0, 0, Math.cos(a) * 520, Math.sin(a) * 520, Math.cos(a + 0.12) * 520, Math.sin(a + 0.12) * 520);
    }
    sun.add([rays, scene.add.circle(0, 0, 108, 0xFFE8A0, 0.18), scene.add.circle(0, 0, 80, 0xFBD87C), scene.add.circle(0, 0, 62, 0xFFEBB0)]);
    scene.tweens.add({ targets: rays, angle: 360, duration: 120000, repeat: -1 });

    // gunung / mesa berlapis
    const m = scene.add.graphics().setDepth(-90);
    m.fillStyle(0xCF8A5A, 1);
    m.fillTriangle(-60, 400, 150, 250, 380, 400);
    m.fillTriangle(560, 400, 820, 235, 1080, 400);
    m.fillStyle(0xB86B49, 1);
    m.fillRect(200, 300, 190, 120); m.fillRect(215, 280, 160, 22);
    m.fillRect(640, 320, 150, 100); m.fillRect(652, 300, 126, 22);
    m.fillTriangle(-760, 400, -500, 255, -200, 400);
    m.fillTriangle(1130, 400, 1400, 240, 1720, 400);
    m.fillStyle(0xA85E43, 1);
    m.fillTriangle(330, 410, 520, 280, 720, 410);
    m.fillStyle(0xFFFFFF, 0.06);
    m.fillRect(200, 300, 24, 120); m.fillRect(640, 320, 20, 100);

    if (opts.town !== false) {
        const town = scene.add.graphics().setDepth(-80);
        const bld = (x, y, w, h, c) => {
            town.fillStyle(c, 1).fillRect(x, y, w, h);
            town.fillStyle(0x3a1f12, 1).fillRect(x - 3, y - 8, w + 6, 10);
            town.fillStyle(0xFFD98A, 0.8).fillRect(x + 8, y + 14, 12, 16).fillRect(x + w - 20, y + 14, 12, 16);
            town.fillStyle(0x2a160c, 1).fillRect(x + w / 2 - 8, y + h - 28, 16, 28);
        };
        bld(420, 372, 70, 70, 0x8B5136); bld(498, 358, 86, 84, 0x75412D); bld(592, 378, 60, 64, 0x9A5C3B);
        bld(740, 380, 64, 62, 0x8B5136); bld(812, 366, 80, 76, 0x75412D);
        town.fillStyle(0x3a1f12, 1).fillRect(528, 330, 28, 16);
    }

    // tanah
    const ground = scene.add.graphics().setDepth(-70);
    ground.fillStyle(0xB86B3E, 1).fillRect(-2000, 440, 5000, 1500);
    ground.fillStyle(0xC9804A, 1).fillRect(-2000, 440, 5000, 10);
    ground.fillStyle(0x9A5530, 1).fillRect(-2000, 500, 5000, 1500);
    ground.fillStyle(0x70402B, 0.35);
    for (let i = 0; i < 160; i++) ground.fillCircle(Phaser.Math.Between(-500, 1500), Phaser.Math.Between(455, 800), Phaser.Math.Between(1, 3));
    ground.lineStyle(2, 0x8A4A28, 0.5);
    for (let i = 0; i < 14; i++) { const x = Phaser.Math.Between(0, 940); const y = Phaser.Math.Between(460, 590); ground.lineBetween(x, y, x + Phaser.Math.Between(20, 60), y + Phaser.Math.Between(-2, 2)); }

    cactus(scene, 70, 470, 1.25, -60);
    cactus(scene, 935, 462, 1.0, -60);
    if (opts.extraCactus) cactus(scene, 640, 478, 0.7, -75);

    // awan
    for (const [x, y, s] of [[-100, 100, 1], [330, 170, 0.7], [1000, 80, 1.2], [-700, 60, 0.9], [1600, 130, 1]]) cloud(scene, x, y, s);
    // debu melayang
    for (let i = 0; i < 14; i++) {
        const d = scene.add.circle(Phaser.Math.Between(-300, 1300), Phaser.Math.Between(470, 700), Phaser.Math.Between(2, 4), 0xF5C58C, 0.5).setDepth(-50);
        scene.tweens.add({
            targets: d, x: d.x + Phaser.Math.Between(40, 120), y: d.y - Phaser.Math.Between(10, 40), alpha: 0,
            duration: Phaser.Math.Between(2500, 5200), repeat: -1,
            onRepeat: () => { d.x = Phaser.Math.Between(-300, 1300); d.y = Phaser.Math.Between(470, 700); d.alpha = 0.5; }
        });
    }
    // tumbleweed lewat
    tumbleweedDeco(scene, 520);
}

export function cactus(scene, x, y, s = 1, depth = -60) {
    const c = scene.add.container(x, y).setDepth(depth);
    const g = scene.add.graphics();
    g.fillStyle(0x2A5A38, 1);
    g.fillRoundedRect(-12, -100, 24, 100, 11);
    g.fillRoundedRect(-34, -64, 14, 36, 7); g.fillRoundedRect(-34, -64, 30, 13, 6);
    g.fillRoundedRect(20, -78, 14, 42, 7); g.fillRoundedRect(4, -50, 30, 13, 6);
    g.fillStyle(0x3F8A52, 1);
    g.fillRoundedRect(-8, -96, 9, 92, 5);
    g.lineStyle(1, 0xE8D6A0, 0.8);
    for (let i = 0; i < 8; i++) { const yy = -90 + i * 12; g.lineBetween(-12, yy, -16, yy - 2); g.lineBetween(12, yy + 5, 16, yy + 3); }
    c.add(g).setScale(s);
    scene.tweens.add({ targets: c, angle: 1.2, duration: 2400 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return c;
}

export function cloud(scene, x, y, s = 1) {
    const c = scene.add.container(x, y).setDepth(-92);
    c.add([
        scene.add.circle(-25, 0, 20, 0xFFF0D0, 0.7), scene.add.circle(0, -10, 27, 0xFFF0D0, 0.7),
        scene.add.circle(27, 0, 19, 0xFFF0D0, 0.7), scene.add.rectangle(0, 10, 75, 22, 0xFFF0D0, 0.7)
    ]).setScale(s);
    scene.tweens.add({ targets: c, x: x + 3600, duration: 160000 / s, repeat: -1, onRepeat: () => { c.x = -1500; } });
}

export function tumbleweedDeco(scene, y) {
    const w = scene.add.container(-900, y).setDepth(-40);
    const g = scene.add.graphics();
    g.lineStyle(2, 0x6B4226, 0.9);
    for (let i = 0; i < 6; i++) g.strokeEllipse(0, 0, 26, 8 + i * 4);
    g.strokeCircle(0, 0, 14);
    w.add(g);
    scene.tweens.add({ targets: w, angle: 1400, duration: 16000, repeat: -1 });
    scene.tweens.add({ targets: w, x: 1900, duration: 16000, repeat: -1, delay: 1200 });
    scene.tweens.add({ targets: w, y: y - 12, duration: 450, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
}
