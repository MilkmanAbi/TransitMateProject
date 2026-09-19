p = 'src/lib/alerts.ts'
s = open(p, encoding='utf-8').read()
n = s.count('\x08')
s = s.replace('\x08', '\' + 'b')
open(p, 'w', encoding='utf-8').write(s)
print('replaced', n)
for f in ['src/lib/planner.ts', 'src/routes/plan.ts', '../client/src/lib/cie.ts', '../client/src/hooks/useCommute.ts', '../client/src/pages/Home.tsx', '../scripts/demo-capture.mjs', '../scripts/make-gif.py', 'src/routes/bus.ts', '../client/vite.config.ts', '../client/src/components/Journey/RouteCard.tsx']:
    t = open(f, encoding='utf-8').read()
    if '\x08' in t or '\x07' in t or '\x0c' in t: print('CONTROL CHARS IN', f)
