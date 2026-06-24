const fs = require('fs');
let content = fs.readFileSync('client/src/pages/workspace.tsx', 'utf8');

// Aggressive replacement for white elements that shouldn't be white in light mode
content = content.replace(/from-white\b/g, "from-slate-900 dark:from-white");
content = content.replace(/to-white\/([0-9]+)/g, "to-slate-900/$1 dark:to-white/$1");
content = content.replace(/from-white\/([0-9]+)/g, "from-slate-900/$1 dark:from-white/$1");
content = content.replace(/to-white\b/g, "to-slate-900 dark:to-white");

content = content.replace(/(?<!dark:)text-white\b(?!\/)/g, "text-slate-900 dark:text-white");
content = content.replace(/(?<!dark:)text-white\/([0-9]+)/g, "text-slate-900/$1 dark:text-white/$1");

// Fix any accidental duplicated dark tags
content = content.replace(/dark:text-slate-900 dark:text-white/g, "dark:text-white");
content = content.replace(/dark:text-slate-900\/([0-9]+) dark:text-white\/([0-9]+)/g, "dark:text-white/$1");

content = content.replace(/dark:from-slate-900 dark:from-white/g, "dark:from-white");
content = content.replace(/dark:from-slate-900\/([0-9]+) dark:from-white\/([0-9]+)/g, "dark:from-white/$1");

content = content.replace(/dark:to-slate-900 dark:to-white/g, "dark:to-white");
content = content.replace(/dark:to-slate-900\/([0-9]+) dark:to-white\/([0-9]+)/g, "dark:to-white/$1");

fs.writeFileSync('client/src/pages/workspace.tsx', content);
console.log("Workspace text fixed!");
