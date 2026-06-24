const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('client/src/components').concat(walk('client/src/pages'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace all text translucent or slate classes with text-white
    const regexes = [
        /text-slate-\d00/g,
        /text-zinc-\d00/g,
        /text-gray-\d00/g,
        /text-muted-foreground/g,
        /text-white\/\d+/g,
        /text-black\/\d+/g,
        /text-primary\/[1-9]0/g,
        /text-black/g // Except if it's on bg-white
    ];

    // Wait, replacing 'text-black' globally is dangerous because of bg-white text-black buttons.
    // Let's do it safely: Only replace text-black if it's not preceded by bg-white. Actually, I can just replace the specific translucent whites and grays.
    
    let original = content;
    content = content.replace(/text-slate-\d00/g, 'text-white');
    content = content.replace(/text-zinc-\d00/g, 'text-white');
    content = content.replace(/text-gray-\d00/g, 'text-white');
    content = content.replace(/text-muted-foreground/g, 'text-white');
    content = content.replace(/text-white\/\d+/g, 'text-white');
    content = content.replace(/text-black\/\d+/g, 'text-white');
    
    // Some icons use stroke-slate or fill-slate or text-slate
    content = content.replace(/stroke-slate-\d00/g, 'stroke-white');
    content = content.replace(/fill-slate-\d00/g, 'fill-white');
    
    // Let's remove opacity utilities if they are applied to text wrappers? 
    // Hard to do safely. We'll stick to text colors.

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log("Updated", file);
    }
});
