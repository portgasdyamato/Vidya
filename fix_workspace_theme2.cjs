const fs = require('fs');

const path = 'client/src/pages/workspace.tsx';
let content = fs.readFileSync(path, 'utf8');

// The previous run replaced many things, but left some broken ones like "bg-slate-900 dark:bg-white/[0.03]".
// We need to fix them.
// "bg-slate-900 dark:bg-white/[0.03]" -> "bg-slate-900/[0.03] dark:bg-white/[0.03]"
// "border-slate-900 dark:border-white/[0.05]" -> "border-slate-900/[0.05] dark:border-white/[0.05]"

content = content.replace(/(text|border|bg)-slate-900 dark:\1-white\/\[([0-9\.]+)\]/g, '$1-slate-900/[$2] dark:$1-white/[$2]');

// The user profile avatar had text-white inside a blue gradient.
// <div className="... bg-gradient-to-br from-indigo-500 to-blue-600 ... text-slate-900 dark:text-white ...">
content = content.replace(
    'from-indigo-500 to-blue-600 flex items-center justify-center text-[11px] text-slate-900 dark:text-white',
    'from-indigo-500 to-blue-600 flex items-center justify-center text-[11px] text-white'
);

fs.writeFileSync(path, content, 'utf8');
console.log("Fixed brackets opacity issues");
