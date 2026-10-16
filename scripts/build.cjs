'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
let config = require('../supabase/public-config.json');
if (process.env.SALES_DATA_SOURCE && !['snapshot','supabase'].includes(process.env.SALES_DATA_SOURCE)) throw new Error('Invalid SALES_DATA_SOURCE');
if (process.env.SALES_DATA_SOURCE === 'snapshot') config = {source:'snapshot'};
if (supabaseUrl || publishableKey) {
  if (!supabaseUrl || !publishableKey) throw new Error('Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Vercel.');
  const url = new URL(supabaseUrl);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.pathname !== '/' || url.username || url.password || url.search || url.hash) throw new Error('Use the Supabase HTTPS Project URL, not its dashboard URL.');
  if (!publishableKey.startsWith('sb_publishable_')) throw new Error('Only sb_publishable_ keys are accepted. Do not use secret/service_role keys.');
  config = {source:'supabase', supabaseUrl:url.origin, supabasePublishableKey:publishableKey};
}
const files = ['index.html', 'styles.css', 'app.js', 'data-source.js', 'data/sales.json'];
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
fs.writeFileSync(path.join(output, 'runtime-config.js'), 'window.DASHBOARD_CONFIG = ' + JSON.stringify(config) + ';\n');
console.log(`Built dashboard with ${rows.length} sales records in dist/ (source: ${config.source})`);
