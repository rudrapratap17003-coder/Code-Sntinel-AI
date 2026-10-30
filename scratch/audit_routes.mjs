import fs from 'node:fs';
import path from 'node:path';
import { ROUTES } from '../src/utils/constants.js';

function findFiles(dir, exts, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(full, exts, results);
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

const validRoutes = new Set(Object.values(ROUTES));
console.log('Valid Application Routes:', Array.from(validRoutes));

const files = findFiles('src', ['.js', '.jsx']);
let linkIssues = 0;

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  
  // Search for string literals in to="..." or to={'...'} or navigate('...')
  const toRegex = /(?:to|navigate)\s*(?:=\s*\{?|\()\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = toRegex.exec(code)) !== null) {
    const target = match[1];
    // Ignore query parameters or external links
    const cleanPath = target.split('?')[0].split('#')[0];
    if (cleanPath && !cleanPath.startsWith('http') && !validRoutes.has(cleanPath)) {
      console.warn(`[WARNING] Potential invalid route in ${file}: "${target}" (base: "${cleanPath}")`);
      linkIssues++;
    }
  }
}

if (linkIssues === 0) {
  console.log('✓ All navigation targets and hardcoded route links match defined application routes!');
} else {
  console.log(`Found ${linkIssues} route target warnings.`);
}
