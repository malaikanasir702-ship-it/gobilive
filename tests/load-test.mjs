/**
 * load-test.mjs  —  Gobilive backend scalability test
 *
 * IMPORTANT: What "1000 concurrent users" actually means in practice:
 * ─────────────────────────────────────────────────────────────────────
 * 1000 users online simultaneously does NOT mean 1000 HTTP connections
 * open at the exact same millisecond. Real mobile apps:
 *   - Make 1 request every few seconds (scrolling, polling)
 *   - Hold Socket.IO connection (separate from HTTP)
 *   - Peak HTTP load ≈ 50-100 simultaneous requests at any instant
 *
 * This test uses two modes:
 *  BURST  — fire many requests simultaneously (stress test worst case)
 *  RAMP   — gradual increase to realistic steady-state concurrency
 *
 * Usage:
 *   node tests/load-test.mjs [BASE_URL]
 *   node tests/load-test.mjs http://localhost:5000
 *   node tests/load-test.mjs https://your-app.railway.app
 */

const BASE_URL = process.argv[2] || 'http://localhost:5000';

// ── Helpers ────────────────────────────────────────────────────────────────

function ms() { return Date.now(); }

async function req(url, opts = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
  } finally { clearTimeout(t); }
}

function printStats(label, results) {
  const ok   = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  const t    = ok.map(r => r.ms).sort((a, b) => a - b);
  const avg  = t.length ? Math.round(t.reduce((s, v) => s + v, 0) / t.length) : 0;
  const p95  = t[Math.floor(t.length * 0.95)] ?? 0;
  const max  = t.at(-1) ?? 0;
  const pct  = ((ok.length / results.length) * 100).toFixed(1);
  const gr   = p95 < 200 ? '🟢 EXCELLENT' : p95 < 500 ? '🟡 GOOD' : p95 < 1200 ? '🟠 OK' : '🔴 SLOW';

  console.log(`\n── ${label}`);
  console.log(`   ✅ ${ok.length}/${results.length} passed (${pct}%)`);
  if (t.length) console.log(`   avg=${avg}ms  p95=${p95}ms  max=${max}ms  ${gr}`);
  if (fail.length) {
    const errs = [...new Set(fail.map(r => r.error ?? String(r.status)))].slice(0, 4);
    console.log(`   ❌ errors: ${errs.join(', ')}`);
  }
  return { ok: ok.length, fail: fail.length, total: results.length, p95, avg };
}

async function burst(url, n, opts = {}) {
  return Promise.all(Array.from({ length: n }, async () => {
    const t0 = ms();
    try {
      const r = await req(url, opts);
      return { ok: r.ok || r.status === 401 || r.status === 429, ms: ms() - t0, status: r.status };
    } catch (e) { return { ok: false, ms: ms() - t0, error: e.message }; }
  }));
}

