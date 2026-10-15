#!/usr/bin/env node
// Validate web/data.js. Exit code 1 on any ERROR or WARN (publishing stops); INFO is only printed.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const T = require('./datatool');

const d = T.load();
const out = { ERROR: [], WARN: [], INFO: [] };
const say = (lvl, msg) => out[lvl].push(msg);

const CERTS = new Set(['M', 'D', 'R', 'K']);
const lines = new Set(d.lines.map(l => l.id));
const byId = new Map();
for (const p of d.people) {
  if (byId.has(p.id)) say('ERROR', `duplicate id ${p.id}`);
  byId.set(p.id, p);
}
if (!byId.has(d.root)) say('ERROR', `root '${d.root}' does not exist`);

const gazSrc = fs.readFileSync(path.join(__dirname, 'gazetteer.js'), 'utf8');
const gz = {};
vm.runInNewContext(gazSrc, { window: gz });
const gazetteer = gz.GAZETTEER || {};
const placeKey = s => String(s || '').replace(/\s*\(\?\)\s*/g, '').split(',')[0].trim();

const yearOf = s => { const m = String(s || '').match(/(\d{4})\s*$/); return m ? +m[1] : null; };

for (const p of d.people) {
  const who = `${p.id} (${p.name})`;
  if (!CERTS.has(p.cert)) say('ERROR', `${who}: invalid cert '${p.cert}'`);
  if (!lines.has(p.line)) say('ERROR', `${who}: unknown line '${p.line}'`);
  for (const r of ['father', 'mother']) if (p[r] && !byId.has(p[r])) say('ERROR', `${who}: ${r} '${p[r]}' does not exist`);
  for (const [k, ev] of [['b', p.b], ['d', p.d]]) {
    if (!ev) continue;
    const y = yearOf(ev.date);
    if (y && ev.year !== y) say('ERROR', `${who}: ${k}.year ${ev.year} does not match date '${ev.date}'`);
    if (ev.place && !gazetteer[placeKey(ev.place)]) say('INFO', `${who}: place '${ev.place}' missing in gazetteer.js`);
  }
  if (p.b && p.d && p.b.year && p.d.year && p.d.year < p.b.year) say('ERROR', `${who}: death before birth`);
  const notes = p.notes || [];
  if (!p.d && notes.some(n => /zemřel|zemřela/i.test(n))) say('WARN', `${who}: notes mention death but field d is missing`);
  if (p.cert === 'M' && !(p.sources || []).length && !(p.scans || []).length) say('ERROR', `${who}: cert M without sources or scans`);
  if (p.cert === 'M' && /^kandidát/i.test(notes[0] || '')) say('ERROR', `${who}: cert M but first note is a candidate`);
  if (p.cert === 'K' && !/^kandidát/i.test(notes[0] || '')) say('WARN', `${who}: cert K, first note should start with "KANDIDÁT"`);
  if (new Set(notes).size !== notes.length) say('WARN', `${who}: duplicate notes`);
  for (const s of p.scans || []) if (!fs.existsSync(path.join(__dirname, s.f))) say('ERROR', `${who}: missing scan file ${s.f}`);
}

// parent/child age checks and cycles
for (const c of d.people) {
  for (const r of ['father', 'mother']) {
    const par = byId.get(c[r]);
    if (!par || !par.b || !c.b || !par.b.year || !c.b.year) continue;
    const approx = par.b.approx || c.b.approx;
    const age = c.b.year - par.b.year;
    if (!approx && age < 14) say('ERROR', `${par.id} was ${age} at birth of child ${c.id}`);
    if (!approx && r === 'mother' && age > 55) say('ERROR', `mother ${par.id} was ${age} at birth of ${c.id}`);
    if (par.d && par.d.year) {
      const tol = r === 'father' ? 1 : 0;
      if (par.d.year + tol < c.b.year) say('ERROR', `${r} ${par.id} died ${par.d.year}, before birth of ${c.id} (${c.b.year})`);
    }
  }
}
for (const p of d.people) {
  const seen = new Set();
  const stack = [p.id];
  while (stack.length) {
    const id = stack.pop();
    const q = byId.get(id);
    if (!q) continue;
    for (const r of ['father', 'mother']) {
      if (!q[r]) continue;
      if (q[r] === p.id) { say('ERROR', `cycle in ancestry through ${p.id}`); stack.length = 0; break; }
      if (!seen.has(q[r])) { seen.add(q[r]); stack.push(q[r]); }
    }
  }
}

// marriage year must agree between spouses
const marriageYear = p => yearOf((p.marriage || '').split(/[,–-]/)[0]);
for (const c of d.people) {
  const f = byId.get(c.father), m = byId.get(c.mother);
  if (f && m && marriageYear(f) && marriageYear(m) && marriageYear(f) !== marriageYear(m)) say('WARN', `marriage year differs: ${f.id} ${marriageYear(f)} vs ${m.id} ${marriageYear(m)}`);
}

for (const lvl of ['ERROR', 'WARN', 'INFO']) for (const m of out[lvl]) console.log(`${lvl}: ${m}`);
console.log(`validate: ${d.people.length} people, ${out.ERROR.length} errors, ${out.WARN.length} warnings, ${out.INFO.length} info`);
process.exit(out.ERROR.length || out.WARN.length ? 1 : 0);
