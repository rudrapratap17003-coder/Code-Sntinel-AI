import fs from 'node:fs';
import path from 'node:path';

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

const files = findFiles('src', ['.js', '.jsx']);
console.log(`Analyzing ${files.length} files in src/ for unused imports...\n`);

const importRegex = /import\s+(?:\{([^}]+)\}|(\w+)|(?:\*\s+as\s+(\w+)))\s+from\s+['"][^'"]+['"]/g;

let totalUnused = 0;

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  let match;
  const unusedInFile = [];

  while ((match = importRegex.exec(code)) !== null) {
    if (match[1]) {
      // Named imports
      const items = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      for (const item of items) {
        // Count occurrences in code outside the import statement
        const itemRegex = new RegExp(`\\b${item}\\b`, 'g');
        const count = (code.match(itemRegex) || []).length;
        if (count <= 1) {
          unusedInFile.push(item);
        }
      }
    } else if (match[2]) {
      // Default import
      const item = match[2];
      const itemRegex = new RegExp(`\\b${item}\\b`, 'g');
      const count = (code.match(itemRegex) || []).length;
      if (count <= 1) {
        unusedInFile.push(item);
      }
    }
  }

  if (unusedInFile.length > 0) {
    console.log(`${file}:`);
    console.log(`  Unused: ${unusedInFile.join(', ')}`);
    totalUnused += unusedInFile.length;
  }
}

console.log(`\nTotal unused imports found: ${totalUnused}`);
