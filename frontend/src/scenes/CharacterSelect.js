import Phaser from 'phaser';
import Player from '../objects/Player.js';
import { audio } from '../systems/AudioManager.js';
import { COL, fitCamera, desertBackdrop, addVignette, plank, text, woodButton, fadeIn, fadeTo, soundButton } from '../ui/Theme.js';

const CHARACTERS = [
    { id: 'JACK MORGAN', name: 'JACK MORGAN', description: 'The Desert Wanderer', skin: 0xD99A65, shirt: 0xC47A38, hair: 0x38251D, gender: 'male' },
    { id: 'CALEB REED', name: 'CALEB REED', description: 'The Lone Outlaw', skin: 0x8A5A3C, shirt: 0x3976A8, hair: 0x241A17, gender: 'male' },
    { id: 'ANNIE ROSE', name: 'ANNIE ROSE', description: 'The Wild Frontier', skin: 0xE7B58B, shirt: 0xA94E65, hair: 0x2b1e1a, gender: 'female' },
    { id: 'CLARA MAY', name: 'CLARA MAY', description: 'The Golden Rider', skin: 0xE9B88F, shirt: 0xD4A64D, hair: 0xE5C16A, gender: 'female' }
];

export default class CharacterSelect extends Phaser.Scene {
    constructor() { super('CharacterSelect'); this.selectedCharacter = 0; }

    create() {
        fitCamera(this);
        fadeIn(this);
        desertBackdrop(this, { town: false });
        addVignette(this, 800, 0.4);
        soundButton(this, 962, 36);

        text(this, 500, 54, 'CHOOSE YOUR COWBOY', 40, '#FFD76A', { stroke: '#3a1f12', strokeThickness: 7 });
        text(this, 500, 100, '★  WHO\'S RIDING INTO TOWN?  ★', 14, '#FFF1C2', { stroke: '#3a1f12', strokeThickness: 3 });

        this.cards = CHARACTERS.map((ch, i) => this.createCard(ch, i));

        woodButton(this, 500, 520, 300, 52, 'CONFIRM CHARACTER', () => this.confirm(), { size: 18, color: COL.red });
        woodButton(this, 110, 548, 150, 40, '← BACK', () => fadeTo(this, 'MainMenu'), { size: 15 });
        text(this, 500, 574, 'SEMUA KOBOI KUAT NYONG, YANG CUPU MAH YANG MAINNYA!', 11, '#FFF1C2', { stroke: '#3a1f12', strokeThickness: 2 });

        this.input.keyboard.on('keydown-LEFT', () => this.select((this.selectedCharacter + 3) % 4));
        this.input.keyboard.on('keydown-RIGHT', () => this.select((this.selectedCharacter + 1) % 4));
        this.input.keyboard.on('keydown-A', () => this.select((this.selectedCharacter + 3) % 4));
        this.input.keyboard.on('keydown-D', () => this.select((this.selectedCharacter + 1) % 4));
        this.input.keyboard.on('keydown-ENTER', () => this.confirm());

        const prev = this.registry.get('selectedCharacter');
        const idx = prev ? Math.max(0, CHARACTERS.findIndex((c) => c.id === prev.id)) : 0;
        this.select(idx, true);
    }

    createCard(ch, i) {
        const x = 140 + i * 240;
        const card = this.add.container(x, 295).setDepth(10);
        const g = this.add.graphics();
        // kertas wanted poster
        g.fillStyle(0x000000, 0.3).fillRoundedRect(-98, -128, 206, 296, 6);
        g.fillStyle(0xF3DBA5, 1).fillRoundedRect(-103, -135, 206, 296, 6);
        g.fillStyle(0xE3C07E, 1).fillRect(-103, 112, 206, 49);
        g.lineStyle(3, 0x75412D, 1).strokeRoundedRect(-103, -135, 206, 296, 6);
        g.lineStyle(1.5, 0x75412D, 0.6).strokeRect(-93, -125, 186, 276);
        g.fillStyle(0x75412D, 1).fillCircle(0, -135, 5);

        const title = text(this, 0, -105, 'WANTED', 22, '#75412D');
        const frame = this.add.rectangle(0, -10, 150, 140, 0xDDAA6A).setStrokeStyle(2, 0x75412D);
        const preview = new Player(this, 0, 0, ch, { shadow: false });
        preview.setScale(1.7);
        preview.visual.setPosition(0, 0);
        const name = text(this, 0, 100, ch.name, 16, '#542719');
        const desc = text(this, 0, 128, ch.description, 12, '#75412D', { body: true });
        const reward = text(this, 0, 146, '$ 10,000 REWARD', 10, '#A83C32', { body: true });

        const hit = this.add.rectangle(0, 10, 206, 296, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => { audio.unlock(); audio.sfx('click'); this.select(i); });
        hit.on('pointerover', () => { if (this.selectedCharacter !== i) this.tweens.add({ targets: card, y: 287, duration: 120 }); });
        hit.on('pointerout', () => { if (this.selectedCharacter !== i) this.tweens.add({ targets: card, y: 295, duration: 120 }); });

        const glow = this.add.rectangle(0, 10, 222, 312, 0x7CD37C, 0).setStrokeStyle(0, 0x326B42);
        card.add([glow, g, title, frame, preview.visual, name, desc, reward, hit]);
        return { card, preview, glow };
    }

    select(index, silent = false) {
        this.selectedCharacter = index;
        if (!silent) audio.sfx('click');
        this.cards.forEach((c, i) => {
            const on = i === index;
            this.tweens.killTweensOf(c.card);
            this.tweens.add({ targets: c.card, scale: on ? 1.07 : 0.96, y: 295, duration: 180, ease: 'Back.easeOut' });
            c.glow.setStrokeStyle(on ? 6 : 0, 0x3E9B54).setFillStyle(0x7CD37C, on ? 0.18 : 0);
            c.card.setAlpha(on ? 1 : 0.82);
            this.tweens.killTweensOf(c.preview.visual);
            c.preview.visual.y = 0;
            if (on) this.tweens.add({ targets: c.preview.visual, y: -7, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
    }

    confirm() {
        if (this._leaving) return;
        const s = CHARACTERS[this.selectedCharacter];
        this.registry.set('selectedCharacter', { ...s });
        audio.sfx('power');
        fadeTo(this, 'PlayerSetup');
    }
}
