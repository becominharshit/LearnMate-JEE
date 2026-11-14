import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  ALLOWED_GEMINI_MODELS,
  buildThinkingFallbackChain,
  generateWithModelFallback,
  getModelRoutingConfig,
  resolveConfiguredModel,
} from './coreStudyEngine';
import { resolveServerAnswerKey } from './data/authoritativeAnswerKeys';
import { OFFICIAL_PAPERS_LIST } from '../data/jeeInitialContent';
import { getApiBaseUrl, getWsBaseUrl, apiUrl, wsUrl } from '../config/apiConfig';

test('generateWithModelFallback cascades gemini-3.8-flash -> gemini-3.6-flash -> gemini-3.5-flash-lite on 404 and 429', async () => {
  const attempts: string[] = [];
  const res = await generateWithModelFallback(
    ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
    async (model) => {
      attempts.push(model);
      if (model === 'gemini-3.8-flash') {
        const err: any = new Error('404 model unavailable');
        err.status = 404;
        throw err;
      }
      if (model === 'gemini-3.6-flash') {
        const err: any = new Error('429 RESOURCE_EXHAUSTED');
        err.status = 429;
        throw err;
      }
      return { text: 'ok' };
    }
  );

  assert.deepEqual(attempts, ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']);
  assert.equal(res.modelUsed, 'gemini-3.5-flash-lite');
  assert.equal(res.fallbackUsed, true);
  assert.deepEqual(res.result, { text: 'ok' });
});

test('generateWithModelFallback returns clean diagnostic error when all models fail', async () => {
  await assert.rejects(
    async () =>
      generateWithModelFallback(['gemini-3.8-flash', 'gemini-3.6-flash'], async (model) => {
        const err: any = new Error(`rate limited on ${model}`);
        err.status = 429;
        throw err;
      }),
    /All configured Gemini models failed \(gemini-3\.8-flash -> gemini-3\.6-flash\)/
  );
});

test('Model routing defaults and legacy blocking work as expected', () => {
  assert.equal(ALLOWED_GEMINI_MODELS.fast, 'gemini-3.5-flash-lite');
  assert.equal(ALLOWED_GEMINI_MODELS.thinking, 'gemini-3.8-flash');
  assert.equal(ALLOWED_GEMINI_MODELS.analyze, 'gemini-3.8-flash');
  assert.equal(ALLOWED_GEMINI_MODELS.live, 'gemini-3.8-live');

  assert.equal(resolveConfiguredModel('gemini-2.5-flash', ALLOWED_GEMINI_MODELS.fast), 'gemini-3.5-flash-lite');
  assert.equal(resolveConfiguredModel('gemini-1.5-pro', ALLOWED_GEMINI_MODELS.thinking), 'gemini-3.8-flash');

  const cfg = getModelRoutingConfig();
  assert.ok(cfg.fast);
  assert.ok(cfg.thinking);
  assert.ok(cfg.analyze);
  assert.ok(cfg.live);

  const chain = buildThinkingFallbackChain('gemini-3.8-flash');
  assert.deepEqual(chain, ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']);
});

test('apiConfig resolves Vercel proxy default, explicit VITE_API_BASE_URL, and VITE_WS_BASE_URL', () => {
  assert.equal(getApiBaseUrl({}), '');
  assert.equal(apiUrl('/api/health', {}), '/api/health');
  assert.equal(
    apiUrl('/api/health', { VITE_API_BASE_URL: 'https://learnmate-api.onrender.com/' }),
    'https://learnmate-api.onrender.com/api/health'
  );
  assert.equal(
    wsUrl('/api/live', { VITE_WS_BASE_URL: 'wss://learnmate-api.onrender.com/' }),
    'wss://learnmate-api.onrender.com/api/live'
  );
  assert.equal(
    getWsBaseUrl({}, { protocol: 'https:', host: 'learnmate.vercel.app' }),
    'wss://learnmate.vercel.app'
  );
});

test('Expanded 2020–2026 PYQ corpus has 20+ shift papers and every pack question has a server key', () => {
  assert.ok(
    OFFICIAL_PAPERS_LIST.length >= 20,
    `Expected >= 20 official papers, got ${OFFICIAL_PAPERS_LIST.length}`
  );
  const years = new Set(OFFICIAL_PAPERS_LIST.map((p) => p.year));
  for (const y of ['2020', '2021', '2022', '2023', '2024', '2025', '2026']) {
    assert.ok(years.has(y), `Missing official papers for year ${y}`);
  }

  const packsDir = path.resolve(process.cwd(), 'public', 'pyq-packs');
  for (const filename of ['jee-main-shifts.json', 'jee-advanced-papers.json']) {
    const parsed = JSON.parse(fs.readFileSync(path.join(packsDir, filename), 'utf-8'));
    assert.ok(Array.isArray(parsed.questions) && parsed.questions.length > 0);
    for (const q of parsed.questions) {
      const serverKey = resolveServerAnswerKey(q.id);
      assert.ok(serverKey !== null, `Missing server authoritative key for ${q.id} in ${filename}`);
    }
  }
});
