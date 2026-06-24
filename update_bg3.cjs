const fs = require('fs');

const files = [
    'client/src/pages/home.tsx',
    'client/src/pages/auth.tsx',
    'client/src/pages/workspace.tsx'
];

const newBgHome = `{/* Light Mode: Dynamic Colorful Flowy Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none bg-white dark:hidden z-0">
        <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-pink-200 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse" style={{ animationDuration: '15s' }} />
        <div className="absolute w-[100vw] h-[100vh] top-[10%] left-[20%] bg-sky-200 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-pulse" style={{ animationDuration: '20s', animationDelay: '2s' }} />
        <div className="absolute w-[110vw] h-[110vh] -bottom-[10%] -right-[10%] bg-yellow-200 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse" style={{ animationDuration: '18s', animationDelay: '5s' }} />
      </div>`;

const newBgWorkspace = `{/* Light Mode: Dynamic Colorful Flowy Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none bg-white dark:hidden z-0">
          <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-pink-200 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse" style={{ animationDuration: '15s' }} />
          <div className="absolute w-[100vw] h-[100vh] top-[10%] left-[20%] bg-sky-200 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-pulse" style={{ animationDuration: '20s', animationDelay: '2s' }} />
          <div className="absolute w-[110vw] h-[110vh] -bottom-[10%] -right-[10%] bg-yellow-200 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse" style={{ animationDuration: '18s', animationDelay: '5s' }} />
        </div>`;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace the block completely with Regex
    content = content.replace(/\{\/\* Light Mode: White Grey Flowy Background \*\/\}[\s\S]*?<div className="absolute inset-0 bg-gradient-to-br[\s\S]*?<\/div>\s*<\/div>/g, (match) => {
        if (match.includes('        {/*')) {
            return newBgWorkspace;
        }
        return newBgHome;
    });
    
    content = content.replace(/bg-slate-50 dark:bg-black/g, 'bg-white dark:bg-black');
    content = content.replace(/bg-slate-50 dark:hidden/g, 'bg-white dark:hidden');

    fs.writeFileSync(file, content);
    console.log("Updated", file);
});
