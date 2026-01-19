const fs = require('fs');
const files = [
    'js/game-editor.js',
    'js/game-editor copy.js',
    'js/operators.js',
    'js/game.js'
];
files.forEach(f => {
    try {
        const code = fs.readFileSync(f, 'utf8');
        // Try to compile using Function constructor
        new Function(code);
        console.log(f + ': OK');
    } catch (e) {
        console.error(f + ': SYNTAX ERROR');
        console.error(e.toString());
    }
});
