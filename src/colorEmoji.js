'use strict';

const PALETTE = require('./palette.json');

// Circles and squares are colour markers; strip them from user templates so only ours remains.
const MARKERS = PALETTE.filter(p => p.t <= 1).map(p => p.e.replace(/\uFE0F/g, ''));

// Below this OKLab chroma a colour is treated as grey/black/white.
const ACHROMATIC_C = 0.03;
const W_HUE = 2, W_L = 0.5, W_C = 0.25;
// Added to the distance per tier so circles beat squares, which beat other emojis.
const TIER_PENALTY = [0, 0.02, 0.05, 0.15];
// Penalises emojis whose dominant colour covers less area than a filled circle (field `a`, 0..1).
const W_AREA = 0.01;

/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(...) or rgba(...). Returns {r,g,b} in 0..255 or null. */
function parseColor(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const s = value.trim();
    let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
    if (m) {
        let hex = m[1];
        if (hex.length <= 4) {
            hex = hex.split('').map(c => c + c).join('');
        }
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16),
        };
    }
    m = /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/i.exec(s);
    if (m) {
        const [r, g, b] = [m[1], m[2], m[3]].map(Number);
        if (r <= 255 && g <= 255 && b <= 255) {
            return { r, g, b };
        }
    }
    return null;
}

function toOklch({ r, g, b }) {
    const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    const [rl, gl, bl] = [lin(r), lin(g), lin(b)];
    const l = Math.cbrt(0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl);
    const m = Math.cbrt(0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl);
    const s = Math.cbrt(0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl);
    const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    const h = (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360;
    return { L, C: Math.hypot(a, bb), h };
}

function distance(c, p) {
    const pAchromatic = p.C < ACHROMATIC_C;
    if ((c.C < ACHROMATIC_C) !== pAchromatic) {
        return Infinity;
    }
    if (pAchromatic) {
        return Math.abs(c.L - p.L);
    }
    const dh = Math.abs(c.h - p.h);
    const hue = Math.min(dh, 360 - dh) / 180;
    return Math.hypot(W_HUE * hue, W_L * (c.L - p.L), W_C * Math.log(c.C / p.C));
}

/** Returns the palette entry that best represents the color, or null if the color can't be parsed. */
function matchColor(value) {
    const rgb = parseColor(value);
    if (!rgb) {
        return null;
    }
    const c = toOklch(rgb);
    let best = null, bestScore = Infinity;
    for (const p of PALETTE) {
        const tier = p.t <= 1 ? p.t : /\bheart$/.test(p.n) ? 2 : 3;
        const score = distance(c, p) + TIER_PENALTY[tier] + W_AREA * (1 - p.a);
        if (score < bestScore) {
            best = p;
            bestScore = score;
        }
    }
    return best;
}

/** Maps a color string to an emoji, or null if the color can't be parsed. */
function colorToEmoji(value) {
    const match = matchColor(value);
    return match ? match.e : null;
}

const PLACEHOLDER = '${peacockEmoji}';

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MARKER_RE = new RegExp(`(?:\\s*(?:${MARKERS.map(escapeRe).join('|')})\\uFE0F?)+\\s*`, 'gu');

/** Removes circle/square emojis hardcoded in the template so only the Peacock emoji remains. */
function stripEmojis(template) {
    return template.replace(MARKER_RE, ' ').trim();
}

/** Substitutes ${peacockEmoji} in the template, or prefixes the emoji if the placeholder is absent. */
function buildTitle(template, emoji) {
    const base = stripEmojis(template);
    if (base.includes(PLACEHOLDER)) {
        return base.split(PLACEHOLDER).join(emoji);
    }
    return `${emoji} ${base}`;
}

module.exports = { PLACEHOLDER, parseColor, toOklch, matchColor, colorToEmoji, buildTitle };
