const DEFAULT = { skin: 0xE9B98A, shirt: 0xC47A38, hair: 0x38251D, gender: 'male' };

export const FOOT = 36; // jarak pusat badan -> telapak kaki

export default class Player {
    constructor(scene, x, y, character = {}, { shadow = true } = {}) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.ch = { ...DEFAULT, ...character };
        this.radius = 17;
        this.build(shadow);
    }

    build(withShadow) {
        const s = this.scene;
        const c = this.ch;

        this.shadow = withShadow ? s.add.ellipse(this.x, this.y + FOOT, 46, 14, 0x3a2310, 0.38) : null;
        this.visual = s.add.container(this.x, this.y);

        // kaki & sepatu (pivot di pinggul supaya ayunannya natural)
        const mkLeg = (lx) => {
            const leg = s.add.container(lx, 12);
            leg.add([s.add.rectangle(0, 11, 9, 22, 0x49301F), s.add.rectangle(lx < 0 ? -1 : 1, 24, 15, 8, 0x241810)]);
            return leg;
        };
        this.legs = [mkLeg(-7), mkLeg(7)];

        // lengan (pivot di bahu)
        const mkArm = (ax) => {
            const arm = s.add.container(ax, -11);
            arm.add([s.add.rectangle(0, 11, 9, 22, c.shirt), s.add.circle(0, 24, 5, c.skin)]);
            return arm;
        };
        this.arms = [mkArm(-17), mkArm(17)];

        const g = s.add.graphics();
        // rambut panjang (karakter wanita) di belakang kepala
        if (c.gender === 'female') {
            g.fillStyle(c.hair, 1);
            g.fillRoundedRect(-14, -34, 28, 40, 10);
        }
        // badan
        g.fillStyle(c.shirt, 1).fillRoundedRect(-13, -14, 26, 33, 5);
        g.fillStyle(0xFFFFFF, 0.12).fillRoundedRect(-13, -14, 10, 33, 4);
        // rompi kulit
        g.fillStyle(0x6B4226, 1).fillRect(-13, -14, 7, 28).fillRect(6, -14, 7, 28);
        // sabuk + gesper
        g.fillStyle(0x3a2616, 1).fillRect(-13, 11, 26, 5);
        g.fillStyle(0xE9BD58, 1).fillRect(-4, 10, 8, 7);
        g.fillStyle(0xC99A3C, 1).fillRect(-2, 12, 4, 3);
        // holster
        g.fillStyle(0x4a2f1b, 1).fillRoundedRect(7, 13, 8, 12, 2);
        g.fillStyle(0x777777, 1).fillRect(10, 11, 3, 4);
        // leher + syal
        g.fillStyle(c.skin, 1).fillRect(-5, -21, 10, 8);
        g.fillStyle(0xA83C32, 1).fillRoundedRect(-9, -18, 18, 6, 2);
        g.fillTriangle(-3, -13, 3, -13, 0, -5);
        // kepala
        g.fillStyle(c.skin, 1).fillCircle(0, -28, 12);
        g.fillStyle(0xFFFFFF, 0.12).fillCircle(-4, -31, 5);
        // rambut / poni
        g.fillStyle(c.hair, 1);
        if (c.gender === 'female') {
            g.fillRoundedRect(-13, -37, 26, 10, 6);
            g.fillRoundedRect(-14, -30, 6, 22, 3).fillRoundedRect(8, -30, 6, 22, 3);
        } else {
            g.fillRect(-12, -35, 24, 8);
        }
        // mata & senyum
        g.fillStyle(0x241810, 1).fillCircle(-4, -27, 1.8).fillCircle(4, -27, 1.8);
        g.lineStyle(1.5, 0x8a4a30, 1).lineBetween(-3, -21, 3, -21);
        // topi cowboy
        g.fillStyle(0x593A23, 1);
        g.fillEllipse(0, -36, 42, 10);
        g.fillRoundedRect(-10, -50, 20, 15, 4);
        g.fillStyle(0x3d2615, 1).fillRect(-10, -41, 20, 3);
        g.fillStyle(0xD7A64D, 1).fillRect(-10, -41, 20, 1.5);
        g.fillStyle(0xFFFFFF, 0.14).fillEllipse(-8, -37, 14, 4);

        this.visual.add([...this.legs, g, ...this.arms]);
        this.body = g;
    }

    setPosition(x, y, lift = 0) {
        this.x = x;
        this.y = y;
        this.lift = lift;
        this.visual.setPosition(x, y - lift);
        if (this.shadow) {
            this.shadow.setPosition(x, y + FOOT);
            const k = 1 - Math.min(0.5, lift / 140);
            this.shadow.setScale(k).setAlpha(0.38 * k);
        }
    }

    setFacing(dir) {
        if (dir < 0) this.visual.setScale(-Math.abs(this.visual.scaleX), this.visual.scaleY);
        else if (dir > 0) this.visual.setScale(Math.abs(this.visual.scaleX), this.visual.scaleY);
    }

    setScale(k) { this.visual.setScale(k); }

    animate(time, moving, airborne) {
        if (airborne) {
            this.arms[0].setRotation(-2.4); this.arms[1].setRotation(2.4);
            this.legs[0].setRotation(-0.4); this.legs[1].setRotation(0.4);
        } else if (moving) {
            const sw = Math.sin(time / 85) * 0.7;
            this.arms[0].setRotation(sw); this.arms[1].setRotation(-sw);
            this.legs[0].setRotation(-sw); this.legs[1].setRotation(sw);
            this.visual.y = this.y - this.lift - Math.abs(Math.sin(time / 85)) * 3;
        } else {
            const b = Math.sin(time / 380) * 0.05;
            this.arms[0].setRotation(b); this.arms[1].setRotation(-b);
            this.legs.forEach((l) => l.setRotation(0));
        }
    }

    setDepth(d) {
        this.visual.setDepth(d);
        if (this.shadow) this.shadow.setDepth(d - 0.5);
    }

    setAlpha(a) { this.visual.setAlpha(a); }

    destroy() {
        this.visual.destroy();
        if (this.shadow) this.shadow.destroy();
    }
}
