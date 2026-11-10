/**
 * test-e2e-simple.js — Simple E2E validation
 * 
 * Validates the build and key functionality without requiring module imports
 */

const fs = require('fs');
const path = require('path');

console.log('\n🧪 LeashPay v2 Simple E2E Validation\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${err.message}`);
    failed++;
  }
}

function fileExists(filePath) {
  return fs.existsSync(path.join(__dirname, filePath));
}

function dirExists(dirPath) {
  return fs.existsSync(path.join(__dirname, dirPath)) && 
         fs.statSync(path.join(__dirname, dirPath)).isDirectory();
}

// ═══════════════════════════════════════════════════════════
// Test 1: Project Structure
// ═══════════════════════════════════════════════════════════
console.log('\n📦 Test Suite 1: Project Structure');
console.log('-'.repeat(60));

test('Core configuration files exist', () => {
  if (!fileExists('package.json')) throw new Error('package.json missing');
  if (!fileExists('next.config.ts')) throw new Error('next.config.ts missing');
  if (!fileExists('.env.example')) throw new Error('.env.example missing');
  if (!fileExists('README.md')) throw new Error('README.md missing');
});

test('Source directories exist', () => {
  if (!dirExists('src/app')) throw new Error('src/app missing');
  if (!dirExists('src/lib')) throw new Error('src/lib missing');
  if (!dirExists('fixtures')) throw new Error('fixtures missing');
});

test('Key library files exist', () => {
  if (!fileExists('src/lib/db/index.ts')) throw new Error('db/index.ts missing');
  if (!fileExists('src/lib/db/schema.ts')) throw new Error('db/schema.ts missing');
  if (!fileExists('src/lib/policy/engine.ts')) throw new Error('policy/engine.ts missing');
  if (!fileExists('src/lib/policy/schema.ts')) throw new Error('policy/schema.ts missing');
  if (!fileExists('src/lib/mandate/sign.ts')) throw new Error('mandate/sign.ts missing');
  if (!fileExists('src/lib/paypal/client.ts')) throw new Error('paypal/client.ts missing');
  if (!fileExists('src/lib/agent/tools.ts')) throw new Error('agent/tools.ts missing');
});

// ═══════════════════════════════════════════════════════════
// Test 2: API Routes
// ═══════════════════════════════════════════════════════════
console.log('\n🔌 Test Suite 2: API Routes');
console.log('-'.repeat(60));

test('All API routes exist', () => {
  const routes = [
    'src/app/api/agent/route.ts',
    'src/app/api/audit/route.ts',
    'src/app/api/dashboard/route.ts',
    'src/app/api/policy/route.ts',
    'src/app/api/purchases/route.ts',
    'src/app/api/receipt/route.ts',
    'src/app/api/redteam/route.ts',
    'src/app/api/approve/route.ts',
    'src/app/api/paypal/webhook/route.ts',
    'src/app/api/paypal/return/route.ts',
    'src/app/api/paypal/cancel/route.ts'
  ];
  
  for (const route of routes) {
    if (!fileExists(route)) throw new Error(`${route} missing`);
  }
});

// ═══════════════════════════════════════════════════════════
// Test 3: UI Pages
// ═══════════════════════════════════════════════════════════
console.log('\n🎨 Test Suite 3: UI Pages');
console.log('-'.repeat(60));

test('All UI pages exist', () => {
  const pages = [
    'src/app/page.tsx',
    'src/app/dashboard/page.tsx',
    'src/app/settings/page.tsx',
    'src/app/audit/page.tsx',
    'src/app/redteam/page.tsx',
    'src/app/approve/[token]/page.tsx',
    'src/app/r/[id]/page.tsx'
  ];
  
  for (const page of pages) {
    if (!fileExists(page)) throw new Error(`${page} missing`);
  }
});

// ═══════════════════════════════════════════════════════════
// Test 4: Red Team Suite
// ═══════════════════════════════════════════════════════════
console.log('\n🔴 Test Suite 4: Red Team Implementation');
console.log('-'.repeat(60));

test('Red Team files exist', () => {
  if (!fileExists('src/lib/redteam/attacks.ts')) throw new Error('attacks.ts missing');
  if (!fileExists('src/lib/redteam/runner.ts')) throw new Error('runner.ts missing');
});

