/**
 * test-core.js - Test database initialization and policy engine
 * Run with: node test-core.js
 */

const { getDb, getUser, getPolicyConfig, createAuditLog, getLedgerState } = require('./src/lib/db/index.ts');
const { evaluate } = require('./src/lib/policy/engine.ts');
const { DEFAULT_POLICY } = require('./src/lib/policy/schema.ts');
const { verifyChain, chainRow, sha256, canonical } = require('./src/lib/mandate/sign.ts');

console.log('🧪 Testing LeashPay Core Components\n');

try {
  // Test 1: Database Initialization
  console.log('1️⃣ Testing Database Initialization...');
  const db = getDb();
  console.log('   ✅ Database connected');

  // Test 2: User and Policy
  console.log('\n2️⃣ Testing User and Policy...');
  const user = getUser('demo-user-1');
  if (!user) throw new Error('Demo user not found');
  console.log(`   ✅ User found: ${user.name} (${user.email})`);

  const policy = getPolicyConfig('demo-user-1');
  console.log(`   ✅ Policy loaded: Monthly budget $${policy.monthlyBudget / 100}`);

  // Test 3: Policy Engine - ALLOW scenario
  console.log('\n3️⃣ Testing Policy Engine - ALLOW scenario...');
  const ledger = getLedgerState('demo-user-1');
  const allowRequest = {
    productId: 'test-prod-1',
    offerId: 'test-offer-1',
    title: 'Test Product Under Limit',
    merchant: 'bestbuy.com',
    category: 'electronics',
    amountCents: 1500, // $15
    currency: 'USD',
    inStock: true,
    priceHistoryAvgCents: null,
    agentProfileId: null,
  };
  
  const allowResult = evaluate(allowRequest, policy, ledger);
  console.log(`   Decision: ${allowResult.decision}`);
  console.log(`   Reasons: ${allowResult.reasons.join(', ')}`);
  console.log(`   Risk Score: ${allowResult.riskScore}/100`);
  if (allowResult.decision === 'ALLOW') {
    console.log('   ✅ ALLOW decision correct for low-value purchase');
  } else {
    throw new Error('Expected ALLOW but got ' + allowResult.decision);
  }

  // Test 4: Policy Engine - REQUIRE_APPROVAL scenario
  console.log('\n4️⃣ Testing Policy Engine - REQUIRE_APPROVAL scenario...');
  const approvalRequest = {
    productId: 'test-prod-2',
    offerId: 'test-offer-2',
    title: 'Expensive Item Needs Approval',
    merchant: 'bestbuy.com',
    category: 'electronics',
    amountCents: 15000, // $150
    currency: 'USD',
    inStock: true,
    priceHistoryAvgCents: null,
    agentProfileId: null,
  };
  
  const approvalResult = evaluate(approvalRequest, policy, ledger);
  console.log(`   Decision: ${approvalResult.decision}`);
  console.log(`   Reasons: ${approvalResult.reasons.join(', ')}`);
  console.log(`   Risk Score: ${approvalResult.riskScore}/100`);
  if (approvalResult.decision === 'REQUIRE_APPROVAL') {
    console.log('   ✅ REQUIRE_APPROVAL decision correct for high-value purchase');
  } else {
    throw new Error('Expected REQUIRE_APPROVAL but got ' + approvalResult.decision);
  }

  // Test 5: Policy Engine - DENY scenario (blocked merchant)
  console.log('\n5️⃣ Testing Policy Engine - DENY scenario (blocked category)...');
  const denyRequest = {
    productId: 'test-prod-3',
    offerId: 'test-offer-3',
    title: 'Gift Card Should Be Blocked',
    merchant: 'bestbuy.com',
    category: 'gift cards',
    amountCents: 5000, // $50
    currency: 'USD',
    inStock: true,
    priceHistoryAvgCents: null,
    agentProfileId: null,
  };
  
  const denyResult = evaluate(denyRequest, policy, ledger);
  console.log(`   Decision: ${denyResult.decision}`);
  console.log(`   Reasons: ${denyResult.reasons.join(', ')}`);
  if (denyResult.decision === 'DENY' && denyResult.reasons[0].includes('gift cards')) {
    console.log('   ✅ DENY decision correct for blocked category');
  } else {
    throw new Error('Expected DENY for blocked category');
  }

  // Test 6: Audit Log with Hash Chain
  console.log('\n6️⃣ Testing Audit Log with Hash Chain...');
  const audit1 = createAuditLog({
    userId: 'demo-user-1',
    actor: 'SYSTEM',
    eventType: 'TEST',
    summary: 'Test audit entry 1',
    detailJson: { test: true },
  });
  console.log(`   ✅ Audit log created with hash: ${audit1.row_hash.substring(0, 16)}...`);

  const audit2 = createAuditLog({
    userId: 'demo-user-1',
    actor: 'SYSTEM',
    eventType: 'TEST',
    summary: 'Test audit entry 2',
    detailJson: { test: true },
  });
  console.log(`   ✅ Second entry chained: ${audit2.row_hash.substring(0, 16)}...`);
  
  if (audit2.prev_hash === audit1.row_hash) {
    console.log('   ✅ Hash chain correctly links entries');
  } else {
    throw new Error('Hash chain broken');
  }

  // Test 7: Hash Chain Verification
  console.log('\n7️⃣ Testing Hash Chain Verification...');
  const testChain = [
    { id: '1', data: 'first', prevHash: 'genesis', rowHash: '' },
    { id: '2', data: 'second', prevHash: '', rowHash: '' },
    { id: '3', data: 'third', prevHash: '', rowHash: '' },
  ];
  
  // Build the chain
  testChain[0].rowHash = sha256('genesis' + canonical({ id: '1', data: 'first' }));
  testChain[1].prevHash = testChain[0].rowHash;
  testChain[1].rowHash = sha256(testChain[1].prevHash + canonical({ id: '2', data: 'second' }));
  testChain[2].prevHash = testChain[1].rowHash;
  testChain[2].rowHash = sha256(testChain[2].prevHash + canonical({ id: '3', data: 'third' }));
  
  const verifyResult = verifyChain(testChain);
  if (verifyResult.valid) {
    console.log('   ✅ Chain verification passed');
  } else {
    throw new Error('Chain verification failed at index ' + verifyResult.brokenAt);
  }

  // Test 8: Tamper Detection
  console.log('\n8️⃣ Testing Tamper Detection...');
  const tamperedChain = JSON.parse(JSON.stringify(testChain));
  tamperedChain[1].data = 'TAMPERED';  // Alter the data
  const tamperedResult = verifyChain(tamperedChain);
  if (!tamperedResult.valid && tamperedResult.brokenAt === 1) {
    console.log('   ✅ Tampering correctly detected at row 1');
  } else {
    throw new Error('Tamper detection failed');
  }

  // Test 9: Money Math (integer cents)
  console.log('\n9️⃣ Testing Money Math...');
  const { toCents, toDollars, formatUSD, addCents } = require('./src/lib/money.ts');
  const cents1 = toCents(19.99);
  const cents2 = toCents(5.01);
  const sum = addCents(cents1, cents2);
  const formatted = formatUSD(sum);
  
  if (cents1 === 1999 && cents2 === 501 && sum === 2500 && formatted === '$25.00') {
    console.log(`   ✅ Money math: $19.99 + $5.01 = ${formatted}`);
  } else {
    throw new Error('Money math incorrect');
  }

  console.log('\n✨ All Core Tests Passed!\n');
  console.log('Summary:');
  console.log('  ✅ Database initialization and seeding');
  console.log('  ✅ Policy engine (ALLOW/REQUIRE_APPROVAL/DENY)');
  console.log('  ✅ Audit log with hash chaining');
  console.log('  ✅ Chain verification and tamper detection');
  console.log('  ✅ Integer-cents money math');
  console.log('\n🎯 Core foundation is solid. Ready for integration work!\n');

} catch (error) {
  console.error('\n❌ Test Failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
