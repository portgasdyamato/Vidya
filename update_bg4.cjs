const fs = require('fs');

const files = [
    'client/src/pages/home.tsx',
    'client/src/pages/auth.tsx',
    'client/src/pages/workspace.tsx'
];

const oldBgHome = `{/* Light Mode: White Grey Flowy Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-50 dark:hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-slate-50 to-gray-200 opacity-80" />
        <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-gray-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-50 animate-pulse" style={{ animationDuration: '15s' }} />
        <div className="absolute w-[100vw] h-[100vh] top-[20%] left-[20%] bg-slate-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-pulse" style={{ animationDuration: '20s', animationDelay: '2s' }} />
        <div className="absolute w-[110vw] h-[110vh] -bottom-[20%] -right-[10%] bg-zinc-300 rounded-full mix-blend-multiply filter blur-[90px] opacity-60 animate-pulse" style={{ animationDuration: '18s', animationDelay: '5s' }} />
      </div>`;

const oldBgWorkspace = `{/* Light Mode: White Grey Flowy Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-50 dark:hidden z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-slate-50 to-gray-200 opacity-80" />
          <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-gray-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-50 animate-pulse" style={{ animationDuration: '15s' }} />
          <div className="absolute w-[100vw] h-[100vh] top-[20%] left-[20%] bg-slate-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-pulse" style={{ animationDuration: '20s', animationDelay: '2s' }} />
          <div className="absolute w-[110vw] h-[110vh] -bottom-[20%] -right-[10%] bg-zinc-300 rounded-full mix-blend-multiply filter blur-[90px] opacity-60 animate-pulse" style={{ animationDuration: '18s', animationDelay: '5s' }} />
        </div>`;

const newBgHome = `{/* Light Mode: Dynamic Colorful Flowy Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none bg-white dark:hidden z-0">
        <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-pink-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute w-[100vw] h-[100vh] top-[10%] left-[30%] bg-sky-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-pulse" style={{ animationDuration: '18s', animationDelay: '2s' }} />
        <div className="absolute w-[110vw] h-[110vh] -bottom-[10%] -right-[10%] bg-yellow-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-pulse" style={{ animationDuration: '15s', animationDelay: '5s' }} />
      </div>`;

const newBgWorkspace = `{/* Light Mode: Dynamic Colorful Flowy Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none bg-white dark:hidden z-0">
          <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-pink-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-pulse" style={{ animationDuration: '12s' }} />
          <div className="absolute w-[100vw] h-[100vh] top-[10%] left-[30%] bg-sky-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-pulse" style={{ animationDuration: '18s', animationDelay: '2s' }} />
          <div className="absolute w-[110vw] h-[110vh] -bottom-[10%] -right-[10%] bg-yellow-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-pulse" style={{ animationDuration: '15s', animationDelay: '5s' }} />
        </div>`;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace exact blocks
    content = content.replaceAll(oldBgHome, newBgHome);
    content = content.replaceAll(oldBgWorkspace, newBgWorkspace);
    
    // Remove bg-slate-50 from workspace root elements to ensure clean white background base
    content = content.replace(/bg-slate-50 dark:bg-black/g, 'bg-white dark:bg-black');
    content = content.replace(/bg-slate-50 dark:hidden/g, 'bg-white dark:hidden');

    fs.writeFileSync(file, content);
    console.log("Updated", file);
});