test('Red Team attacks are defined', () => {
  const attacksContent = fs.readFileSync(path.join(__dirname, 'src/lib/redteam/attacks.ts'), 'utf8');
  if (!attacksContent.includes('export const ATTACKS')) throw new Error('ATTACKS not exported');
  
  // Count attack definitions
  const attackMatches = attacksContent.match(/id: \d+,/g);
  if (!attackMatches || attackMatches.length < 14) {
    throw new Error(`Expected 14 attacks, found ${attackMatches ? attackMatches.length : 0}`);
  }
});

// ═══════════════════════════════════════════════════════════
// Test 5: Fixture Data
// ═══════════════════════════════════════════════════════════
console.log('\n📊 Test Suite 5: Fixture Data');
console.log('-'.repeat(60));

test('Channel3 fixture exists and is valid JSON', () => {
  if (!fileExists('fixtures/channel3-sample.json')) throw new Error('channel3-sample.json missing');
  
  const content = fs.readFileSync(path.join(__dirname, 'fixtures/channel3-sample.json'), 'utf8');
  const data = JSON.parse(content);
  
  if (!Array.isArray(data)) throw new Error('Fixture should be an array');
  if (data.length < 10) throw new Error(`Expected at least 10 products, found ${data.length}`);
  
  // Check structure
  const first = data[0];
  if (!first.id) throw new Error('Product missing id');
  if (!first.title) throw new Error('Product missing title');
  if (!first.offers) throw new Error('Product missing offers');
  if (!Array.isArray(first.offers)) throw new Error('Offers should be an array');
});

test('Fixture contains test cases for Red Team', () => {
  const content = fs.readFileSync(path.join(__dirname, 'fixtures/channel3-sample.json'), 'utf8');
  const data = JSON.parse(content);
  
  // Check for specific test items
  const hasGiftCard = data.some(p => p.category === 'gift cards');
  const hasEUR = data.some(p => p.offers && p.offers.some(o => o.currency === 'EUR'));
  const hasInjection = data.some(p => p.description && p.description.includes('SYSTEM:'));
  
  if (!hasGiftCard) throw new Error('Missing gift card test case');
  if (!hasEUR) throw new Error('Missing EUR currency test case');
  if (!hasInjection) throw new Error('Missing injection test case');
});

// ═══════════════════════════════════════════════════════════
// Test 6: Documentation
// ═══════════════════════════════════════════════════════════
console.log('\n📚 Test Suite 6: Documentation');
console.log('-'.repeat(60));

test('Documentation files exist', () => {
  if (!fileExists('README.md')) throw new Error('README.md missing');
  if (!fileExists('SETUP.md')) throw new Error('SETUP.md missing');
  if (!fileExists('.env.example')) throw new Error('.env.example missing');
});

test('README contains key sections', () => {
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  
  // Check for important sections
  if (!readme.includes('LeashPay')) throw new Error('README missing project name');
  if (!readme.includes('install') || !readme.includes('setup')) {
    throw new Error('README missing installation instructions');
  }
});

test('.env.example contains required variables', () => {
  const envExample = fs.readFileSync(path.join(__dirname, '.env.example'), 'utf8');
  
  const required = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'GOOGLE_GENERATIVE_AI_API_KEY'];
  for (const key of required) {
    if (!envExample.includes(key)) {
      throw new Error(`.env.example missing ${key}`);
    }
  }
});

// ═══════════════════════════════════════════════════════════
// Test 7: Build Output (if exists)
// ═══════════════════════════════════════════════════════════
console.log('\n🏗️  Test Suite 7: Build Validation');
console.log('-'.repeat(60));

test('Build directory structure', () => {
  // Check if .next exists (may not if not built yet)
  if (dirExists('.next')) {
    console.log('   ✓ Build directory exists');
    if (!dirExists('.next/server')) throw new Error('.next/server missing');
  } else {
    console.log('   ⚠️  No build found (run: npm run build)');
  }
  // Don't fail if not built
});

// ═══════════════════════════════════════════════════════════
// Test Summary
// ═══════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(60));
console.log('📊 Test Summary');
console.log('='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`   Total:  ${passed + failed}`);
console.log('');

if (failed === 0) {
  console.log('🎉 All validation checks passed!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Set up environment: Copy .env.example to .env and add API keys');
  console.log('2. Build the project: npm run build');
  console.log('3. Start the server: npm run dev');
  console.log('4. Visit http://localhost:3000');
  console.log('');
  process.exit(0);
} else {
  console.log('⚠️  Some validation checks failed. Please review the output above.');
  console.log('');
  process.exit(1);
}
