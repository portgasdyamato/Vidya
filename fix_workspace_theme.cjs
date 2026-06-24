const fs = require('fs');

const path = 'client/src/pages/workspace.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace text-white, border-white, bg-white with dark mode variants
content = content.replace(/(text-|border-|bg-)(white)(\/[0-9\.]+)?/g, (match, prefix, color, opacity) => {
    if (match.includes('dark:')) return match;
    const op = opacity || '';
    return `${prefix}slate-900${op} dark:${prefix}white${op}`;
});

// Fix specific things we don't want to change
content = content.replace(
    'className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 text-slate-900 dark:text-white bg-slate-900 dark:bg-white border border-slate-900/10 dark:border-white/10"',
    'className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 text-white bg-black border border-white/10"'
);

// We had bg-black earlier, wait! "bg-black border border-white/10"
// With the regex, border-white/10 becomes border-slate-900/10 dark:border-white/10. That's fine for light mode to have a black card with dark border? Actually no, black card should have light border.
// Let's just fix it globally:
content = content.replace(
    'bg-black border border-slate-900/10 dark:border-white/10',
    'bg-black border border-white/10'
);

content = content.replace(/text-slate-900 dark:text-white bg-black/g, 'text-white bg-black');
content = content.replace(/bg-primary text-slate-900 dark:text-white/g, 'bg-primary text-white');
content = content.replace(/bg-\[#FF453A\] text-slate-900 dark:text-white/g, 'bg-[#FF453A] text-white');
content = content.replace(/bg-\[#34C759\] text-slate-900 dark:text-white/g, 'bg-[#34C759] text-white');

fs.writeFileSync(path, content, 'utf8');
console.log("Done");
