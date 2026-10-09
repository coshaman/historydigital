import { execFileSync } from 'node:child_process';

for (const script of ['main20-final-route-smoke.mjs', 'main20-onboarding-audit.mjs', 'main20-window-roundtrip-final.mjs', 'main20-final-browser-evidence.mjs']) {
  execFileSync(process.execPath, [`scripts/${script}`], { stdio: 'inherit', env: process.env });
}
console.log('PASS MAIN20 final acceptance');
