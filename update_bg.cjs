const fs = require('fs');

const files = [
    'client/src/pages/home.tsx',
    'client/src/pages/auth.tsx',
    'client/src/pages/workspace.tsx'
];

const oldBg = `{/* Light Mode: White Grey Flowy Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-50 dark:hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-slate-50 to-gray-200 opacity-80" />
        <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-gray-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-50 animate-pulse" style={{ animationDuration: '15s' }} />
        <div className="absolute w-[100vw] h-[100vh] top-[20%] left-[20%] bg-slate-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-pulse" style={{ animationDuration: '20s', animationDelay: '2s' }} />
        <div className="absolute w-[110vw] h-[110vh] -bottom-[20%] -right-[10%] bg-zinc-300 rounded-full mix-blend-multiply filter blur-[90px] opacity-60 animate-pulse" style={{ animationDuration: '18s', animationDelay: '5s' }} />
      </div>`;

const oldBg2 = `{/* Light Mode: White Grey Flowy Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-50 dark:hidden z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-slate-50 to-gray-200 opacity-80" />
          <div className="absolute w-[120vw] h-[120vh] -top-[10%] -left-[10%] bg-gray-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-50 animate-pulse" style={{ animationDuration: '15s' }} />
          <div className="absolute w-[100vw] h-[100vh] top-[20%] left-[20%] bg-slate-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-pulse" style={{ animationDuration: '20s', animationDelay: '2s' }} />
          <div className="absolute w-[110vw] h-[110vh] -bottom-[20%] -right-[10%] bg-zinc-300 rounded-full mix-blend-multiply filter blur-[90px] opacity-60 animate-pulse" style={{ animationDuration: '18s', animationDelay: '5s' }} />
        </div>`;

const newBg = `{/* Light Mode: Multi-color Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none dark:hidden z-0 bg-white">
        <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-pink-100/60 blur-[100px]" />
        <div className="absolute top-[20%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-blue-100/60 blur-[100px]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-orange-100/50 blur-[120px]" />
      </div>`;

const newBg2 = `{/* Light Mode: Multi-color Gradient Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none dark:hidden z-0 bg-white">
          <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-pink-100/60 blur-[100px]" />
          <div className="absolute top-[20%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-blue-100/60 blur-[100px]" />
          <div className="absolute -bottom-[10%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-orange-100/50 blur-[120px]" />
        </div>`;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(oldBg, newBg);
    content = content.replace(oldBg2, newBg2);
    
    // Ensure the root container of workspace doesn't have bg-slate-50 so the bg-white covers properly, 
    // actually our newBg has bg-white, so it will overlay perfectly.
    
    fs.writeFileSync(file, content);
    console.log("Updated", file);
});
