/**
 * Solari Split-Flap Display Engine
 * Recreates authentic mechanical split-flap drum mechanics and 3D folding animations.
 */

const FLAP_CHARS = [
    ' ', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '-', '.', ':', '/', "'", '(', ')', '+', '&', 'Ä', 'Ö', 'Ü'
];

class SplitFlapTile {
    constructor(container, initialChar = ' ') {
        this.container = container;
        this.currentChar = this.cleanChar(initialChar);
        this.targetChar = this.currentChar;
        this.isFlipping = false;
        
        this.initDom();
    }

    cleanChar(char) {
        if (!char) return ' ';
        const upper = char.toString().toUpperCase();
        return FLAP_CHARS.includes(upper) ? upper : ' ';
    }

    initDom() {
        this.el = document.createElement('div');
        this.el.className = 'flap-tile';
        this.el.innerHTML = `
            <div class="flap-half top"><span class="top-char">${this.currentChar}</span></div>
            <div class="flap-half bottom"><span class="bottom-char">${this.currentChar}</span></div>
            <div class="flap-flipper"><span class="flipper-char">${this.currentChar}</span></div>
            <div class="flap-seam"></div>
            <div class="flap-hinge left"></div>
            <div class="flap-hinge right"></div>
        `;
        this.container.appendChild(this.el);

        this.topSpan = this.el.querySelector('.top-char');
        this.bottomSpan = this.el.querySelector('.bottom-char');
        this.flipper = this.el.querySelector('.flap-flipper');
        this.flipperSpan = this.el.querySelector('.flipper-char');
    }

    setChar(char, delayMs = 0) {
        const target = this.cleanChar(char);
        if (target === this.currentChar && !this.isFlipping) {
            return;
        }

        this.targetChar = target;
        if (delayMs > 0) {
            setTimeout(() => this.startFlip(), delayMs);
        } else {
            this.startFlip();
        }
    }

    startFlip() {
        if (this.isFlipping) return;
        this.isFlipping = true;

        // Choose 2 to 3 mechanical flutter characters before settling on the target
        const flutters = [];
        if (this.currentChar !== this.targetChar) {
            flutters.push(FLAP_CHARS[Math.floor(Math.random() * (FLAP_CHARS.length - 1)) + 1]);
            flutters.push(FLAP_CHARS[Math.floor(Math.random() * (FLAP_CHARS.length - 1)) + 1]);
        }
        flutters.push(this.targetChar);

        let step = 0;
        const stepNext = () => {
            if (step >= flutters.length) {
                this.currentChar = this.targetChar;
                this.topSpan.textContent = this.targetChar;
                this.bottomSpan.textContent = this.targetChar;
                this.flipper.classList.remove('flip-anim');
                this.isFlipping = false;
                return;
            }

            const nextChar = flutters[step++];

            if (window.solariAudio) {
                window.solariAudio.playFlap();
            }

            // Prepare flipper with current char folding down
            this.flipperSpan.textContent = this.currentChar;
            this.topSpan.textContent = nextChar;
            this.bottomSpan.textContent = nextChar;

            // Trigger CSS 3D folding animation with forced reflow
            this.flipper.classList.remove('flip-anim');
            void this.flipper.offsetWidth;
            this.flipper.classList.add('flip-anim');

            this.currentChar = nextChar;
            setTimeout(stepNext, 50);
        };

        stepNext();
    }
}

class SplitFlapRow {
    constructor(container, length = 51) {
        this.container = container;
        this.length = length;
        this.tiles = [];
        this.initDom();
    }

    initDom() {
        this.el = document.createElement('div');
        this.el.className = 'solari-row';
        this.container.appendChild(this.el);

        for (let i = 0; i < this.length; i++) {
            this.tiles.push(new SplitFlapTile(this.el, ' '));
        }
    }

    setText(text, staggerBaseMs = 0) {
        const padded = (text || '').padEnd(this.length, ' ').slice(0, this.length);
        for (let i = 0; i < this.length; i++) {
            const char = padded[i];
            const staggerDelay = staggerBaseMs + (i * 18) + (Math.random() * 20);
            this.tiles[i].setChar(char, staggerDelay);
        }
    }
}

class SplitFlapBoard {
    constructor(containerId, rowCount = 8, colCount = 51) {
        this.container = document.getElementById(containerId);
        this.rowCount = rowCount;
        this.colCount = colCount;
        this.rows = [];
        this.initBoard();
    }

    initBoard() {
        this.container.innerHTML = '';
        for (let r = 0; r < this.rowCount; r++) {
            this.rows.push(new SplitFlapRow(this.container, this.colCount));
        }
    }

    updateRows(rowStrings) {
        if (window.solariAudio) {
            window.solariAudio.onBoardUpdate();
        }
        for (let r = 0; r < this.rowCount; r++) {
            const text = rowStrings[r] || '';
            const rowStagger = r * 75;
            this.rows[r].setText(text, rowStagger);
        }
    }
}

window.SplitFlapBoard = SplitFlapBoard;