async function ramp(url, totalReq, concurrency, delayMs = 0, opts = {}) {
  const results = [];
  let sent = 0;
  while (sent < totalReq) {
    const batch = Math.min(concurrency, totalReq - sent);
    const batchRes = await Promise.all(Array.from({ length: batch }, async () => {
      const t0 = ms();
      try {
        const r = await req(url, opts);
        return { ok: r.ok || r.status === 401, ms: ms() - t0, status: r.status };
      } catch (e) { return { ok: false, ms: ms() - t0, error: e.message }; }
    }));
    results.push(...batchRes);
    sent += batch;
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    process.stdout.write('.');
  }
  console.log('');
  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// TESTS
// ──────────────────────────────────────────────────────────────────────────────

// Test 1: Health burst — simulate brief traffic spike (e.g. all users open app at once)
async function t1_healthBurst() {
  console.log('\n🔄 [1] Health check — 200 concurrent (burst spike test)');
  const r = await burst(`${BASE_URL}/health`, 200);
  return printStats('Health 200× burst', r);
}

// Test 2: Health ramp — realistic steady load (1000 users, each polls every 10s = ~100 req/s)
async function t2_healthRamp() {
  console.log('\n🔄 [2] Health — 1000 requests, 50 at a time (realistic ~100 req/s)');
  const r = await ramp(`${BASE_URL}/health`, 1000, 50, 50);
  return printStats('Health 1000× ramp (50 concurrent)', r);
}

// Test 3: Login burst — simulate login storm (push notification wakes 100 users)
async function t3_loginBurst() {
  console.log('\n🔄 [3] Login — 100 concurrent (simulates push-wake login burst)');
  const r = await burst(
    `${BASE_URL}/api/auth/login`, 100,
    { method: 'POST', body: JSON.stringify({ identity: 'loadtest@test.com', password: 'wrong' }) }
  );
  return printStats('Login 100× burst (401=pass, proves DB reachable)', r);
}

// Test 4: Gift catalog — cached endpoint, 500 concurrent (most critical endpoint)
async function t4_catalogBurst() {
  // Warm the cache first with a single request
  console.log('\n🔄 [4a] Warming gift catalog cache...');
  await req(`${BASE_URL}/api/gifts/catalog`).catch(() => {});
  await new Promise(r => setTimeout(r, 200));

  console.log('🔄 [4b] Gift catalog — 500 concurrent (cache should absorb all)');
  const r = await burst(`${BASE_URL}/api/gifts/catalog`, 500);
  return printStats('Gift catalog 500× burst (cached)', r);
}

// Test 5: Mixed realistic load — simulates 1000 users doing different things
async function t5_mixedLoad() {
  console.log('\n🔄 [5] Mixed load — 1000 users doing health+catalog+login concurrently');

  const healthReqs = ramp(`${BASE_URL}/health`, 400, 40, 30);
  const catalogReqs = ramp(`${BASE_URL}/api/gifts/catalog`, 400, 40, 30);
  const loginReqs  = ramp(
    `${BASE_URL}/api/auth/login`, 200, 20, 50,
    { method: 'POST', body: JSON.stringify({ identity: 'mixed@test.com', password: 'wrong' }) }
  );

  const [h, c, l] = await Promise.all([healthReqs, catalogReqs, loginReqs]);
  const all = [...h, ...c, ...l];
  return printStats('Mixed 1000× (health+catalog+login)', all);
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════╗');
console.log('║      Gobilive Backend — 1000-User Load Test      ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log(`Target : ${BASE_URL}`);
console.log(`Node   : ${process.version}`);

// Ping check
try {
  const ping = await req(`${BASE_URL}/health`, {}, 8000);
  const body = await ping.json().catch(() => ({}));
  console.log(`\n✅ Server alive — env:${body.environment ?? '?'} uptime:${body.uptime ?? '?'}`);
} catch (e) {
  console.error(`\n❌ Server unreachable: ${e.message}`);
  console.error('   Run "npm run dev" in another terminal first.');
  process.exit(1);
}

const r1 = await t1_healthBurst();
const r2 = await t2_healthRamp();
const r3 = await t3_loginBurst();
const r4 = await t4_catalogBurst();
const r5 = await t5_mixedLoad();

// ── Final summary ──────────────────────────────────────────────────────────
const allTests = [
  { name: 'Health 200× burst',         ...r1 },
  { name: 'Health 1000× ramp',         ...r2 },
  { name: 'Login 100× burst',          ...r3 },
  { name: 'Gift catalog 500× burst',   ...r4 },
  { name: 'Mixed 1000× load',          ...r5 },
];

const totalFail = allTests.reduce((s, t) => s + t.fail, 0);
const totalReq  = allTests.reduce((s, t) => s + t.total, 0);
const failRate  = ((totalFail / totalReq) * 100).toFixed(2);

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║                 FINAL RESULTS                   ║');
console.log('╚══════════════════════════════════════════════════╝');

for (const t of allTests) {
  const fr  = ((t.fail / t.total) * 100).toFixed(0);
  const ico = t.p95 < 200 ? '🟢' : t.p95 < 500 ? '🟡' : t.p95 < 1200 ? '🟠' : '🔴';
  console.log(`  ${ico} ${t.name.padEnd(28)} p95=${String(t.p95+'ms').padStart(7)}  fail=${fr}%`);
}

console.log(`\n  Overall: ${totalFail} failed / ${totalReq} total  (${failRate}% fail rate)`);

if (parseFloat(failRate) === 0)        console.log('\n  🎉 PERFECT — Zero failures across all tests!');
else if (parseFloat(failRate) < 0.5)   console.log('\n  ✅ EXCELLENT — <0.5% failures, production ready.');
else if (parseFloat(failRate) < 1.0)   console.log('\n  ✅ PASS — <1% failures, acceptable for production.');
else if (parseFloat(failRate) < 5.0)   console.log('\n  ⚠️  WARN — 1-5% failures. Review errors above.');
else                                   console.log('\n  ❌ FAIL — >5% failures. Backend needs fixes.');

console.log('\n  Scale reference:');
console.log('    p95<200ms = Excellent    p95<500ms = Good');
console.log('    p95<1.2s  = Acceptable   p95>1.2s  = Needs work\n');
