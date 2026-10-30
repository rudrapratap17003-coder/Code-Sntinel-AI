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
let actionlessButtons = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  // Match <Button ...> and <button ...>
  // Check for onClick, to, type="submit", disabled
  const buttonTags = content.match(/<(?:Button|button)\b[^>]*>/g) || [];

  for (const tag of buttonTags) {
    const hasOnClick = /onClick\s*=/.test(tag);
    const hasTo = /to\s*=/.test(tag);
    const isSubmit = /type\s*=\s*['"]submit['"]/.test(tag);
    const isDisabled = /disabled\b/.test(tag);

    if (!hasOnClick && !hasTo && !isSubmit && !isDisabled) {
      console.warn(`[WARNING] In ${file}: Button without clear action:\n  ${tag}`);
      actionlessButtons++;
    }
  }
}

console.log(`Actionless buttons found: ${actionlessButtons}`);
