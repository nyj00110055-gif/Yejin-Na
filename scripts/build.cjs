'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const files = ['index.html', 'styles.css', 'app.js', 'data/sales.json'];
for (const file of files) {
  const source = path.join(root, file);
  if (!fs.statSync(source).isFile()) throw new Error(`Missing application file: ${file}`);
}
const rows = JSON.parse(fs.readFileSync(path.join(root, 'data/sales.json'), 'utf8'));
if (!Array.isArray(rows) || !rows.length) throw new Error('Sales data is empty');
for (const file of files) {
  const target = path.join(output, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(path.join(root, file), target);
}
console.log(`Built dashboard with ${rows.length} sales records in dist/`);
