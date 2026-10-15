#!/usr/bin/env node
// Build index.html from template.html + data.js + geo.js + gazetteer.js (no dependencies).
'use strict';
const fs = require('fs');
const path = require('path');
const f = n => fs.readFileSync(path.join(__dirname, n), 'utf8');
const safe = s => s.replace(/<\/(script)/gi, '<\\/$1');
const now = new Date();
const pad = n => String(n).padStart(2, '0');
const stamp = `${now.getDate()}. ${now.getMonth() + 1}. ${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
const buildId = String(now.getTime());
let html = f('template.html');
const parts = { '/*@DATA@*/': safe(f('data.js')), '/*@GEO@*/': safe(f('geo.js')), '/*@GAZ@*/': safe(f('gazetteer.js')), '/*@STAMP@*/': stamp, '/*@BUILDID@*/': buildId };
for (const [k, v] of Object.entries(parts)) {
  if (!html.includes(k)) throw new Error('placeholder missing in template: ' + k);
  html = html.split(k).join(v);
}
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
fs.writeFileSync(path.join(__dirname, '.build-id'), buildId + '\n');
console.log(`build: index.html (${Math.round(html.length / 1024)} KB), stamp ${stamp}, id ${buildId}`);
