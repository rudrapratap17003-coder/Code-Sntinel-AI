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

const files = findFiles('src', ['.jsx']);
let trueActionless = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  // Match full opening tags: <(Button|button)\s+([\s\S]*?)>
  // We can track matching braces/brackets or split by lines
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/<(?:Button|button)\b/.test(line)) {
      // Gather lines until closing of the opening tag (until matching > outside braces)
      let tagText = line;
      let j = i;
      let depth = 0;
      let finished = false;
      while (j < lines.length && !finished) {
        const curLine = lines[j];
        for (let c = (j === i ? line.indexOf('<') : 0); c < curLine.length; c++) {
          const char = curLine[c];
          if (char === '{') depth++;
          else if (char === '}') depth--;
          else if (char === '>' && depth === 0) {
            finished = true;
            tagText = lines.slice(i, j + 1).join(' ');
            break;
          }
        }
        if (!finished) j++;
      }

      const hasOnClick = /onClick\s*=/.test(tagText);
      const hasTo = /\bto\s*=/.test(tagText);
      const isSubmit = /type\s*=\s*['"]submit['"]/.test(tagText);
      const isDisabled = /\bdisabled\b/.test(tagText);

      if (!hasOnClick && !hasTo && !isSubmit && !isDisabled) {
        console.warn(`[WARNING] True actionless button in ${file} at line ${i + 1}:\n  ${tagText.trim().slice(0, 100)}...`);
        trueActionless++;
      }
    }
  }
}

console.log(`\nAccurate Actionless Buttons Audit: ${trueActionless} found.`);
