const fs = require('fs');

const files = [
    'client/src/pages/home.tsx',
    'client/src/pages/auth.tsx',
    'client/src/pages/workspace.tsx'
];

const oldBgHome = `{/* Light Mode: Multi-color Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none dark:hidden z-0 bg-white">
        <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-pink-100/60 blur-[100px]" />
        <div className="absolute top-[20%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-blue-100/60 blur-[100px]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-orange-100/50 blur-[120px]" />
      </div>`;

const oldBgWorkspace = `{/* Light Mode: Multi-color Gradient Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none dark:hidden z-0 bg-white">
          <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-pink-100/60 blur-[100px]" />
          <div className="absolute top-[20%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-blue-100/60 blur-[100px]" />
          <div className="absolute -bottom-[10%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-orange-100/50 blur-[120px]" />
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
    
    // Replace backgrounds
    content = content.replace(oldBgHome, newBgHome);
    content = content.replace(oldBgWorkspace, newBgWorkspace);
    
    // Remove bg-slate-50 from root elements
    content = content.replace(/bg-slate-50/g, 'bg-white');
    
    fs.writeFileSync(file, content);
    console.log("Updated", file);
});
