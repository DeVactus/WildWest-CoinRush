import Phaser from 'phaser';
import './style.css';

import MainMenu from './scenes/MainMenu.js';
import CharacterSelect from './scenes/CharacterSelect.js';
import PlayerSetup from './scenes/PlayerSetup.js';
import GameScene from './scenes/GameScene.js';

// Tunggu font western (Rye) siap supaya teks di canvas tidak pakai font cadangan
async function waitFonts() {
    if (!document.fonts || !document.fonts.load) return;
    try {
        await Promise.race([
            Promise.all([document.fonts.load('32px Rye'), document.fonts.load('16px "Special Elite"')]),
            new Promise((r) => setTimeout(r, 1800))
        ]);
    } catch { /* pakai font cadangan */ }
}

const config = {
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: '#1a0f0a',
    // RESIZE: canvas selalu memenuhi seluruh jendela; tiap scene memakai fitCamera() (lihat ui/Theme.js)
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    input: { activePointers: 4 },
    scene: [MainMenu, CharacterSelect, PlayerSetup, GameScene]
};

waitFonts().then(() => { window.__game = new Phaser.Game(config); });
