'use strict';

// Measures how the Windows taskbar renders every emoji and writes src/palette.json.
// The taskbar draws the font's flat COLRv0 layers, while browsers prefer the gradient
// COLRv1 layers, so rendering uses a temp copy of the font with COLRv1 disabled.
// Usage: node tools/build-palette.js [path-to-emoji-test.txt]
// Env: BROWSER_PATH (Chromium-based browser), FONT_PATH (emoji font), MIN_COVERAGE.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const EMOJI_TEST_URL = 'https://unicode.org/Public/emoji/latest/emoji-test.txt';
const OUT = path.join(__dirname, '..', 'src', 'palette.json');
const MIN_COVERAGE = Number(process.env.MIN_COVERAGE || 0.5);

async function loadEmojiTest(file) {
    if (file) {
        return fs.readFileSync(file, 'utf8');
    }
    const res = await fetch(EMOJI_TEST_URL);
    if (!res.ok) {
        throw new Error(`Download failed: ${res.status} ${EMOJI_TEST_URL}`);
    }
    return res.text();
}

function parseEmojiTest(text) {
    const entries = [];
    let group = '';
    for (const line of text.split(/\r?\n/)) {
        const g = /^# group: (.+)$/.exec(line);
        if (g) {
            group = g[1].trim();
            continue;
        }
        const m = /^([0-9A-F ]+);\s*fully-qualified\s*#\s*\S+\s+E[\d.]+\s+(.+)$/.exec(line);
        if (!m || group === 'Component') {
            continue;
        }
        const cps = m[1].trim().split(/\s+/).map(h => parseInt(h, 16));
        if (cps.some(cp => cp >= 0x1F3FB && cp <= 0x1F3FF)) {
            continue;
        }
        entries.push({ emoji: String.fromCodePoint(...cps), name: m[2].trim() });
    }
    return entries;
}

function findBrowser() {
    if (process.env.BROWSER_PATH) {
        return process.env.BROWSER_PATH;
    }
    for (const exe of ['msedge.exe', 'chrome.exe']) {
        for (const hive of ['HKLM', 'HKCU']) {
            try {
                const out = execFileSync('reg', ['query', `${hive}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}`, '/ve'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
                const m = /REG_SZ\s+(.+)$/m.exec(out);
                if (m && fs.existsSync(m[1].trim())) {
                    return m[1].trim();
                }
            } catch { /* not registered in this hive */ }
        }
    }
    throw new Error('No Edge/Chrome found; set BROWSER_PATH.');
}

function writeFlatFont(dest) {
    const src = process.env.FONT_PATH || path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'seguiemj.ttf');
    const buf = fs.readFileSync(src);
    const numTables = buf.readUInt16BE(4);
    for (let i = 0; i < numTables; i++) {
        const rec = 12 + i * 16;
        if (buf.toString('latin1', rec, rec + 4) === 'COLR') {
            // Version 0 makes renderers ignore the COLRv1 (gradient) glyph list.
            buf.writeUInt16BE(0, buf.readUInt32BE(rec + 8));
            fs.writeFileSync(dest, buf);
            return src;
        }
    }
    throw new Error(`${src} has no COLR table.`);
}

// Runs inside the browser: for each emoji, find the dominant colour cluster in OKLab.
function measureInPage(emojis) {
    const SIZE = 80, FONT = '48px FlatEmoji', RADIUS = 0.1;
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.font = FONT;
    const refWidth = x.measureText('\u{1F534}').width;

    const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    const oklab = (r, g, b) => {
        r = lin(r); g = lin(g); b = lin(b);
        const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
        const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
        const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
        return [
            0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
        ];
    };
    const draw = (e, fill) => {
        x.clearRect(0, 0, SIZE, SIZE);
        x.font = FONT;
        x.textBaseline = 'middle';
        x.fillStyle = fill;
        x.fillText(e, 8, SIZE / 2);
        return x.getImageData(0, 0, SIZE, SIZE).data;
    };

    const results = [];
    for (const e of emojis) {
        if (x.measureText(e).width > refWidth * 1.3) {
            continue; // sequence rendered as several glyphs
        }
        const a = draw(e, '#ff00ff');
        const b = draw(e, '#00ffff');
        let mono = false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) { mono = true; break; }
        }
        if (mono) {
            continue; // not a colour glyph
        }
        const px = [];
        let x0 = SIZE, y0 = SIZE, x1 = -1, y1 = -1;
        for (let i = 0; i < a.length; i += 4) {
            if (a[i + 3] > 200) {
                px.push(oklab(a[i], a[i + 1], a[i + 2]));
                const xi = (i / 4) % SIZE, yi = Math.floor(i / 4 / SIZE);
                x0 = Math.min(x0, xi); x1 = Math.max(x1, xi); y0 = Math.min(y0, yi); y1 = Math.max(y1, yi);
            }
        }
        if (px.length < 100) {
            continue;
        }
        const fill = px.length / ((x1 - x0 + 1) * (y1 - y0 + 1));
        const bins = new Map();
        for (const p of px) {
            const k = `${Math.round(p[0] / 0.05)},${Math.round(p[1] / 0.025)},${Math.round(p[2] / 0.025)}`;
            const v = bins.get(k) || [0, 0, 0, 0];
            v[0]++; v[1] += p[0]; v[2] += p[1]; v[3] += p[2];
            bins.set(k, v);
        }
        const seeds = [...bins.values()].sort((p, q) => q[0] - p[0]).slice(0, 6)
            .map(v => [v[1] / v[0], v[2] / v[0], v[3] / v[0]]);
        // Mean-shift from the densest bins so gradients collapse onto one mode.
        let best = null;
        for (let center of seeds) {
            let n = 0, L = 0, A = 0, B = 0;
            for (let iter = 0; iter < 15; iter++) {
                n = 0; L = 0; A = 0; B = 0;
                for (const p of px) {
                    if (Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]) < RADIUS) {
                        n++; L += p[0]; A += p[1]; B += p[2];
                    }
                }
                const next = [L / n, A / n, B / n];
                const moved = Math.hypot(next[0] - center[0], next[1] - center[1], next[2] - center[2]);
                center = next;
                if (moved < 1e-4) break;
            }
            if (!best || n > best[0]) best = [n, center];
        }
        results.push([e, best[0] / px.length, fill, best[0], ...best[1]]);
    }
    return results;
}

