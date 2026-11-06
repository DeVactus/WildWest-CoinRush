import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { audio } from '../systems/AudioManager.js';
import { COL, fitCamera, designToScreen, desertBackdrop, addVignette, plank, text, woodButton, fadeIn, fadeTo, soundButton } from '../ui/Theme.js';

export default class PlayerSetup extends Phaser.Scene {
    constructor() { super({ key: 'PlayerSetup' }); }

    create() {
        fitCamera(this);
        fadeIn(this);
        desertBackdrop(this, { town: false });
        addVignette(this, 800, 0.4);
        soundButton(this, 962, 36);

        text(this, 500, 105, 'ONE LAST THING...', 44, '#FFD76A', { stroke: '#3a1f12', strokeThickness: 7 });
        text(this, 500, 165, 'What should we call you, cowboy?', 17, '#FFF1C2', { body: true, stroke: '#3a1f12', strokeThickness: 3 });

        const g = this.add.graphics().setDepth(5);
        plank(this, g, -0, 0, 0, 0);
        g.clear();
        plank(this, g, 285, 205, 430, 80, { color: 0x6B3A22 });
        g.fillStyle(0xFFF1C2, 1).fillRoundedRect(305, 222, 390, 46, 6);
        g.lineStyle(2, 0x542719, 1).strokeRoundedRect(305, 222, 390, 46, 6);

        // input HTML biasa, posisinya mengikuti ukuran canvas (anti geser saat di-scale)
        const node = document.createElement('input');
        node.type = 'text';
        node.placeholder = 'Enter your name...';
        node.maxLength = CONFIG.MAX_NAME;
        node.autocomplete = 'off';
        node.spellcheck = false;
        Object.assign(node.style, {
            position: 'absolute', boxSizing: 'border-box', pointerEvents: 'auto', textAlign: 'center',
            fontFamily: "'Special Elite', Georgia, serif", color: '#542719', background: 'transparent',
            border: 'none', outline: 'none', padding: '0', margin: '0'
        });
        document.getElementById('ui-root').appendChild(node);
        this.nameInput = { node };
        try { node.value = localStorage.getItem('coinrush.name') || this.registry.get('playerName') || ''; } catch { /* ignore */ }

        const place = () => {
            const tl = designToScreen(this, 305, 222);
            Object.assign(node.style, {
                left: `${tl.x}px`, top: `${tl.y}px`,
                width: `${390 * tl.k}px`, height: `${46 * tl.k}px`, fontSize: `${22 * tl.k}px`
            });
        };
        place();
        window.addEventListener('resize', place);
        this.scale.on('resize', place);

        this.errorText = text(this, 500, 312, '', 15, '#FFB3A8', { body: true, stroke: '#3a1f12', strokeThickness: 3 }).setDepth(6);

        woodButton(this, 500, 400, 280, 62, 'START GAME', () => this.startGame(), { size: 26, color: COL.red }).setDepth(6);
        woodButton(this, 110, 548, 150, 40, '← BACK', () => fadeTo(this, 'CharacterSelect'), { size: 15 }).setDepth(6);

        this.onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); this.startGame(); } };
        node.addEventListener('keydown', this.onKey);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener('resize', place);
            this.scale.off('resize', place);
            node.remove();
        });
        this.time.delayedCall(350, () => node.focus());
    }

    startGame() {
        if (this._leaving) return;
        const name = this.nameInput.node.value.trim();
        if (name.length < CONFIG.MIN_NAME) {
            this.errorText.setText(`Name must be at least ${CONFIG.MIN_NAME} characters!`);
            this.tweens.add({ targets: this.errorText, x: 508, duration: 40, yoyo: true, repeat: 3 });
            audio.sfx('warn');
            this.nameInput.node.focus();
            return;
        }
        this.registry.set('playerName', name);
        try { localStorage.setItem('coinrush.name', name); } catch { /* ignore */ }
        audio.sfx('power');
        fadeTo(this, 'GameScene');
    }
}
