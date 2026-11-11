const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const dirs = ['background', 'content', 'shared', 'popup', 'options', 'tests', 'tools'];
let errors = 0;

for (const dir of dirs) {
  const fullDir = path.join(root, dir);
  if (!fs.existsSync(fullDir)) continue;
  const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.js') || f.endsWith('.cjs'));
  for (const file of files) {
    const filePath = path.join(fullDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      new vm.Script(content, { filename: filePath });
    } catch (err) {
      console.error(`Syntax error in ${filePath}:`, err.message);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`Total syntax errors: ${errors}`);
  process.exit(1);
} else {
  console.log('Syntax check passed: all JavaScript files are valid.');
}
