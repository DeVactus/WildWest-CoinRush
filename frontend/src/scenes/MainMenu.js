import Phaser from 'phaser';
import Player from '../objects/Player.js';
import { audio } from '../systems/AudioManager.js';
import { Leaderboard } from '../systems/LeaderboardService.js';
import { openCredits, openLeaderboard, openSettings } from '../ui/Modals.js';
import {
    COL, fitCamera, desertBackdrop, addVignette, plank, text, woodButton, fadeIn, fadeTo, soundButton
} from '../ui/Theme.js';

export default class MainMenu extends Phaser.Scene {
    constructor() { super('MainMenu'); }

    create() {
        fitCamera(this);
        fadeIn(this);
        desertBackdrop(this, { extraCactus: true });
        addVignette(this, 800, 0.45);

        this.createTitle();
        this.createHero();
        this.createMenuBoard();
        soundButton(this, 962, 36);

        // hint klik untuk musik (browser butuh interaksi pertama)
        this.hint = text(this, 500, 578, '♪  CLICK ANYWHERE TO START THE MUSIC  ♪', 13, '#FFF1C2', { stroke: '#3a1f12', strokeThickness: 3 }).setDepth(900);
        this.tweens.add({ targets: this.hint, alpha: 0.25, duration: 800, yoyo: true, repeat: -1 });
        this.hint.setVisible(!audio.unlocked);

        this.input.once('pointerdown', () => { audio.unlock(); this.hint.destroy(); });
        if (audio.unlocked) this.hint.destroy();

        audio.play('lobby');
        this.showTopBounty();
    }

    createTitle() {
        const sign = this.add.container(310, 0).setDepth(20);
        const g = this.add.graphics();
        // tali
        g.lineStyle(4, 0x3a1f12, 1).lineBetween(-190, -10, -170, 70).lineBetween(190, -10, 170, 70);
        plank(this, g, -230, 62, 460, 112, { color: COL.wood });
        g.lineStyle(2, 0xE5B06D, 0.5).strokeRoundedRect(-218, 74, 436, 88, 6);
        const title = text(this, 0, 108, 'COIN RUSH', 58, '#FFD76A', { stroke: '#3a1f12', strokeThickness: 8 });
        const sub = text(this, 0, 152, '★  WILD WEST  ★', 17, '#FFF1C2', { stroke: '#3a1f12', strokeThickness: 3 });
        sign.add([g, title, sub]);
        sign.y = -150;
        this.tweens.add({ targets: sign, y: 0, duration: 900, ease: 'Bounce.easeOut' });
        this.time.delayedCall(950, () => {
            sign.setPosition(310, 0);
            this.tweens.add({ targets: sign, angle: 1.4, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
    }

    createHero() {
        const shadow = this.add.ellipse(240, 506, 150, 26, 0x3a2310, 0.4).setDepth(5);
        const hero = new Player(this, 240, 410, this.registry.get('selectedCharacter') || { shirt: 0xC47A38 }, { shadow: false });
        hero.setScale(3.1);
        hero.setDepth(6);
        this.tweens.add({ targets: hero.visual, y: 404, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: shadow, scaleX: 0.92, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.time.addEvent({ delay: 60, loop: true, callback: () => hero.animate(this.time.now, false, false) });

        // tumpukan koin
        const pile = this.add.container(370, 505).setDepth(7);
        for (let i = 0; i < 9; i++) {
            const c = this.add.ellipse(Phaser.Math.Between(-24, 24), -Math.floor(i / 3) * 6 + Phaser.Math.Between(-2, 2), 24, 14, 0xFFD447).setStrokeStyle(2, 0xA76C16);
            pile.add(c);
        }
        const spark = this.add.star(372, 480, 4, 2, 9, 0xFFF4B0).setDepth(8);
        this.tweens.add({ targets: spark, angle: 90, alpha: 0.2, scale: 1.4, duration: 700, yoyo: true, repeat: -1 });
    }

    createMenuBoard() {
        const board = this.add.container(765, 340).setDepth(20);
        const g = this.add.graphics();
        plank(this, g, -165, -175, 330, 350, { color: 0x6B3A22 });
        g.lineStyle(2, 0xE5B06D, 0.45).strokeRoundedRect(-153, -163, 306, 326, 6);
        board.add([g, text(this, 0, -140, 'MAIN MENU', 25, '#FFF1C2', { stroke: '#3a1f12', strokeThickness: 4 })]);

        const items = [
            ['PLAY', () => fadeTo(this, 'CharacterSelect')],
            ['LEADERBOARD', () => openLeaderboard()],
            ['CREDITS', () => openCredits()],
            ['SETTINGS', () => openSettings()]
        ];
        items.forEach(([label, cb], i) => {
            const b = woodButton(this, 0, -78 + i * 64, 248, 52, label, cb, { size: i === 0 ? 24 : 19, color: i === 0 ? COL.red : COL.wood });
            board.add(b);
            b.setAlpha(0).setX(60);
            this.tweens.add({ targets: b, alpha: 1, x: 0, duration: 380, delay: 500 + i * 110, ease: 'Back.easeOut' });
        });
        board.y = 340;
    }

    async showTopBounty() {
        const { entries, source } = await Leaderboard.top(1);
        if (!this.scene.isActive() || !entries.length) return;
        const e = entries[0];
        const t = text(this, 765, 538, `TOP BOUNTY: ${e.name}  ·  ${e.score}`, 14, '#FFE9A8', { stroke: '#3a1f12', strokeThickness: 3 }).setDepth(30);
        t.setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, duration: 500 });
        if (source === 'local') t.setText(t.text + '  (local)');
    }
}
