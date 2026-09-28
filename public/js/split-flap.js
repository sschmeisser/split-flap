/**
 * Solari Split-Flap Display Engine
 * Recreates authentic mechanical split-flap drum mechanics and 3D folding animations.
 */

const FLAP_CHARS = [
    ' ', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '-', '.', ':', '/', "'", '(', ')', '+'
];

class SplitFlapTile {
    constructor(container, initialChar = ' ') {
        this.container = container;
        this.currentChar = this.cleanChar(initialChar);
        this.targetChar = this.currentChar;
        this.isFlipping = false;
        this.stepDelayMs = 60; // Base speed per flap step
        
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
            <div class="flap flap-upper flap-back"><span class="flap-char">${this.currentChar}</span></div>
            <div class="flap flap-lower flap-back"><span class="flap-char">${this.currentChar}</span></div>
            <div class="flap flap-upper flap-front"><span class="flap-char">${this.currentChar}</span></div>
            <div class="flap flap-lower flap-front"><span class="flap-char">${this.currentChar}</span></div>
            <div class="flap-notch-left"></div>
            <div class="flap-notch-right"></div>
            <div class="flap-divider"></div>
        `;
        this.container.appendChild(this.el);

        this.backUpper = this.el.querySelector('.flap-upper.flap-back .flap-char');
        this.backLower = this.el.querySelector('.flap-lower.flap-back .flap-char');
        this.frontUpper = this.el.querySelector('.flap-upper.flap-front');
        this.frontLower = this.el.querySelector('.flap-lower.flap-front');
        this.frontUpperChar = this.frontUpper.querySelector('.flap-char');
        this.frontLowerChar = this.frontLower.querySelector('.flap-char');
    }

    setChar(targetChar, delayMs = 0) {
        this.targetChar = this.cleanChar(targetChar);
        if (this.targetChar === this.currentChar && !this.isFlipping) {
            return;
        }

        if (delayMs > 0) {
            setTimeout(() => this.startFlipping(), delayMs);
        } else {
            this.startFlipping();
        }
    }

    startFlipping() {
        if (this.isFlipping) return;
        this.isFlipping = true;
        this.flipNext();
    }

    getNextChar(char) {
        const idx = FLAP_CHARS.indexOf(char);
        return FLAP_CHARS[(idx + 1) % FLAP_CHARS.length];
    }

    flipNext() {
        if (this.currentChar === this.targetChar) {
            this.isFlipping = false;
            return;
        }

        const next = this.getNextChar(this.currentChar);

        // Sound trigger
        if (window.solariAudio) {
            window.solariAudio.playFlap();
        }

        // Set up next character in the background
        this.backUpper.textContent = next;
        this.backLower.textContent = next;
        this.frontUpperChar.textContent = this.currentChar;
        this.frontLowerChar.textContent = this.currentChar;

        // Trigger CSS 3D flip animation
        this.el.classList.add('flipping');

        // Halfway through rotation, update the lower front flap
        const flipDuration = this.stepDelayMs;
        setTimeout(() => {
            this.frontLowerChar.textContent = next;
        }, flipDuration * 0.45);

        // End of step
        setTimeout(() => {
            this.currentChar = next;
            this.frontUpperChar.textContent = next;
            this.el.classList.remove('flipping');

            // Continue stepping toward target
            if (this.currentChar !== this.targetChar) {
                // Accelerate slightly if distance is long
                this.flipNext();
            } else {
                this.isFlipping = false;
            }
        }, flipDuration);
    }
}

class SplitFlapRow {
    constructor(container, length = 48) {
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
            // Stagger each tile slightly for the classic ripple wave effect
            const staggerDelay = staggerBaseMs + (i * 22) + (Math.random() * 25);
            this.tiles[i].setChar(char, staggerDelay);
        }
    }
}

class SplitFlapBoard {
    constructor(containerId, rowCount = 8, colCount = 48) {
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
        for (let r = 0; r < this.rowCount; r++) {
            const text = rowStrings[r] || '';
            // Stagger each row slightly (row wave)
            const rowStagger = r * 80;
            this.rows[r].setText(text, rowStagger);
        }
    }
}

window.SplitFlapBoard = SplitFlapBoard;
