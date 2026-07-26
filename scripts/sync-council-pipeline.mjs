import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { councilDirectory } from '../src/lib/council-directory.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'operations/councils/pipeline.csv');
const columns = [
  'lad_code',
  'council',
  'country',
  'provider_id',
  'collection_source_status',
  'commercial_stage',
  'priority',
  'contact_name',
  'contact_role',
  'contact_email',
  'last_contacted',
  'next_action_date',
  'next_action',
  'notes',
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function existingRows(text) {
  const [headings = [], ...rows] = parseCsv(text);
  return new Map(rows.filter((row) => row.length).map((row) => {
    const record = Object.fromEntries(headings.map((heading, index) => [heading, row[index] ?? '']));
    return [record.lad_code, record];
  }));
}

function csvField(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

let previous = new Map();
try {
  previous = existingRows(await readFile(outputPath, 'utf8'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const records = councilDirectory.map((council) => {
  const preserved = previous.get(council.code) ?? {};
  return {
    ...preserved,
    lad_code: council.code,
    council: council.name,
    country: council.country,
    provider_id: council.providerId,
    collection_source_status: preserved.collection_source_status
      || (council.code === 'E08000011' ? 'live-direct' : 'nationwide-routing-unverified'),
    commercial_stage: preserved.commercial_stage || 'not-contacted',
    priority: preserved.priority || '',
    contact_name: preserved.contact_name || '',
    contact_role: preserved.contact_role || '',
    contact_email: preserved.contact_email || '',
    last_contacted: preserved.last_contacted || '',
    next_action_date: preserved.next_action_date || '',
    next_action: preserved.next_action || '',
    notes: preserved.notes || '',
  };
});

const csv = [
  columns.join(','),
  ...records.map((record) => columns.map((column) => csvField(record[column])).join(',')),
  '',
].join('\n');

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, csv, 'utf8');
console.log(`Synced ${records.length} councils to ${outputPath}`);
