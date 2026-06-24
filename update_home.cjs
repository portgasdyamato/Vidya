const fs = require('fs');

let content = fs.readFileSync('client/src/pages/home.tsx', 'utf8');

// 1. Fix Background
const oldBg = `<div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-50 dark:hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-slate-50 to-gray-200 opacity-80" />
        <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-gray-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-50 animate-pulse" style={{ animationDuration: '15s' }} />
        <div className="absolute w-[100vw] h-[100vh] top-[20%] left-[20%] bg-slate-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-pulse" style={{ animationDuration: '20s', animationDelay: '2s' }} />
        <div className="absolute w-[110vw] h-[110vh] -bottom-[20%] -right-[10%] bg-zinc-300 rounded-full mix-blend-multiply filter blur-[90px] opacity-60 animate-pulse" style={{ animationDuration: '18s', animationDelay: '5s' }} />
      </div>`;

const newBg = `<div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-50 dark:hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50/80 via-purple-50/80 to-blue-50/80 opacity-90" />
        <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-pink-200/30 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse" style={{ animationDuration: '15s' }} />
        <div className="absolute w-[100vw] h-[100vh] top-[20%] left-[20%] bg-purple-200/30 rounded-full mix-blend-multiply filter blur-[120px] opacity-60 animate-pulse" style={{ animationDuration: '20s', animationDelay: '2s' }} />
        <div className="absolute w-[110vw] h-[110vh] -bottom-[20%] -right-[10%] bg-blue-200/30 rounded-full mix-blend-multiply filter blur-[90px] opacity-70 animate-pulse" style={{ animationDuration: '18s', animationDelay: '5s' }} />
      </div>`;

content = content.replace(oldBg, newBg);
content = content.replace(/White Grey Flowy Background/g, "Pastel Flowy Background");

// 2. Fix Text Colors
content = content.replace(/text-white\/([0-9]+)/g, 'text-slate-900/$1 dark:text-white/$1');
// for plain "text-white", be careful to match exact words and only inside classNames
content = content.replace(/(class|className)="([^"]*?)\btext-white\b([^"]*?)"/g, (match, attr, before, after) => {
    return `${attr}="${before}text-slate-900 dark:text-white${after}"`;
});

// 3. Update Theme Toggle in Header
const oldThemeToggle = `<button 
            onClick={toggle} 
            className="p-2 rounded-xl bg-black/5 border border-black/10 hover:bg-black/10 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 transition-colors text-black/70 dark:text-white/70"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>`;

const newThemeToggle = `<button 
            onClick={toggle} 
            className="p-2.5 rounded-xl bg-slate-900/5 border border-slate-900/10 hover:bg-slate-900/10 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 transition-colors text-slate-900/80 dark:text-white/80 flex items-center justify-center gap-2 shadow-sm"
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>`;

content = content.replace(oldThemeToggle, newThemeToggle);

// Also fix `text-black/70` in some other places like "Login" and "Workspace"
// because they shouldn't just be `text-black/70`, they should have `dark:text-white/70`. Wait, they already have `dark:text-white/70`. But now they'll have `dark:text-slate-900/70 dark:text-white/70` because of step 2?
// Let's manually replace the known ones instead of complex regexes if we need.
// Wait, my step 2 regex for `text-white/([0-9]+)` will replace `dark:text-white/70` with `dark:text-slate-900/70 dark:text-white/70`!
// Ah! That's why it failed!
// Let's fix that.
content = content.replace(/dark:text-slate-900\/([0-9]+) dark:text-white\/([0-9]+)/g, 'dark:text-white/$1');
content = content.replace(/dark:text-slate-900 dark:text-white/g, 'dark:text-white');
// And fix `text-black` to `text-slate-900` globally where it makes sense, or leave it.

// Fix specific occurrences:
content = content.replace(/text-black\/70 dark:text-white\/70/g, 'text-slate-900/70 dark:text-white/70');
content = content.replace(/hover:text-black dark:hover:text-white/g, 'hover:text-slate-900 dark:hover:text-white');

fs.writeFileSync('client/src/pages/home.tsx', content);

console.log("Updated home.tsx background and text styling securely");