function measure(browser, emojis) {
    const html = `<!doctype html><meta charset="utf-8"><style>@font-face { font-family: FlatEmoji; src: url(flat.ttf); }</style><body><pre id="out"></pre><script>
${measureInPage.toString()}
document.fonts.load('48px FlatEmoji').then(() => {
    document.getElementById('out').textContent = JSON.stringify(measureInPage(${JSON.stringify(emojis)}));
});
</script>`;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emoji-palette-'));
    const file = path.join(dir, 'measure.html');
    fs.writeFileSync(file, html, 'utf8');
    try {
        console.log(`Font: ${writeFlatFont(path.join(dir, 'flat.ttf'))}`);
        const dom = execFileSync(browser, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--virtual-time-budget=60000', `--user-data-dir=${path.join(dir, 'profile')}`, '--dump-dom', pathToFileURL(file).href], {
            encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
        });
        const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom);
        if (!m || !m[1]) {
            throw new Error('Browser produced no measurements.');
        }
        return JSON.parse(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// A filled disc covers pi/4 of its bounding box; rings and outlines cover far less.
const MIN_SHAPE_FILL = 0.7;

function tierOf(name, fill, coverage) {
    const solid = fill >= MIN_SHAPE_FILL && coverage >= 0.8;
    if (solid && /\bcircle$/.test(name)) {
        return 0;
    }
    if (solid && /\bsquare$/.test(name)) {
        return 1;
    }
    return 2;
}

async function main() {
    const entries = parseEmojiTest(await loadEmojiTest(process.argv[2]));
    const names = new Map(entries.map(e => [e.emoji, e.name]));
    const browser = findBrowser();
    console.log(`Measuring ${entries.length} emojis with ${browser}`);
    const measured = measure(browser, entries.map(e => e.emoji));

    const r4 = v => Math.round(v * 10000) / 10000;
    const kept = measured
        .filter(([, coverage]) => coverage >= MIN_COVERAGE)
        .map(([e, coverage, fill, count, L, a, b]) => ({ e, name: names.get(e), coverage, fill, count, L, a, b }));
    for (const k of kept) {
        k.t = tierOf(k.name, k.fill, k.coverage);
    }
    // Express coloured area relative to a filled circle so the matcher can prefer bold glyphs.
    const discCount = Math.max(...kept.filter(k => k.t === 0).map(k => k.count));
    const palette = kept
        .map(({ e, name, t, count, L, a, b }) => {
            let h = Math.atan2(b, a) * 180 / Math.PI;
            if (h < 0) h += 360;
            return { e, n: name, t, a: Math.round(Math.min(1, count / discCount) * 100) / 100, L: r4(L), C: r4(Math.hypot(a, b)), h: r4(h) };
        })
        .sort((p, q) => p.t - q.t || p.n.localeCompare(q.n));

    fs.writeFileSync(OUT, JSON.stringify(palette, null, 0).replace(/\},\{/g, '},\n{') + '\n', 'utf8');
    const tiers = [0, 1, 2].map(t => palette.filter(p => p.t === t).length);
    console.log(`Rendered in colour: ${measured.length}; kept ${palette.length} (circles ${tiers[0]}, squares ${tiers[1]}, other ${tiers[2]}) -> ${path.relative(process.cwd(), OUT)}`);
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
