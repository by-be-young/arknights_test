const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'js', 'operators.js');
let src = fs.readFileSync(file, 'utf8');
const assignIndex = src.indexOf('=');
const arrayStart = src.indexOf('[', assignIndex);
const arrayEnd = src.lastIndexOf(']');
const prefix = src.slice(0, arrayStart);
const suffix = src.slice(arrayEnd + 1);
const arrText = src.slice(arrayStart, arrayEnd + 1);
let ops;
try {
    ops = eval('(' + arrText + ')');
} catch (e) {
    console.error('Failed to eval operators array:', e);
    process.exit(1);
}
let changed = 0;
ops.forEach(op => {
    if (op['自身能力']) {
        Object.keys(op['自身能力']).forEach(subCat => {
            const subObj = op['自身能力'][subCat];
            if (subObj && typeof subObj === 'object') {
                const hasA = Object.prototype.hasOwnProperty.call(subObj, '为自身治疗');
                const hasB = Object.prototype.hasOwnProperty.call(subObj, '使自身生命回复');
                if (hasA || hasB) {
                    subObj['为自身治疗或生命回复'] = 1;
                    if (hasA) delete subObj['为自身治疗'];
                    if (hasB) delete subObj['使自身生命回复'];
                    changed++;
                }
            }
        });
    }
});
const newArrayText = JSON.stringify(ops, null, 4);
const newSrc = prefix + newArrayText + suffix;
fs.writeFileSync(file, newSrc, 'utf8');
console.log('Merged 自身治疗 keys, changes:', changed);
