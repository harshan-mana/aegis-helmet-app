// AEGIS AI — regression smoke tests.
//
// Dependency-free: uses only Node's built-in `node:test` / `node:assert`, so no
// packages are added and the suite runs anywhere Node 18+ is available
// (including the GitHub Actions runner, which has Node 20).
//
// These tests are STATIC: they read the source files and assert the invariants
// that keep the app from rendering blank and keep authentication correct.
// They are a regression gate for the failure modes that have actually occurred:
//   - Pages reverting to "legacy" and serving raw ./src/main.tsx
//   - a missing export / unresolved import from an edit
//   - an automatic sign-out on refresh
//   - the app deciding to show login before Firebase has resolved

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSyncSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const ROOT = resolve(SRC, '..');

const read = (p) => readFileSync(p, 'utf8');
const src = (p) => read(join(SRC, p));

function collectExports(text) {
  const names = new Set();
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('export ')) continue;
    const rest = t.slice(7).trim();
    if (rest.startsWith('{')) {
      const inner = rest.slice(1);
      const idx = inner.indexOf('}');
      if (idx < 0) continue;
      for (const part of inner.slice(0, idx).split(',')) {
        const p = part.trim();
        if (p) names.add((p.split(/\s+as\s+/).pop() || '').trim());
      }
    } else if (/^(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/.test(rest)) {
      names.add(rest.match(/^(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/)[1]);
    }
  }
  return names;
}

const EXTERNAL = new Set([
  'react','react-dom','react/jsx-runtime','react-dom/client','firebase/auth','firebase/firestore',
  'firebase/app','firebase/analytics','firebase/storage','firebase/messaging','firebase/performance',
  'firebase/functions','firebase/database','firebase/remote-config','firebase/installations',
  'firebase/app-check','firebase/vertexai','motion/react','lucide-react','@radix-ui/react-dialog',
  '@tensorflow/tfjs','@tensorflow/tfjs-converter','@tensorflow-models/coco-ssd','recharts',
  'clsx','tailwind-merge','@google/genai','react-markdown','dotenv',
]);

