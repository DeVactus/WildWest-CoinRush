const PALETTES = [
    { vest: 0x3b2a22, shirt: 0xB9A27A },
    { vest: 0x5a2a2a, shirt: 0x8E8E8E },
    { vest: 0x2a3a4a, shirt: 0xC9B48A },
    { vest: 0x3d4a2a, shirt: 0xAE9A74 }
];

export const BANDIT_FOOT = 34;

export default class Bandit {
    constructor(scene, x, y, index = 0) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.dir = 1;
        this.angle = 0;
        this.pal = PALETTES[index % PALETTES.length];
        this.state = 'patrol';
        this.stateT = 0;
        this.build();
    }

    build() {
        const s = this.scene;
        const p = this.pal;
        this.shadow = s.add.ellipse(this.x, this.y + BANDIT_FOOT, 44, 13, 0x3a2310, 0.35);
        this.visual = s.add.container(this.x, this.y);

        const legs = s.add.graphics();
        legs.fillStyle(0x3a2e28, 1).fillRect(-11, 14, 9, 20).fillRect(2, 14, 9, 20);
        legs.fillStyle(0x1f1612, 1).fillRect(-13, 31, 13, 6).fillRect(1, 31, 13, 6);

        const body = s.add.graphics();
        body.fillStyle(p.shirt, 1).fillRoundedRect(-13, -14, 26, 30, 5);
        body.fillStyle(p.vest, 1).fillRect(-13, -14, 8, 28).fillRect(5, -14, 8, 28);
        body.fillStyle(0xE9BD58, 1).fillRect(-8, -6, 3, 3).fillRect(5, 2, 3, 3);       // kancing
        body.fillStyle(0x2a1a10, 1).fillRect(-13, 11, 26, 5);
        body.fillStyle(0xC99A3C, 1).fillRect(-3, 10, 6, 7);
        // peluru di sabuk
        body.fillStyle(0xD9B25A, 1);
        for (let i = -3; i <= 2; i++) body.fillRect(i * 4 - 1, 12, 2, 4);
        // kepala + bandana merah
        body.fillStyle(0xD6A27A, 1).fillCircle(0, -26, 12);
        body.fillStyle(0xA83C32, 1).fillRoundedRect(-12, -26, 24, 12, { tl: 0, tr: 0, bl: 8, br: 8 });
        body.fillTriangle(-12, -20, -20, -14, -10, -14);
        // mata sipit marah
        body.fillStyle(0x1a0f0a, 1).fillCircle(-4, -30, 2).fillCircle(4, -30, 2);
        body.lineStyle(2, 0x1a0f0a, 1).lineBetween(-8, -35, -2, -32).lineBetween(8, -35, 2, -32);
        // topi hitam
        body.fillStyle(0x201510, 1).fillEllipse(0, -37, 44, 10).fillRoundedRect(-11, -53, 22, 17, 4);
        body.fillStyle(0xA83C32, 1).fillRect(-11, -42, 22, 3);
        body.fillStyle(0xE9BD58, 1).fillCircle(0, -40.5, 2);

        // lengan senjata
        this.gunArm = s.add.container(10, -8);
        const arm = s.add.graphics();
        arm.fillStyle(p.shirt, 1).fillRoundedRect(0, -4, 17, 8, 3);
        arm.fillStyle(0xD6A27A, 1).fillCircle(18, 0, 5);
        arm.fillStyle(0x2c2c2c, 1).fillRect(16, -4, 18, 6);       // laras
        arm.fillStyle(0x5a3a22, 1).fillRoundedRect(14, 0, 8, 10, 2); // gagang
        this.gunArm.add(arm);

        const offArm = s.add.graphics();
        offArm.fillStyle(p.shirt, 1).fillRoundedRect(-19, -12, 8, 20, 3);
        offArm.fillStyle(0xD6A27A, 1).fillCircle(-15, 10, 4.5);

        this.visual.add([legs, body, offArm, this.gunArm]);

        this.alertMark = s.add.text(this.x, this.y - 70, '!', {
            fontFamily: 'Rye, Georgia, serif', fontSize: '30px', color: '#FF3B2F', stroke: '#fff1c2', strokeThickness: 4
        }).setOrigin(0.5).setVisible(false);
    }

    /** arahkan senjata ke sudut (radian, dunia) */
    aim(angle) {
        this.angle = angle;
        const d = Math.cos(angle) >= 0 ? 1 : -1;
        this.dir = d;
        this.visual.setScale(d, 1);
        this.gunArm.setRotation(d > 0 ? angle : Math.PI - angle);
    }

    muzzle() {
        const sx = this.x + this.dir * 10;
        const sy = this.y - 8;
        return { x: sx + Math.cos(this.angle) * 36, y: sy + Math.sin(this.angle) * 36 };
    }

    place(x, y) {
        this.x = x;
        this.y = y;
        this.visual.setPosition(x, y);
        this.shadow.setPosition(x, y + BANDIT_FOOT);
        this.alertMark.setPosition(x, y - 72);
    }

    setDepth(d) {
        this.visual.setDepth(d);
        this.shadow.setDepth(d - 0.5);
        this.alertMark.setDepth(d + 600);
    }

    showAlert(on) { this.alertMark.setVisible(on); }

    recoil() {
        const s = this.scene;
        s.tweens.add({ targets: this.visual, x: this.x - this.dir * 6, duration: 60, yoyo: true });
        s.tweens.add({ targets: this.gunArm, scaleX: 0.85, duration: 60, yoyo: true });
    }

    destroy() {
        this.visual.destroy();
        this.shadow.destroy();
        this.alertMark.destroy();
    }
}
