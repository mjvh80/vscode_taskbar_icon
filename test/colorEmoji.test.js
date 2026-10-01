'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { colorToEmoji, matchColor, parseColor, buildTitle } = require('../src/colorEmoji');
const PALETTE = require('../src/palette.json');

function oklchToHex({ L, C, h }) {
    const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    const rgb = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
    const enc = v => {
        v = Math.min(1, Math.max(0, v));
        return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
    };
    return '#' + rgb.map(v => enc(v).toString(16).padStart(2, '0')).join('');
}

const colourWord = name => name.split(' ')[0];
const circles = new Map(PALETTE.filter(p => p.t === 0).map(p => [colourWord(p.n), p]));

test('palette has the basic coloured circles', () => {
    for (const word of ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'brown', 'black', 'white']) {
        assert.ok(circles.has(word), word);
    }
});

test('each circle matches its own measured colour', () => {
    for (const p of circles.values()) {
        assert.strictEqual(matchColor(oklchToHex(p)).e, p.e, p.n);
    }
});

test('circles win over squares and hearts drawn in the same shade', () => {
    const sameShade = (p, q) => Math.abs(p.L - q.L) < 0.03 && Math.abs(p.C - q.C) < 0.03
        && Math.min(Math.abs(p.h - q.h), 360 - Math.abs(p.h - q.h)) < 5;
    const others = PALETTE.filter(p => / (square|heart)$/.test(p.n)
        && circles.has(colourWord(p.n)) && sameShade(p, circles.get(colourWord(p.n))));
    assert.ok(others.length >= 5, `only ${others.length} same-shade pairs`);
    for (const p of others) {
        assert.strictEqual(matchColor(oklchToHex(p)).e, circles.get(colourWord(p.n)).e, p.n);
    }
});

test('representative marker colours map to their circles', () => {
    const cases = {
        '#ff0000': 'red', '#d35400': 'orange', '#ffd700': 'yellow',
        '#8dc879': 'green', '#42b883': 'green', '#007acc': 'blue', '#4b0082': 'purple',
        '#000000': 'black', '#ffffff': 'white',
        '#8dc87999': 'green', 'rgb(0, 122, 204)': 'blue', '#f00': 'red',
    };
    for (const [color, word] of Object.entries(cases)) {
        assert.strictEqual(colorToEmoji(color), circles.get(word).e, color);
    }
});

test('dusty rose prefers the closer pink heart over the red circle', () => {
    assert.strictEqual(colorToEmoji('#c96f83'), '🩷');
});

test('colours between circle colours can use other emojis', () => {
    const used = new Set(['#ff69b4', '#00ffff', '#808080', '#c0c0c0'].map(colorToEmoji));
    assert.ok([...used].some(e => ![...circles.values()].some(c => c.e === e)));
});

test('returns null for invalid or missing colors', () => {
    for (const c of ['red', '#12345', 'rgb(300,0,0)', '', undefined, null, 42]) {
        assert.strictEqual(colorToEmoji(c), null, String(c));
    }
});

test('parseColor expands short hex', () => {
    assert.deepStrictEqual(parseColor('#0f8'), { r: 0, g: 255, b: 136 });
});

test('buildTitle substitutes placeholder or prefixes', () => {
    assert.strictEqual(buildTitle('${peacockEmoji} ${rootName} | ${activeEditorShort}', '🟢'), '🟢 ${rootName} | ${activeEditorShort}');
    assert.strictEqual(buildTitle('${rootName}', '🔵'), '🔵 ${rootName}');
    assert.strictEqual(buildTitle('${peacockEmoji}${peacockEmoji}', '🟣'), '🟣🟣');
});

test('buildTitle replaces circle/square markers hardcoded in the template', () => {
    assert.strictEqual(buildTitle('${rootName} 🔴 ${activeEditorShort}', '🟢'), '🟢 ${rootName} ${activeEditorShort}');
    assert.strictEqual(buildTitle('🟠 ${rootName}', '🔵'), '🔵 ${rootName}');
    assert.strictEqual(buildTitle('${rootName}🟡🟪${appName}', '🔴'), '🔴 ${rootName} ${appName}');
    assert.strictEqual(buildTitle('🔴 ${peacockEmoji} ${rootName}', '🔵'), '🔵 ${rootName}');
    assert.strictEqual(buildTitle('◼️ ${rootName}', '🔵'), '🔵 ${rootName}');
    assert.strictEqual(buildTitle('${rootName} ⭐ ${appName}', '🔵'), '🔵 ${rootName} ⭐ ${appName}');
});