function auditImports() {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSyncSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx|ts)$/.test(e.name)) files.push(p);
    }
  };
  walk(SRC);

  const exportMap = new Map();
  for (const f of files) exportMap.set(f, collectExports(read(f)));

  const problems = [];
  for (const f of files) {
    const base = dirname(f);
    for (const line of read(f).split('\n')) {
      const t = line.trim();
      if (!t.startsWith('import ') || !t.includes(' from ')) continue;
      const idx = t.lastIndexOf(' from ');
      const clause = t.slice(5, idx).trim();
      const path = t.slice(idx + 6).trim().replace(/;$/, '').replace(/^['"]|['"]$/g, '');
      if ([...EXTERNAL].some((e) => path === e || path.startsWith(e + '/'))) continue;
      if (path.startsWith('./firebase-applet-config.json') || path.startsWith('../..')) continue;

      const resolved = resolve(base, path);
      const found = ['.tsx', '.ts', '/index.tsx', '/index.ts']
        .map((x) => resolved + x).find((c) => existsSync(c));
      if (!found) { problems.push(`unresolved import: ${f} -> ${path}`); continue; }

      if (clause.startsWith('{')) {
        const inner = clause.replace(/^\{/, '').replace(/\}$/, '');
        for (const part of inner.split(',')) {
          const p = (part.trim().split(/\s+as\s+/).pop() || '').trim();
          if (!p || p === 'type') continue;
          if (!exportMap.get(found).has(p)) {
            problems.push(`missing export: ${p} (imported by ${f} from ${path})`);
          }
        }
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// 1. Blank-page protection
// ---------------------------------------------------------------------------
test('index.html keeps the Vite module entry (rewritten to the built bundle at build time)', () => {
  const html = read(join(ROOT, 'index.html'));
  assert.ok(html.includes('<script type="module" src="./src/main.tsx"></script>'),
    'index.html must keep the Vite module entry, which Vite rewrites to the built bundle');
});

test('index.html contains a boot guard so a failed bundle shows a recovery screen', () => {
  const html = read(join(ROOT, 'index.html'));
  assert.ok(html.includes('__aegisBootGuard'), 'boot guard hook must be installed');
  assert.ok(/<script>\s*\(function/.test(html), 'boot guard must be a CLASSIC script so it runs even if the module bundle fails');
});

test('main.tsx defensively creates #root and routes failures to the guard', () => {
  const m = src('main.tsx');
  assert.ok(m.includes("getElementById('root')"), 'must resolve #root');
  assert.ok(m.includes('createElement'), 'must create #root if missing rather than throw');
  assert.ok(m.includes('unhandledrejection'), 'must handle unhandled promise rejections');
  assert.ok(m.includes('createRoot'), 'must mount React');
});

// ---------------------------------------------------------------------------
// 2. Authentication: refresh persistence
// ---------------------------------------------------------------------------
test('Firebase uses browserLocalPersistence on a single Auth instance', () => {
  const fb = src('lib/firebase.ts');
  assert.ok(fb.includes('browserLocalPersistence'), 'must use browserLocalPersistence');
  assert.ok(fb.includes('setPersistence(auth, browserLocalPersistence)'),
    'persistence must be set on the exported auth instance');
  assert.ok(fb.includes('getApps()'), 'must guard against a duplicate Firebase App (two Auth instances)');
  assert.ok(!/initializeApp\(firebaseConfig\)\s*\n\s*initializeApp/.test(fb),
    'must not call initializeApp twice');
});

test('sign-in awaits persistence readiness before signing in', () => {
  const am = src('components/AuthModal.tsx');
  const aw = (am.match(/await authPersistenceReady;/g) || []).length;
  const popups = (am.match(/signInWithPopup\(/g) || []).length;
  assert.ok(popups >= 2, 'expected Google + Apple popup sign-ins');
  assert.equal(aw, popups + 1,
    `every sign-in path must await authPersistenceReady (${aw}/${popups + 1})`);
});

// ---------------------------------------------------------------------------
// 3. Authentication: no automatic sign-out
// ---------------------------------------------------------------------------
test('exactly one auth.signOut(), inside the explicit Sign Out handler', () => {
  const ap = src('App.tsx');
  const signOuts = ap.match(/await auth\.signOut\(\);/g) || [];
  assert.equal(signOuts.length, 1, 'only the explicit Sign Out may call auth.signOut()');
  assert.ok(ap.includes('const handleSignOut = async () => {'), 'sign-out must live in a named handler');
  assert.ok(!ap.includes('SESSION_MAX_AGE_MS'), 'no time-based automatic sign-out');
});

test('landing screen is derived from the resolved session, not guessed at mount', () => {
  const ap = src('App.tsx');
  assert.ok(ap.includes('const showLanding = authResolved ? !effectiveUser : true;'),
    'landing must be derived from the resolved auth state');
  assert.ok(!ap.includes('setShowLanding'), 'no stale mount-time landing state');
  assert.ok(ap.includes('setAuthResolved(true)'), 'the auth listener must mark auth as resolved');
});

test('no beforeunload / unload / visibility-triggered sign-out', () => {
  const ap = src('App.tsx');
  assert.ok(!ap.includes('beforeunload'), 'beforeunload also fires on refresh - must not sign out');
  assert.ok(!ap.includes("'unload'"), 'unload also fires on refresh - must not sign out');
  assert.ok(!ap.includes('visibilitychange'), 'visibility change must not sign out');
});

// ---------------------------------------------------------------------------
// 4. Optional features cannot crash the app
// ---------------------------------------------------------------------------
test('camera and AI model failures are contained, not fatal', () => {
  const dv = src('components/DashboardView.tsx');
  assert.ok(dv.includes("err?.name === 'NotAllowedError'"), 'camera denial must be handled');
  assert.ok(dv.includes('setWebcamError'), 'camera errors must surface to state, not throw');
  assert.ok(dv.includes('loadDedicatedModel'), 'dedicated model must be lazy-loaded');
  assert.ok(/modelError|setModelError/.test(dv), 'model failure must set an error state');
});

test('welcome toast auto-dismisses in its own effect', () => {
  const ap = src('App.tsx');
  assert.ok(ap.includes('}, [greeting]);'), 'toast dismissal must be a dedicated effect');
  assert.ok(/setTimeout\(\(\) => setGreeting\(null\), 3000\)/.test(ap), 'toast must dismiss after ~3s');
});

// ---------------------------------------------------------------------------
// 5. Import / export integrity (catches blank pages from bad edits)
// ---------------------------------------------------------------------------
test('every relative import resolves and every named export exists', () => {
  const problems = auditImports();
  assert.deepEqual(problems, [], `import/export problems:\n${problems.join('\n')}`);
});

// ---------------------------------------------------------------------------
// 6. Feature preservation
// ---------------------------------------------------------------------------
test('core AEGIS features are still present', () => {
  const checks = [
    ['lib/firebase.ts', 'onAuthStateChanged'],
    ['components/AuthModal.tsx', "prompt: 'select_account'"],
    ['components/DashboardView.tsx', 'detectCanvasRef'],
    ['utils/violationVerification.ts', 'verifyCandidate'],
    ['utils/vehicleClassification.ts', 'classifyRegionsWithDedicatedModel'],
    ['utils/violationStorage.ts', 'updateViolation'],
    ['components/AegisNavbar.tsx', 'onShieldPointerUp'],
    ['components/ErrorBoundary.tsx', 'getDerivedStateFromError'],
  ];
  for (const [file, token] of checks) {
    assert.ok(src(file).includes(token), `${file} lost ${token}`);
  }
});
