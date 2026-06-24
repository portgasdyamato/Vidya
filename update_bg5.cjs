const fs = require('fs');

const files = [
    'client/src/pages/home.tsx',
    'client/src/pages/auth.tsx',
    'client/src/pages/workspace.tsx'
];

const newBgHome = `{/* Light Mode: Dynamic Colorful Flowy Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none dark:hidden z-0 bg-white/10 backdrop-blur-3xl">
        <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-pink-400 rounded-full filter blur-[120px] opacity-60 animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute w-[100vw] h-[100vh] top-[10%] left-[30%] bg-sky-400 rounded-full filter blur-[120px] opacity-60 animate-pulse" style={{ animationDuration: '18s', animationDelay: '2s' }} />
        <div className="absolute w-[110vw] h-[110vh] -bottom-[10%] -right-[10%] bg-yellow-300 rounded-full filter blur-[120px] opacity-60 animate-pulse" style={{ animationDuration: '15s', animationDelay: '5s' }} />
        <div className="absolute inset-0 bg-white/20 filter blur-[10px]" />
      </div>`;

const newBgWorkspace = `{/* Light Mode: Dynamic Colorful Flowy Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none dark:hidden z-0 bg-white/10 backdrop-blur-3xl">
          <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-pink-400 rounded-full filter blur-[120px] opacity-60 animate-pulse" style={{ animationDuration: '12s' }} />
          <div className="absolute w-[100vw] h-[100vh] top-[10%] left-[30%] bg-sky-400 rounded-full filter blur-[120px] opacity-60 animate-pulse" style={{ animationDuration: '18s', animationDelay: '2s' }} />
          <div className="absolute w-[110vw] h-[110vh] -bottom-[10%] -right-[10%] bg-yellow-300 rounded-full filter blur-[120px] opacity-60 animate-pulse" style={{ animationDuration: '15s', animationDelay: '5s' }} />
          <div className="absolute inset-0 bg-white/20 filter blur-[10px]" />
        </div>`;

// Workspace has two instances.
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace the specific background blobs correctly by regex matching the block.
    content = content.replace(/\{\/\* Light Mode: Dynamic Colorful Flowy Background \*\/\}[\s\S]*?<\/div>\s*(?=\{\/\* Dark Mode: Cinematic GIF Environment \*\/\}|\n      \{\/\* Main Content wrapper \*\/\}|\n      \{\/\* 1. Navigation Sidebar \*\/\}|\n      \{\/\* Back Button \*\/\}|\n      \{\/\* Content \*\/\}|\n      \{\/\* Dark Mode: Cinematic GIF)/g, (match) => {
        if (match.includes('        {/* Light Mode: Dynamic Colorful Flowy Background */}')) {
            return newBgWorkspace + '\n';
        }
        return newBgHome + '\n';
    });

    if (file.includes('workspace.tsx')) {
        // Change text colors
        content = content.replace(/text-slate-900 dark:text-slate-200/g, 'text-white dark:text-slate-200');
        content = content.replace(/text-slate-100/g, 'text-white');
        content = content.replace(/text-slate-400/g, 'text-white/70');
        content = content.replace(/text-slate-200/g, 'text-white');
        content = content.replace(/text-slate-500/g, 'text-white/50');
        
        // Let's also check if there's any other text-slate-900 that should be white
        content = content.replace(/text-slate-900/g, 'text-white');
        content = content.replace(/bg-slate-900\/\[0\.02\]/g, 'bg-white/10');
        content = content.replace(/bg-slate-900\/10/g, 'bg-white/10');
        content = content.replace(/border-slate-900\/10/g, 'border-white/20');
        content = content.replace(/bg-slate-900\/5/g, 'bg-white/5');
    }

    fs.writeFileSync(file, content);
    console.log("Updated", file);
});
