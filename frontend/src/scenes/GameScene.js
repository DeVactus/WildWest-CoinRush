import Phaser from 'phaser';
import Player, { FOOT } from '../objects/Player.js';
import Bandit, { BANDIT_FOOT } from '../objects/Bandit.js';
import { drawArena } from '../objects/ArenaArt.js';
import { audio } from '../systems/AudioManager.js';
import { Leaderboard } from '../systems/LeaderboardService.js';
import { openLeaderboard } from '../ui/Modals.js';
import { COL, fitCamera, plank, text, woodButton, addVignette, fadeIn, fadeTo } from '../ui/Theme.js';

const CAP_LIVES = 5;
const FX_TIME = 7000;
const HAZARD_POSITIONS = [
    [300, 220], [550, 225], [800, 240], [250, 440], [680, 460], [880, 390], [430, 350], [150, 470],
    [770, 330], [530, 485], [350, 280], [900, 180], [610, 260], [180, 220], [470, 470], [820, 490]
];
const PICKUPS = {
    shield: { color: 0x4FA3E0, glyph: '★', label: 'SHERIFF BADGE!' },
    boost: { color: 0xE0822F, glyph: '»', label: 'SPEEDY BOOTS!' },
    magnet: { color: 0xC0392B, glyph: 'U', label: 'COIN MAGNET!' },
    clock: { color: 0x8E6BBF, glyph: '+10', label: '+10 SECONDS!' },
    heart: { color: 0xE0506A, glyph: '♥', label: 'EXTRA LIFE!' }
};

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.playerSpeed = 230;
        this.maxLives = 3;
        this.coinsPerWave = 20;
        this.gameDuration = 300;
    }

    // =====================================================  SETUP
    create() {
        this.time.paused = false;
        this.tweens.resumeAll();
        audio.duck(false);
        fitCamera(this);
        fadeIn(this);
        this._leaving = false;

        this.gt = 0;                       // jam game sendiri (berhenti saat pause)
        this.score = 0;
        this.totalCoins = 0;
        this.coinsCollected = 0;
        this.lives = this.maxLives;
        this.wave = 1;
        this.remainingTime = this.gameDuration;
        this.gameOver = false;
        this.isPaused = false;
        this.pauseObjects = [];
        this.invulnerableUntil = 0;
        this.combo = 0;
        this.lastCoinAt = -9999;
        this.fx = { shield: 0, boost: 0, magnet: 0 };
        this.hazards = []; this.coins = []; this.bandits = []; this.bullets = [];
        this.weeds = []; this.dynamites = []; this.pickups = [];
        this.touchInput = { left: false, right: false, up: false, down: false };
        this.touchJumpJustPressed = false;
        this.jumpDuration = 550; this.jumpHeight = 65; this.jumpStartedAt = 0; this.isJumping = false; this.lift = 0;
        this.arena = { left: 55, right: 945, top: 145, bottom: 535 };

        this.playerName = this.registry.get('playerName') || 'COWBOY';
        const character = this.registry.get('selectedCharacter') || {};
        this.characterName = character.name || 'JACK MORGAN';

        drawArena(this);
        this.player = new Player(this, 120, 330, character);
        this.player.setDepth(330 + FOOT);
        this.shieldBubble = this.add.circle(0, 0, 38, 0x7CC9FF, 0.2).setStrokeStyle(3, 0xCFEFFF, 0.9).setVisible(false);
        this.aimGfx = this.add.graphics().setDepth(700);
        addVignette(this, 800, 0.38);
        this.flash = this.add.rectangle(500, 300, 6000, 4000, 0xFF2200, 0).setDepth(850);

        this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE');
        this.input.keyboard.on('keydown-ESC', () => this.togglePause());
        this.input.keyboard.on('keydown-P', () => this.togglePause());
        this.input.keyboard.on('keydown-M', () => audio.toggleMute());
        this.onBlur = () => { if (!this.gameOver) this.pauseGame(); };
        this.game.events.on('blur', this.onBlur);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.game.events.off('blur', this.onBlur);
            audio.duck(false);
        });

        this.createHUD();
        this.createTouchControls();
        audio.play('game');
        audio.setIntensity(0);
        this.startWave();

        const hint = text(this, 500, 585, 'WASD / ARROWS: MOVE   ·   SPACE: JUMP   ·   ESC: PAUSE', 12, '#FFF1C2', { body: true, stroke: '#3a1f12', strokeThickness: 3 }).setDepth(1001);
        this.tweens.add({ targets: hint, alpha: 0, delay: 6000, duration: 900 });
    }

    // =====================================================  HUD
    createHUD() {
        const g = this.add.graphics().setDepth(1000);
        plank(this, g, 20, 6, 960, 76, { color: 0x4a2616 });
        const D = 1002;
        const L = { ox: 0, oy: 0.5, stroke: '#2a160c', strokeThickness: 3 };

        this.nameText = text(this, 40, 24, this.playerName.toUpperCase(), 14, '#F5D9A2', L).setDepth(D);
        this.scoreText = text(this, 40, 55, 'SCORE 0', 20, '#FFFFFF', L).setDepth(D);
        this.coinText = text(this, 300, 26, 'COINS 0/20', 17, '#FFD76A', L).setDepth(D);
        this.coinBar = this.add.graphics().setDepth(D);
        this.waveText = text(this, 520, 26, 'WAVE 1', 17, '#FFFFFF', L).setDepth(D);
        this.banditText = text(this, 520, 52, '', 12, '#FFB3A8', { ...L, body: true, strokeThickness: 2 }).setDepth(D);
        this.heartGfx = this.add.graphics().setDepth(D);
        this.timerText = text(this, 858, 44, '05:00', 22, '#FFFFFF', { stroke: '#2a160c', strokeThickness: 3 }).setDepth(D);

        this.pauseBtn = this.add.rectangle(948, 44, 38, 38, 0x704323).setStrokeStyle(3, 0xD6A85D).setDepth(D)
            .setInteractive({ useHandCursor: true });
        this.add.text(948, 44, 'Ⅱ', { fontFamily: 'Arial', fontSize: '22px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(D + 1);
        this.pauseBtn.on('pointerdown', () => this.pauseGame());

        this.fxText = text(this, 40, 98, '', 13, '#FFE9A8', { ox: 0, oy: 0, body: true, stroke: '#2a160c', strokeThickness: 3, align: 'left', style: { lineSpacing: 4 } }).setDepth(D);
        this.comboText = text(this, 500, 104, '', 24, '#FFD76A', { stroke: '#3a1f12', strokeThickness: 5 }).setDepth(D);
        this.comboBar = this.add.graphics().setDepth(D);
        this.hudCache = {};
        this.drawHearts();
    }

    drawHearts() {
        const g = this.heartGfx;
        g.clear();
        for (let i = 0; i < CAP_LIVES; i++) {
            const x = 690 + i * 28, y = 38;
            const full = i < this.lives;
            if (i >= Math.max(this.maxLives, this.lives)) continue;
            g.fillStyle(full ? 0xFF5B6B : 0x2a160c, 1);
            g.fillCircle(x - 6, y - 3, 7.5).fillCircle(x + 6, y - 3, 7.5).fillTriangle(x - 13, y, x + 13, y, x, y + 14);
            g.lineStyle(2, full ? 0xFFB3BA : 0x6b4a3a, 1).strokeCircle(x - 6, y - 3, 7.5);
        }
    }

    updateHUD() {
        const set = (key, obj, val) => { if (this.hudCache[key] !== val) { this.hudCache[key] = val; obj.setText(val); } };
        set('s', this.scoreText, `SCORE ${this.score}`);
        set('c', this.coinText, `COINS ${this.coinsCollected}/${this.coinsPerWave}`);
        set('w', this.waveText, `WAVE ${this.wave}`);
        set('b', this.banditText, `OUTLAWS: ${this.bandits.length}`);

        const k = this.coinsCollected / this.coinsPerWave;
        if (this.hudCache.bar !== k) {
            this.hudCache.bar = k;
            this.coinBar.clear().fillStyle(0x2a160c, 1).fillRoundedRect(300, 42, 160, 11, 5)
                .fillStyle(0xFFD447, 1).fillRoundedRect(301, 43, Math.max(0, 158 * k), 9, 4);
        }

        const t = Math.max(0, Math.ceil(this.remainingTime));
        set('t', this.timerText, `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
        this.timerText.setColor(this.remainingTime < 30 ? '#FF6B5B' : '#FFFFFF');

        // efek aktif
        const lines = [];
        const left = (v) => ((v - this.gt) / 1000).toFixed(1);
        if (this.fx.shield > this.gt) lines.push(`★ SHIELD  ${left(this.fx.shield)}s`);
        if (this.fx.boost > this.gt) lines.push(`» SPEED   ${left(this.fx.boost)}s`);
        if (this.fx.magnet > this.gt) lines.push(`U MAGNET  ${left(this.fx.magnet)}s`);
        this.fxText.setText(lines.join('\n'));

        // combo
        const cm = this.comboMult();
        const active = this.combo >= 3 && this.gt - this.lastCoinAt < 2000;
        this.comboText.setText(active ? `COMBO x${cm}` : '');
        this.comboBar.clear();
        if (active) {
            const f = 1 - (this.gt - this.lastCoinAt) / 2000;
            this.comboBar.fillStyle(0x2a160c, 1).fillRoundedRect(440, 122, 120, 7, 3).fillStyle(0xFFD76A, 1).fillRoundedRect(441, 123, 118 * f, 5, 2);
        }
    }

    comboMult() { return Math.min(5, 1 + Math.floor((this.combo - 1) / 3)); }

    // =====================================================  TOUCH
    createTouchControls() {
        if (!this.sys.game.device.input.touch) return;
        const make = (x, y, label, key) => {
            const b = this.add.circle(x, y, 27, 0x422C20, 0.65).setDepth(1500).setStrokeStyle(2, 0xD6A85D);
            b.setInteractive(new Phaser.Geom.Circle(27, 27, 27), Phaser.Geom.Circle.Contains);
            this.add.text(x, y, label, { fontFamily: 'Arial', fontSize: key === 'jump' ? '13px' : '25px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(1501);
            b.on('pointerdown', () => { if (key === 'jump') this.touchJumpJustPressed = true; else this.touchInput[key] = true; b.setAlpha(0.95); });
            const rel = () => { if (key !== 'jump') this.touchInput[key] = false; b.setAlpha(0.65); };
            b.on('pointerup', rel); b.on('pointerout', rel); b.on('pointerupoutside', rel);
        };
        make(105, 435, '↑', 'up'); make(55, 485, '←', 'left'); make(105, 485, '↓', 'down'); make(155, 485, '→', 'right');
        make(890, 475, 'JUMP', 'jump');
    }

    // =====================================================  PAUSE
    togglePause() { this.isPaused ? this.resumeGame() : this.pauseGame(); }

    pauseGame() {
        if (this.gameOver || this.isPaused) return;
        this.isPaused = true;
        this.touchInput = { left: false, right: false, up: false, down: false };
        this.touchJumpJustPressed = false;
        this.tweens.pauseAll();
        audio.duck(true);

        const bg = this.add.rectangle(500, 300, 6000, 4000, 0x1A120D, 0.82).setDepth(2100).setInteractive();
        const g = this.add.graphics().setDepth(2101);
        plank(this, g, 330, 120, 340, 360, { color: 0x5a2f1b });
        const title = text(this, 500, 172, 'PAUSED', 40, '#FFD76A', { stroke: '#3a1f12', strokeThickness: 6 }).setDepth(2102);
        const sub = text(this, 500, 214, 'TAKE A LITTLE BREAK, COWBOY!', 11, '#FFF1C2', { body: true }).setDepth(2102);
        this.pauseObjects.push(bg, g, title, sub);

        const mk = (y, label, cb, color) => {
            const b = woodButton(this, 500, y, 250, 50, label, cb, { size: 19, color, noTween: true }).setDepth(2103);
            this.pauseObjects.push(b);
            return b;
        };
        mk(268, 'RESUME', () => this.resumeGame(), COL.red);
        mk(328, 'RESTART', () => { this.resumeGame(); this.scene.restart(); });
        const snd = mk(388, audio.settings.muted ? 'SOUND: OFF' : 'SOUND: ON', () => {
            audio.toggleMute();
            snd.label.setText(audio.settings.muted ? 'SOUND: OFF' : 'SOUND: ON');
        });
        mk(448, 'MAIN MENU', () => { this.resumeGame(); fadeTo(this, 'MainMenu'); });
    }

    resumeGame() {
        if (!this.isPaused) return;
        this.pauseObjects.forEach((o) => o.destroy());
        this.pauseObjects = [];
        this.touchInput = { left: false, right: false, up: false, down: false };
        this.isPaused = false;
        this.tweens.resumeAll();
        audio.duck(false);
    }

    // =====================================================  WAVES
    startWave() {
        this.clearAll();
        this.coinsCollected = 0;
        this.createHazards(Math.min(4 + (this.wave - 1) * 2, 16));
        this.createCoins(this.coinsPerWave);
        this.spawnBandits();

        this.activeAt = this.gt + 1600;
        this.weedTimer = this.gt + 4500;
        this.dynTimer = this.gt + 7000;
        this.pickupTimer = this.gt + 7000 + Phaser.Math.Between(0, 3000);

        audio.sfx('wave');
        audio.setIntensity(this.wave - 1);
        this.showBanner();
        this.updateHUD();
    }

    showBanner() {
        const notes = {
            1: 'Mati disini mah tidur aja mas!, POKE AMAT!!!',
            2: 'Btw ada gelindingan tuh, hindarin ye biar ga mati!',
            3: 'LAH SAMPAI SINI?!?!, MAKAN NIH BOM!!!',
            4: 'BUNUH DIA BURUANNN!!!!!'
        };
        const sub = notes[this.wave] || (this.wave % 2 ? 'MATI KAUUUUUUU SUKIIIII' : 'BUNUH DIAAAAA CEPATTTTTTTT');
        const c = this.add.container(-300, 255).setDepth(1200);
        const g = this.add.graphics();
        plank(this, g, -230, -48, 460, 96, { color: 0x5a2f1b });
        c.add([g, text(this, 0, -14, `WAVE ${this.wave}`, 34, '#FFD76A', { stroke: '#3a1f12', strokeThickness: 6 }),
            text(this, 0, 26, sub, 13, '#FFF1C2', { body: true })]);
        this.tweens.add({ targets: c, x: 500, duration: 520, ease: 'Back.easeOut', yoyo: true, hold: 1500, onComplete: () => c.destroy() });
    }

    clearAll() {
        this.coins.forEach((c) => c.c.destroy());
        this.hazards.forEach((h) => h.graphic.destroy());
        this.bandits.forEach((b) => b.destroy());
        this.bullets.forEach((b) => b.g.destroy());
        this.weeds.forEach((w) => { w.g.destroy(); w.sh.destroy(); });
        this.dynamites.forEach((d) => this.destroyDynamite(d));
        this.pickups.forEach((p) => p.c.destroy());
        this.coins = []; this.hazards = []; this.bandits = []; this.bullets = [];
        this.weeds = []; this.dynamites = []; this.pickups = [];
    }

    createHazards(count) {
        for (let i = 0; i < count; i++) {
            const [x, y] = HAZARD_POSITIONS[i];
            const cactus = i % 2 === 0;
            const g = this.add.graphics().setDepth(y + 20);
            g.fillStyle(0x000000, 0.22).fillEllipse(x, y + 26, 44, 12);
            if (cactus) {
                g.fillStyle(0x2A5A38, 1);
                g.fillRoundedRect(x - 9, y - 28, 18, 56, 8).fillRoundedRect(x - 24, y - 12, 16, 8, 4).fillRoundedRect(x - 24, y - 24, 8, 20, 4);
                g.fillRoundedRect(x + 8, y - 4, 16, 8, 4).fillRoundedRect(x + 16, y - 18, 8, 20, 4);
                g.fillStyle(0x3F8A52, 1).fillRoundedRect(x - 6, y - 25, 7, 50, 3);
                g.fillStyle(0xE8D6A0, 1);
                for (let k = 0; k < 4; k++) g.fillRect(x - 12, y - 18 + k * 12, 3, 1.5).fillRect(x + 9, y - 14 + k * 12, 3, 1.5);
            } else {
                g.fillStyle(0x6E6760, 1).fillEllipse(x, y + 4, 50, 34);
                g.fillStyle(0x8A837B, 1).fillEllipse(x - 4, y - 2, 38, 24);
                g.fillStyle(0xB0A99F, 0.7).fillEllipse(x - 9, y - 7, 14, 7);
                g.lineStyle(2, 0x4A443E, 1).strokeEllipse(x, y + 4, 50, 34);
            }
            this.hazards.push({ x, y, radius: cactus ? 22 : 24, graphic: g, cactus });
        }
    }

    randomFreePos(minPlayer = 100) {
        let x, y;
        for (let i = 0; i < 50; i++) {
            x = Phaser.Math.Between(90, 910); y = Phaser.Math.Between(195, 505);
            const nearH = this.hazards.some((h) => Phaser.Math.Distance.Between(x, y, h.x, h.y) < 62);
            const nearP = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < minPlayer;
            if (!nearH && !nearP) break;
        }
        return { x, y };
    }

    createCoins(count) {
        for (let i = 0; i < count; i++) {
            const { x, y } = this.randomFreePos(75);
            const golden = i === 0 && this.wave >= 2;
            const r = golden ? 15 : 12;
            const c = this.add.container(x, y).setDepth(y);
            c.add([
                this.add.ellipse(0, r + 4, r * 2, 6, 0x000000, 0.2),
                this.add.circle(0, 0, r, golden ? 0xFFF08A : 0xFFD447).setStrokeStyle(3, golden ? 0xD98E00 : 0xA76C16),
                this.add.circle(0, 0, r - 5, 0x000000, 0).setStrokeStyle(2, golden ? 0xE0A800 : 0xD69A22),
                this.add.circle(-3, -4, 2.6, 0xFFF9D6)
            ]);
            this.tweens.add({ targets: c, scaleX: 0.25, duration: 520 + Math.random() * 200, yoyo: true, repeat: -1, delay: Math.random() * 500, ease: 'Sine.easeInOut' });
            if (golden) this.tweens.add({ targets: c, y: y - 5, duration: 500, yoyo: true, repeat: -1 });
            this.coins.push({ x, y, c, golden, value: golden ? 50 : 10, collected: false });
        }
    }

    spawnBandits() {
        const count = Math.min(4, 1 + Math.floor(this.wave / 2));
        const sides = Phaser.Utils.Array.Shuffle(['R', 'L', 'T', 'B']).slice(0, count);
        sides.forEach((side, i) => {
            const x = side === 'R' ? this.arena.right - 24 : side === 'L' ? this.arena.left + 24 : Phaser.Math.Between(150, 850);
            const y = side === 'T' ? 178 : side === 'B' ? 512 : Phaser.Math.Between(210, 490);
            const b = new Bandit(this, x, y, i);
            b.side = side;
            b.axis = Math.random() < 0.5 ? 1 : -1;
            b.speed = 42 + this.wave * 4;
            b.nextShot = this.activeAt + Phaser.Math.Between(900, 2200) + i * 500;
            b.place(x, y);
            b.setDepth(y + BANDIT_FOOT);
            b.aim(Math.atan2(this.player.y - y, this.player.x - x));
            b.visual.setAlpha(0);
            this.tweens.add({ targets: b.visual, alpha: 1, duration: 600, delay: 300 });
            this.bandits.push(b);
        });
    }

    // =====================================================  UPDATE
    update(time, delta) {
        if (this.gameOver || this.isPaused) return;
        const dt = Math.min(delta, 50) / 1000;
        this.gt += dt * 1000;

        this.remainingTime -= dt;
        if (this.remainingTime <= 0) {
            this.remainingTime = 0;
            this.updateHUD();
            this.endGame('TIME IS UP!');
            return;
        }

        this.handleMovement(dt);
        this.updateJump();
        this.updateCoins(dt);
        this.updateBandits(dt);
        this.updateBullets(dt);
        this.updateWeeds(dt);
        this.updateDynamite();
        this.updatePickups();
        this.updateSpawners();
        this.updateEffects();
        this.updateHUD();
    }

    handleMovement(dt) {
        const k = this.keys, t = this.touchInput;
        const dx = (k.D.isDown || k.RIGHT.isDown || t.right ? 1 : 0) - (k.A.isDown || k.LEFT.isDown || t.left ? 1 : 0);
        const dy = (k.S.isDown || k.DOWN.isDown || t.down ? 1 : 0) - (k.W.isDown || k.UP.isDown || t.up ? 1 : 0);
        const len = Math.hypot(dx, dy) || 1;
        const speed = this.playerSpeed * (this.fx.boost > this.gt ? 1.5 : 1);
        const p = this.player;

        const nx = Phaser.Math.Clamp(p.x + (dx / len) * speed * dt, this.arena.left + 20, this.arena.right - 20);
        const ny = Phaser.Math.Clamp(p.y + (dy / len) * speed * dt, this.arena.top + 20, this.arena.bottom - 20);
        p.setPosition(nx, ny, this.lift);
        p.setFacing(dx);
        p.animate(this.time.now, dx !== 0 || dy !== 0, this.isJumping);
        p.setDepth(ny + FOOT);

        if (this.fx.boost > this.gt && (dx || dy) && Math.random() < 0.35) this.burst(nx, ny + FOOT, 0xE9C58A, 1, 14);

        const jump = Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || this.touchJumpJustPressed;
        this.touchJumpJustPressed = false;
        if (jump && !this.isJumping) {
            this.isJumping = true;
            this.jumpStartedAt = this.gt;
            audio.sfx('jump');
        }

        // kedip saat kebal
        p.setAlpha(this.gt < this.invulnerableUntil && this.fx.shield < this.gt ? (Math.floor(this.gt / 100) % 2 ? 1 : 0.4) : 1);
    }

    updateJump() {
        if (!this.isJumping) { this.lift = 0; return; }
        const prog = (this.gt - this.jumpStartedAt) / this.jumpDuration;
        if (prog >= 1) {
            this.isJumping = false;
            this.lift = 0;
            this.player.setPosition(this.player.x, this.player.y, 0);
            this.burst(this.player.x, this.player.y + FOOT, 0xE9C58A, 5, 24);
            audio.sfx('land');
            return;
        }
        this.lift = Math.sin(prog * Math.PI) * this.jumpHeight;
        this.player.setPosition(this.player.x, this.player.y, this.lift);
        this.player.animate(this.time.now, false, true);
    }

    // ---------- koin
    updateCoins(dt) {
        const p = this.player;
        const magnet = this.fx.magnet > this.gt;
        for (const it of this.coins) {
            if (it.collected) continue;
            if (magnet) {
                const d = Phaser.Math.Distance.Between(it.x, it.y, p.x, p.y);
                if (d < 190 && d > 1) {
                    it.x += ((p.x - it.x) / d) * 300 * dt;
                    it.y += ((p.y - it.y) / d) * 300 * dt;
                    it.c.setPosition(it.x, it.y).setDepth(it.y);
                }
            }
            if (Phaser.Math.Distance.Between(p.x, p.y, it.x, it.y) < (it.golden ? 31 : 27)) {
                this.collectCoin(it);
                if (this.coinsCollected >= this.coinsPerWave) { this.completeWave(); return; }
            }
        }
    }

    collectCoin(it) {
        it.collected = true;
        this.tweens.killTweensOf(it.c);
        it.c.destroy();
        this.combo = this.gt - this.lastCoinAt <= 2000 ? this.combo + 1 : 1;
        this.lastCoinAt = this.gt;
        const mult = this.comboMult();
        const pts = it.value * mult;
        this.score += pts;
        this.coinsCollected++;
        this.totalCoins++;
        audio.sfx(it.golden ? 'gold' : 'coin');
        this.burst(it.x, it.y, 0xFFE27A, it.golden ? 10 : 5, 30);
        this.pop(it.x, it.y - 18, mult > 1 ? `+${pts}  x${mult}` : `+${pts}`, it.golden ? '#FFF08A' : '#FFD76A', it.golden ? 22 : 16);
    }

    completeWave() {
        const bonus = 100 * this.wave;
        this.score += bonus;
        this.pop(500, 230, `WAVE CLEAR!  +${bonus}`, '#9BE59B', 28);
        this.wave++;
        this.startWave();
    }

    // ---------- bandit
    updateBandits(dt) {
        const p = this.player;
        this.aimGfx.clear();
        for (const b of this.bandits) {
            // patroli di sisi arena
            if (b.state !== 'aim') {
                const step = b.axis * b.speed * dt;
                if (b.side === 'L' || b.side === 'R') {
                    b.y += step;
                    if (b.y < 200 || b.y > 500) { b.axis *= -1; b.y = Phaser.Math.Clamp(b.y, 200, 500); }
                } else {
                    b.x += step;
                    if (b.x < 110 || b.x > 890) { b.axis *= -1; b.x = Phaser.Math.Clamp(b.x, 110, 890); }
                }
                b.place(b.x, b.y);
                b.setDepth(b.y + BANDIT_FOOT);
            }
            const toPlayer = Math.atan2(p.y - (b.y - 8), p.x - b.x);

            if (this.gt < this.activeAt) { b.aim(toPlayer); continue; }

            if (b.state === 'patrol') {
                b.aim(toPlayer);
                if (this.gt >= b.nextShot) {
                    b.state = 'aim';
                    b.stateT = this.gt;
                    b.aimTime = Math.max(480, 880 - this.wave * 35);
                    b.showAlert(true);
                    audio.sfx('warn');
                }
            } else if (b.state === 'aim') {
                const el = this.gt - b.stateT;
                if (b.aimTime - el > 220) b.aim(toPlayer);
                const m = b.muzzle();
                const a = 0.25 + 0.35 * (el / b.aimTime);
                this.aimGfx.lineStyle(2, 0xFF3B2F, a).lineBetween(m.x, m.y, m.x + Math.cos(b.angle) * 900, m.y + Math.sin(b.angle) * 900);
                if (el >= b.aimTime) {
                    this.fireBullet(b);
                    b.state = 'cool';
                    b.stateT = this.gt;
                    b.showAlert(false);
                }
            } else if (b.state === 'cool' && this.gt - b.stateT > 350) {
                b.state = 'patrol';
                b.nextShot = this.gt + Phaser.Math.Between(1400, 2600) * Math.max(0.55, 1 - this.wave * 0.05);
            }
        }
    }

    fireBullet(b) {
        const m = b.muzzle();
        const speed = 300 + Math.min(this.wave * 8, 90);
        const g = this.add.container(m.x, m.y).setDepth(710).setRotation(b.angle);
        g.add([
            this.add.circle(0, 0, 8, 0xFFB347, 0.35),
            this.add.rectangle(-12, 0, 18, 3, 0xFFB347, 0.55),
            this.add.ellipse(0, 0, 15, 5, 0xFFE08A)
        ]);
        this.bullets.push({ x: m.x, y: m.y, vx: Math.cos(b.angle) * speed, vy: Math.sin(b.angle) * speed, g });
        const f = this.add.circle(m.x, m.y, 11, 0xFFF2A8, 0.95).setDepth(720);
        this.tweens.add({ targets: f, scale: 2, alpha: 0, duration: 130, onComplete: () => f.destroy() });
        b.recoil();
        audio.sfx('shoot');
    }

    updateBullets(dt) {
        const p = this.player;
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.g.setPosition(b.x, b.y);
            let dead = b.x < 15 || b.x > 985 || b.y < 95 || b.y > 585;

            if (!dead) {
                for (const h of this.hazards) {
                    if (Phaser.Math.Distance.Between(b.x, b.y, h.x, h.y) < h.radius - 2) {
                        this.burst(b.x, b.y, h.cactus ? 0x7CC98A : 0xBBB4AA, 4, 20);
                        dead = true;
                        break;
                    }
                }
            }
            if (!dead && this.lift <= 30 && Phaser.Math.Distance.Between(b.x, b.y, p.x, p.y) < 17) {
                this.burst(b.x, b.y, 0xFFB347, 6, 26);
                this.hurtPlayer();
                dead = true;
            }
            if (dead) { b.g.destroy(); this.bullets.splice(i, 1); if (this.gameOver) return; }
        }
    }

    // ---------- tumbleweed
    spawnWeed() {
        const fromLeft = Math.random() < 0.5;
        const y = Phaser.Math.Between(205, 500);
        const x = fromLeft ? this.arena.left - 30 : this.arena.right + 30;
        const g = this.add.container(x, y);
        const gr = this.add.graphics();
        gr.lineStyle(2.5, 0x6B4226, 1);
        for (let i = 0; i < 6; i++) gr.strokeEllipse(0, 0, 30, 8 + i * 5);
        gr.strokeCircle(0, 0, 17);
        g.add(gr);
        const sh = this.add.ellipse(x, y + 22, 30, 9, 0x3a2310, 0.3).setDepth(y);
        this.weeds.push({ x, baseY: y, y, vx: (fromLeft ? 1 : -1) * Phaser.Math.Between(150, 225), ph: Math.random() * 6, g, sh });
    }

    updateWeeds(dt) {
        const p = this.player;
        for (let i = this.weeds.length - 1; i >= 0; i--) {
            const w = this.weeds[i];
            w.x += w.vx * dt;
            w.y = w.baseY + Math.sin(this.gt / 280 + w.ph) * 18;
            w.g.setPosition(w.x, w.y).setDepth(w.y + 20).rotation += (w.vx * dt) / 17;
            w.sh.setPosition(w.x, w.baseY + 24);
            if (this.lift <= 30 && Phaser.Math.Distance.Between(w.x, w.y, p.x, p.y) < 24) {
                this.burst(w.x, w.y, 0x8B5A2B, 6, 28);
                w.g.destroy(); w.sh.destroy(); this.weeds.splice(i, 1);
                this.hurtPlayer();
                if (this.gameOver) return;
                continue;
            }
            if ((w.vx > 0 && w.x > this.arena.right + 50) || (w.vx < 0 && w.x < this.arena.left - 50)) {
                w.g.destroy(); w.sh.destroy(); this.weeds.splice(i, 1);
            }
        }
    }

    // ---------- dynamite
    spawnDynamite() {
        let x, y;
        for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2, r = Phaser.Math.Between(40, 170);
            x = Phaser.Math.Clamp(this.player.x + Math.cos(a) * r, 95, 905);
            y = Phaser.Math.Clamp(this.player.y + Math.sin(a) * r, 200, 500);
            if (!this.hazards.some((h) => Phaser.Math.Distance.Between(x, y, h.x, h.y) < 48)) break;
        }
        const fuse = Math.max(1100, 1700 - this.wave * 40);
        const warn = this.add.circle(x, y + 10, 66, 0xFF3B2F, 0.14).setStrokeStyle(3, 0xFF3B2F, 0.8).setDepth(1);
        const tw = this.tweens.add({ targets: warn, alpha: 0.5, scale: 0.94, duration: 260, yoyo: true, repeat: -1 });
        const c = this.add.container(x, y).setDepth(y + 20);
        const stick = this.add.graphics();
        stick.fillStyle(0xC0392B, 1).fillRoundedRect(-6, -4, 12, 30, 3).fillRect(-6, 8, 12, 5);
        stick.fillStyle(0xFFFFFF, 0.2).fillRect(-5, -3, 3, 28);
        stick.lineStyle(2, 0x3a2a20, 1).lineBetween(0, -4, 3, -14);
        const spark = this.add.circle(3, -16, 4, 0xFFC93C);
        c.add([stick, spark]);
        this.tweens.add({ targets: spark, scale: 1.8, alpha: 0.5, duration: 110, yoyo: true, repeat: -1 });
        this.dynamites.push({ x, y, warn, tw, c, explodeAt: this.gt + fuse });
        audio.sfx('fuse');
    }

    destroyDynamite(d) {
        if (d.tw) d.tw.remove();
        d.warn.destroy();
        d.c.destroy();
    }

    updateDynamite() {
        for (let i = this.dynamites.length - 1; i >= 0; i--) {
            const d = this.dynamites[i];
            if (this.gt < d.explodeAt) continue;
            this.dynamites.splice(i, 1);
            this.destroyDynamite(d);
            this.explode(d.x, d.y);
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, d.x, d.y) < 68) {
                this.hurtPlayer();
                if (this.gameOver) return;
            }
        }
    }

    explode(x, y) {
        const a = this.add.circle(x, y, 22, 0xFF8A1F, 0.95).setDepth(750);
        const b = this.add.circle(x, y, 12, 0xFFF0A0, 1).setDepth(751);
        this.tweens.add({ targets: a, scale: 3.4, alpha: 0, duration: 480, onComplete: () => a.destroy() });
        this.tweens.add({ targets: b, scale: 3, alpha: 0, duration: 330, onComplete: () => b.destroy() });
        const scorch = this.add.ellipse(x, y + 8, 90, 38, 0x2a1a10, 0.35).setDepth(0.8);
        this.tweens.add({ targets: scorch, alpha: 0, duration: 4000, onComplete: () => scorch.destroy() });
        this.burst(x, y, 0x5a3a22, 10, 70);
        this.cameras.main.shake(230, 0.012);
        audio.sfx('boom');
    }

    // ---------- power-up
    spawnPickup() {
        const pool = ['shield', 'boost', 'magnet', 'clock'];
        if (this.lives < CAP_LIVES) pool.push('heart', 'heart');
        const type = Phaser.Utils.Array.GetRandom(pool);
        const def = PICKUPS[type];
        const { x, y } = this.randomFreePos(120);
        const c = this.add.container(x, y).setDepth(y + 10);
        c.add([
            this.add.ellipse(0, 22, 30, 9, 0x000000, 0.25),
            this.add.circle(0, 0, 21, def.color, 0.35),
            this.add.circle(0, 0, 16, def.color).setStrokeStyle(3, 0xFFFFFF),
            this.add.text(0, -1, def.glyph, { fontFamily: 'Arial', fontSize: def.glyph.length > 2 ? '12px' : '20px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)
        ]);
        this.tweens.add({ targets: c, y: y - 6, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.pickups.push({ x, y, type, c, born: this.gt });
        this.burst(x, y, def.color, 6, 30);
    }

    updatePickups() {
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const it = this.pickups[i];
            const age = this.gt - it.born;
            if (age > 9000) { it.c.destroy(); this.pickups.splice(i, 1); continue; }
            if (age > 6500) it.c.setAlpha(Math.floor(this.gt / 140) % 2 ? 1 : 0.25);
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y) < 30) {
                this.applyPickup(it.type, it.x, it.y);
                it.c.destroy();
                this.pickups.splice(i, 1);
            }
        }
    }

    applyPickup(type, x, y) {
        const def = PICKUPS[type];
        if (type === 'shield' || type === 'boost' || type === 'magnet') this.fx[type] = this.gt + FX_TIME;
        if (type === 'heart') { this.lives = Math.min(CAP_LIVES, this.lives + 1); this.drawHearts(); }
        if (type === 'clock') this.remainingTime += 10;
        audio.sfx('power');
        this.burst(x, y, def.color, 10, 40);
        this.pop(x, y - 30, def.label, '#FFFFFF', 18);
    }

    updateSpawners() {
        if (this.gt < this.activeAt) return;
        if (this.wave >= 2 && this.gt >= this.weedTimer && this.weeds.length < 3) {
            this.spawnWeed();
            this.weedTimer = this.gt + Math.max(2200, 5200 - this.wave * 250);
        }
        if (this.wave >= 3 && this.gt >= this.dynTimer && this.dynamites.length < (this.wave >= 6 ? 2 : 1)) {
            this.spawnDynamite();
            this.dynTimer = this.gt + Math.max(3800, 8000 - this.wave * 400);
        }
        if (this.gt >= this.pickupTimer && this.pickups.length < 1) {
            this.spawnPickup();
            this.pickupTimer = this.gt + Phaser.Math.Between(11000, 16000);
        }
    }

    updateEffects() {
        const on = this.fx.shield > this.gt;
        this.shieldBubble.setVisible(on);
        if (on) {
            this.shieldBubble.setPosition(this.player.x, this.player.y - this.lift + 4)
                .setDepth(this.player.y + FOOT + 1)
                .setAlpha(this.fx.shield - this.gt < 1500 ? (Math.floor(this.gt / 120) % 2 ? 0.9 : 0.3) : 0.85)
                .setScale(1 + Math.sin(this.gt / 180) * 0.04);
        }
    }

    // =====================================================  DAMAGE & FX
    hurtPlayer() {
        if (this.gt < this.invulnerableUntil) return false;
        if (this.fx.shield > this.gt) {
            this.invulnerableUntil = this.gt + 450;
            this.burst(this.player.x, this.player.y, 0x9FD8FF, 8, 40);
            audio.sfx('land');
            return false;
        }
        this.lives--;
        this.invulnerableUntil = this.gt + 1400;
        this.combo = 0;
        audio.sfx('hit');
        this.cameras.main.shake(190, 0.008);
        this.flash.setAlpha(0.35);
        this.tweens.add({ targets: this.flash, alpha: 0, duration: 380 });
        this.pop(this.player.x, this.player.y - 50, '-1 ♥', '#FF6B6B', 24);
        this.drawHearts();
        if (this.lives <= 0) this.endGame('OUT OF LIVES!');
        return true;
    }

    burst(x, y, color, n = 6, spread = 36) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, d = spread * (0.4 + Math.random() * 0.6);
            const c = this.add.circle(x, y, Phaser.Math.Between(2, 4), color, 0.95).setDepth(760);
            this.tweens.add({
                targets: c, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 6, alpha: 0, scale: 0.3,
                duration: Phaser.Math.Between(300, 520), onComplete: () => c.destroy()
            });
        }
    }

    pop(x, y, str, color = '#FFD76A', size = 18) {
        const t = text(this, x, y, str, size, color, { stroke: '#3a1f12', strokeThickness: 4 }).setDepth(950);
        this.tweens.add({ targets: t, y: y - 42, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
    }

    // =====================================================  GAME OVER
    endGame(reason) {
        if (this.gameOver) return;
        this.gameOver = true;
        this.player.setAlpha(1);
        this.aimGfx.clear();
        this.shieldBubble.setVisible(false);
        audio.play(null);
        audio.sfx('gameover');

        this.add.rectangle(500, 300, 6000, 4000, 0x1A120D, 0.84).setDepth(2000);
        const g = this.add.graphics().setDepth(2001);
        plank(this, g, 300, 70, 400, 470, { color: 0x5a2f1b });
        text(this, 500, 125, 'GAME OVER', 42, '#FFD76A', { stroke: '#3a1f12', strokeThickness: 7 }).setDepth(2002);
        text(this, 500, 172, reason, 17, '#FFFFFF', { body: true }).setDepth(2002);
        text(this, 500, 252, `PLAYER   ${this.playerName}\nSCORE    ${this.score}\nWAVE     ${this.wave}\nCOINS    ${this.totalCoins}`, 18, '#F5D9A2', {
            body: true, align: 'left', ox: 0.5, style: { lineSpacing: 10 }
        }).setDepth(2002);
        const rankText = text(this, 500, 340, 'SAVING SCORE...', 16, '#FFE9A8', { body: true }).setDepth(2002);

        woodButton(this, 500, 395, 250, 50, 'RETRY', () => this.scene.restart(), { size: 22, color: COL.red }).setDepth(2003);
        const lbBtn = woodButton(this, 500, 453, 250, 44, 'LEADERBOARD', () => openLeaderboard(this.lastEntry), { size: 16 }).setDepth(2003);
        woodButton(this, 500, 503, 250, 38, 'MAIN MENU', () => fadeTo(this, 'MainMenu'), { size: 15 }).setDepth(2003);
        lbBtn.setAlpha(0.6);

        Leaderboard.submit({
            name: this.playerName, score: this.score, wave: this.wave, coins: this.totalCoins, character: this.characterName
        }).then((res) => {
            this.lastEntry = res.entry;
            if (!rankText.scene) return;
            rankText.setText(res.rank === 1 ? '★ NEW TOP BOUNTY! ★' : `YOUR RANK: #${res.rank}${res.source === 'online' ? '' : '  (offline)'}`);
            rankText.setColor(res.rank === 1 ? '#FFD76A' : '#FFE9A8');
            lbBtn.setAlpha(1);
            if (res.rank === 1) this.tweens.add({ targets: rankText, scale: 1.15, duration: 400, yoyo: true, repeat: 3 });
        });
    }
}
