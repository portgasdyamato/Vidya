import re

with open('client/src/pages/workspace.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

def replace_color(match):
    full = match.group(0)
    prefix = match.group(1) # e.g. text-, border-, bg-
    color = match.group(2)  # white
    opacity = match.group(3) or '' # /50 or empty
    
    if 'dark:' in full:
        return full
        
    if prefix == 'text-':
        return f'text-slate-900{opacity} dark:text-white{opacity}'
    elif prefix == 'border-':
        return f'border-slate-900{opacity} dark:border-white{opacity}'
    elif prefix == 'bg-':
        return f'bg-slate-900{opacity} dark:bg-white{opacity}'
    
    return full

content = re.sub(r'(text-|border-|bg-)(white)(/[0-9\.]+)?', replace_color, content)

content = content.replace(
    'className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 text-slate-900 dark:text-white bg-black border border-slate-900/10 dark:border-white/10"',
    'className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 text-white bg-black border border-white/10"'
)

content = content.replace('bg-primary text-slate-900 dark:text-white', 'bg-primary text-white')
content = content.replace('bg-[#FF453A] text-slate-900 dark:text-white', 'bg-[#FF453A] text-white')
content = content.replace('bg-[#34C759] text-slate-900 dark:text-white', 'bg-[#34C759] text-white')

with open('client/src/pages/workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
