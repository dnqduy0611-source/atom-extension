#!/usr/bin/env node
/**
 * i18n Parity Check Tool
 *
 * Verifies that EN and VI locale files have matching keys and placeholders.
 * Exit code 0 = pass, non-zero = fail (CI-friendly)
 *
 * Usage: node tools/i18n/check_parity.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve paths relative to project root
const projectRoot = join(__dirname, '..', '..');
const enPath = join(projectRoot, '_locales', 'en', 'messages.json');
const viPath = join(projectRoot, '_locales', 'vi', 'messages.json');

console.log('🔍 i18n Parity Check Tool');
console.log('━'.repeat(50));

try {
  // Parse locale files
  const en = JSON.parse(readFileSync(enPath, 'utf8'));
  const vi = JSON.parse(readFileSync(viPath, 'utf8'));

  const enKeys = new Set(Object.keys(en));
  const viKeys = new Set(Object.keys(vi));

  // Check missing keys
  const missingInVi = [...enKeys].filter(k => !viKeys.has(k)).sort();
  const missingInEn = [...viKeys].filter(k => !enKeys.has(k)).sort();

  let exitCode = 0;

  // Report missing in VI
  if (missingInVi.length > 0) {
    console.error(`\n❌ Missing in VI: ${missingInVi.length} keys`);
    console.error('━'.repeat(50));

    // Group by domain for easier review
    const grouped = {};
    missingInVi.forEach(key => {
      const domain = key.split('_')[0];
      if (!grouped[domain]) grouped[domain] = [];
      grouped[domain].push(key);
    });

    Object.keys(grouped).sort().forEach(domain => {
      console.error(`\n[${domain}] - ${grouped[domain].length} keys:`);
      grouped[domain].forEach(k => console.error(`  - ${k}`));
    });

    exitCode = 1;
  }

  // Report missing in EN
  if (missingInEn.length > 0) {
    console.error(`\n❌ Missing in EN: ${missingInEn.length} keys`);
    console.error('━'.repeat(50));
    missingInEn.forEach(k => console.error(`  - ${k}`));
    exitCode = 1;
  }

  // Check placeholder mismatches
  const mismatches = [];
  Object.keys(en).forEach(key => {
    if (!vi[key]) return; // Skip missing keys (already reported)

    const enPlaceholders = en[key].placeholders
      ? Object.keys(en[key].placeholders).sort()
      : [];
    const viPlaceholders = vi[key].placeholders
      ? Object.keys(vi[key].placeholders).sort()
      : [];

    if (JSON.stringify(enPlaceholders) !== JSON.stringify(viPlaceholders)) {
      mismatches.push({
        key,
        en: enPlaceholders,
        vi: viPlaceholders
      });
    }
  });

  if (mismatches.length > 0) {
    console.error(`\n❌ Placeholder mismatches: ${mismatches.length}`);
    console.error('━'.repeat(50));
    mismatches.forEach(m => {
      console.error(`  ${m.key}:`);
      console.error(`    EN: [${m.en.join(', ')}]`);
      console.error(`    VI: [${m.vi.join(', ')}]`);
    });
    exitCode = 1;
  }

  // Success report
  if (exitCode === 0) {
    console.log('\n✅ i18n parity check PASSED');
    console.log('━'.repeat(50));
    console.log(`   EN keys: ${enKeys.size}`);
    console.log(`   VI keys: ${viKeys.size}`);
    console.log(`   Placeholder mismatches: 0`);
    console.log('');
  } else {
    console.error('\n❌ i18n parity check FAILED');
    console.error('━'.repeat(50));
    console.error(`   EN keys: ${enKeys.size}`);
    console.error(`   VI keys: ${viKeys.size}`);
    console.error(`   Missing in VI: ${missingInVi.length}`);
    console.error(`   Missing in EN: ${missingInEn.length}`);
    console.error(`   Placeholder mismatches: ${mismatches.length}`);
    console.error('');
    console.error('💡 Fix: Add missing keys to the appropriate locale file');
    console.error('');
  }

  process.exit(exitCode);

} catch (error) {
  console.error('\n❌ Error reading locale files:');
  console.error(error.message);
  console.error('');
  process.exit(1);
}
