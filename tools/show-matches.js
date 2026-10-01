'use strict';

// Prints which emoji each sample colour maps to, for eyeballing the matcher.
const { matchColor } = require('../src/colorEmoji');

const samples = {
    // Peacock built-in favourites
    'Angular Red': '#dd0531', 'Azure Blue': '#007fff', 'JavaScript Yellow': '#f9e64f',
    'Mandalorian Blue': '#1857a4', 'Node Green': '#215732', 'React Blue': '#61dafb',
    'Something Different': '#832561', 'Svelte Orange': '#ff3d00', 'Vue Green': '#42b883',
    // CSS named colours
    red: '#ff0000', crimson: '#dc143c', maroon: '#800000', salmon: '#fa8072', pink: '#ffc0cb',
    hotpink: '#ff69b4', deeppink: '#ff1493', magenta: '#ff00ff', orchid: '#da70d6',
    purple: '#800080', indigo: '#4b0082', lavender: '#e6e6fa', navy: '#000080', blue: '#0000ff',
    royalblue: '#4169e1', steelblue: '#4682b4', skyblue: '#87ceeb', cyan: '#00ffff',
    teal: '#008080', turquoise: '#40e0d0', aquamarine: '#7fffd4', green: '#008000',
    lime: '#00ff00', olive: '#808000', darkolivegreen: '#556b2f', yellowgreen: '#9acd32',
    gold: '#ffd700', yellow: '#ffff00', khaki: '#f0e68c', orange: '#ffa500',
    darkorange: '#ff8c00', coral: '#ff7f50', chocolate: '#d2691e', sienna: '#a0522d',
    brown: '#a52a2a', tan: '#d2b48c', beige: '#f5f5dc', black: '#000000', gray: '#808080',
    silver: '#c0c0c0', white: '#ffffff', slategray: '#708090', darkslategray: '#2f4f4f',
};

for (const [name, hex] of Object.entries(samples)) {
    const m = matchColor(hex);
    console.log(`${name.padEnd(20)} ${hex}  ${m.e}  ${m.n}`);
}
