import Phaser from 'phaser';
import { gradientRect, plank, text, COL } from '../ui/Theme.js';

/** Menggambar seluruh latar arena (statis). Floor kaki pemain: y ~200..551 */
export function drawArena(scene) {
    // --- langit + matahari + mesa ---
    scene.add.rectangle(500, -1500, 6000, 3000, 0xF6CE86).setDepth(-101);
    gradientRect(scene, -2000, 0, 5000, 190, 0xF6CE86, 0xE9A862, 24).setDepth(-100);
    scene.add.circle(840, 70, 70, 0xFFE8A0, 0.2).setDepth(-99);
    scene.add.circle(840, 70, 44, 0xFFF0B8).setDepth(-99);
    const m = scene.add.graphics().setDepth(-98);
    m.fillStyle(0xCF8A5A, 1).fillTriangle(-40, 160, 160, 60, 360, 160).fillTriangle(600, 160, 780, 70, 1000, 160);
    m.fillTriangle(-700, 160, -480, 55, -250, 160).fillTriangle(1150, 160, 1380, 60, 1650, 160);
    m.fillStyle(0xB86B49, 1).fillRect(240, 110, 150, 50).fillRect(252, 96, 126, 16).fillRect(520, 118, 120, 42).fillRect(534, 104, 92, 16);

    // --- tanah luar ---
    gradientRect(scene, -2000, 140, 5000, 460, 0xD2995F, 0xB87A40, 20).setDepth(-90);
    scene.add.rectangle(500, 1300, 5000, 1400, 0xB87A40).setDepth(-90);

    // --- deretan bangunan kota ---
    const labels = ['SALOON', 'BANK', 'SHERIFF', 'HOTEL', 'STORE'];
    const cols = [0x8B5136, 0x75412D, 0x9A5C3B, 0x7C4630, 0x8B5136];
    const town = scene.add.graphics().setDepth(-80);
    let x = -1510;
    for (let i = 0; x < 2500; i++) {
        const lb = labels[i % labels.length];
        const ci = i % cols.length;
        const w = 178 + (i % 2) * 14, h = 54 + (i % 3) * 7;
        const top = 150 - h;
        town.fillStyle(cols[ci], 1).fillRect(x, top, w, h);
        town.fillStyle(0x3a1f12, 1).fillRect(x - 3, top - 7, w + 6, 10);
        town.fillStyle(0x000000, 0.18).fillRect(x, top + 10, w, 4);
        town.fillStyle(0x2a160c, 1).fillRect(x + w / 2 - 9, 150 - 30, 18, 30);
        town.fillStyle(0xFFD98A, 0.9).fillRect(x + 12, top + 24, 14, 18).fillRect(x + w - 26, top + 24, 14, 18);
        town.fillStyle(0xE9BD58, 0.35).fillRect(x + 12, top + 24, 14, 4);
        const sign = scene.add.rectangle(x + w / 2, top + 14, 88, 17, 0x3a1f12).setDepth(-79).setStrokeStyle(1, 0xE5B06D);
        text(scene, sign.x, sign.y, lb, 11, '#FFD76A').setDepth(-78);
        x += w + 4;
    }

    // --- lantai arena ---
    const f = scene.add.graphics().setDepth(0);
    f.fillStyle(0x000000, 0.18).fillRoundedRect(50, 166, 900, 410, 16);
    f.fillStyle(0xE1B274, 1).fillRoundedRect(48, 158, 904, 408, 14);
    f.fillStyle(0xEBC58A, 0.55).fillRoundedRect(60, 168, 880, 150, 12);
    f.lineStyle(4, 0xA86F3B, 0.8).strokeRoundedRect(48, 158, 904, 408, 14);
    f.fillStyle(0xA86F3B, 0.28);
    for (let i = 0; i < 160; i++) f.fillEllipse(Phaser.Math.Between(66, 934), Phaser.Math.Between(176, 556), Phaser.Math.Between(3, 9), Phaser.Math.Between(2, 4));
    f.lineStyle(2, 0xA86F3B, 0.35);
    for (let i = 0; i < 22; i++) {
        const lx = Phaser.Math.Between(70, 880), ly = Phaser.Math.Between(190, 545);
        f.lineBetween(lx, ly, lx + Phaser.Math.Between(18, 44), ly + Phaser.Math.Between(-3, 3));
    }
    f.fillStyle(0x70402B, 0.4);
    for (let i = 0; i < 14; i++) f.fillCircle(Phaser.Math.Between(70, 930), Phaser.Math.Between(185, 550), Phaser.Math.Between(2, 4));
    scene.add.star(500, 372, 5, 52, 128, 0xB77A3F, 0.2).setDepth(0.5);
    scene.add.circle(500, 372, 150).setStrokeStyle(4, 0xB77A3F, 0.25).setDepth(0.5);

    // --- pagar belakang + samping ---
    const fence = (g, y) => {
        g.fillStyle(0x000000, 0.22).fillRect(44, y - 4, 912, 6);
        g.fillStyle(0x8B5A36, 1).fillRect(44, y - 24, 912, 6).fillRect(44, y - 11, 912, 6);
        g.fillStyle(0xB07A4A, 1).fillRect(44, y - 24, 912, 2).fillRect(44, y - 11, 912, 2);
        for (let px = 48; px <= 952; px += 52) {
            g.fillStyle(0x6B4226, 1).fillRect(px - 5, y - 32, 10, 36);
            g.fillStyle(0x8B5A36, 1).fillRect(px - 5, y - 32, 4, 36);
            g.fillStyle(0x3a1f12, 1).fillRect(px - 5, y - 34, 10, 3);
        }
    };
    const back = scene.add.graphics().setDepth(1);
    fence(back, 160);
    const sides = scene.add.graphics().setDepth(1);
    sides.fillStyle(0x6B4226, 1).fillRect(40, 130, 8, 440).fillRect(952, 130, 8, 440);
    sides.fillStyle(0x8B5A36, 1).fillRect(40, 130, 3, 440).fillRect(952, 130, 3, 440);

    // strip depan gelap + pagar depan (menutupi kaki bila mepet)
    scene.add.rectangle(500, 585, 5000, 36, 0x7A4524).setDepth(560);
    scene.add.rectangle(500, 1200, 5000, 1200, 0x7A4524).setDepth(560);
    const front = scene.add.graphics().setDepth(570);
    fence(front, 572);

    // poster wanted di pagar belakang
    [[190, 'WANTED'], [770, 'REWARD']].forEach(([px, lb]) => {
        scene.add.rectangle(px, 128, 40, 30, 0xF3DBA5).setStrokeStyle(2, 0x75412D).setDepth(2).setAngle(px < 500 ? -3 : 4);
        text(scene, px, 128, lb, 8, '#75412D').setDepth(3).setAngle(px < 500 ? -3 : 4);
    });

    // papan nama arena
    const sg = scene.add.graphics().setDepth(5);
    sg.lineStyle(3, 0x3a1f12, 1).lineBetween(430, 88, 440, 108).lineBetween(570, 88, 560, 108);
    plank(scene, sg, 410, 104, 180, 30, { color: 0x6B3A22 });
    text(scene, 500, 119, 'WILD WEST ARENA', 13, '#FFD76A').setDepth(6);

    // dekor depan: tong
    [[26, 560], [974, 560]].forEach(([bx, by]) => {
        const b = scene.add.graphics().setDepth(575);
        b.fillStyle(0x6B3A22, 1).fillRoundedRect(bx - 17, by - 30, 34, 42, 6);
        b.fillStyle(0x3a1f12, 1).fillRect(bx - 17, by - 20, 34, 4).fillRect(bx - 17, by - 2, 34, 4);
        b.fillStyle(0xFFFFFF, 0.12).fillRect(bx - 14, by - 28, 6, 38);
    });

    // debu melayang
    for (let i = 0; i < 8; i++) {
        const d = scene.add.circle(Phaser.Math.Between(60, 940), Phaser.Math.Between(200, 540), Phaser.Math.Between(2, 3), 0xF5C58C, 0.4).setDepth(700);
        scene.tweens.add({
            targets: d, x: d.x + Phaser.Math.Between(60, 150), y: d.y - Phaser.Math.Between(10, 30), alpha: 0,
            duration: Phaser.Math.Between(3000, 5500), repeat: -1,
            onRepeat: () => { d.x = Phaser.Math.Between(60, 940); d.y = Phaser.Math.Between(200, 540); d.alpha = 0.4; }
        });
    }
}
