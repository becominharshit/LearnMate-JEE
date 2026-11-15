import test from 'node:test';
import assert from 'node:assert/strict';

process.env.LEARNMATE_SKIP_AUTO_LISTEN = 'true';

const { buildAnimatedLessonPromptRequest, synthesizeAnimatedLessonSvg } = await import(
  './routes/aiTutorRoutes'
);
const { ALLOWED_GEMINI_MODELS } = await import('./coreStudyEngine');

test('buildAnimatedLessonPromptRequest uses GEMINI_MODEL_FAST and never calls retired omni model', () => {
  assert.notEqual(ALLOWED_GEMINI_MODELS.video, 'gemini-omni-1.2-flash');

  const textReq = buildAnimatedLessonPromptRequest({
    prompt: 'Wave optics interference fringes',
    aspectRatio: '16:9',
  });
  assert.equal(textReq.aspectRatio, '16:9');
  assert.notEqual(textReq.model, 'gemini-omni-1.2-flash');
  assert.equal(Array.isArray(textReq.contents.parts), true);
  assert.equal(textReq.contents.parts.length, 1);

  const imgReq = buildAnimatedLessonPromptRequest({
    prompt: 'Ray optics lens image formation',
    aspectRatio: 'invalid-ratio',
    imageBase64: 'data:image/png;base64,AAAA',
    imageMimeType: 'image/png',
  });
  assert.equal(imgReq.aspectRatio, '16:9');
  assert.equal(imgReq.contents.parts.length, 2);
  assert.equal(imgReq.contents.parts[0].inlineData.data, 'AAAA');
});

test('synthesizeAnimatedLessonSvg produces sanitized animated SVG keyframes', () => {
  const svg = synthesizeAnimatedLessonSvg({
    lessonTitle: 'Simple Harmonic Motion Phase Orbit',
    durationSec: 12,
    summary: 'Relating circular projection to sinusoidal displacement x = A sin(ωt).',
    keyframes: [
      {
        timeSec: 0,
        title: 'Mean Position',
        formula: 'x = 0, v = Aω',
        visualCue: 'Maximum kinetic energy pulse',
        caption: 'Particle passes equilibrium with peak velocity.',
      },
      {
        timeSec: 4,
        title: 'Positive Extreme',
        formula: 'x = +A, a = -ω²A',
        visualCue: 'Restoring force peaks toward center',
        caption: 'Velocity vanishes momentarily at amplitude.',
      },
    ],
  });

  assert.match(svg, /^<svg[\s\S]*<\/svg>$/i);
  assert.match(svg, /<animate/);
  assert.match(svg, /Simple Harmonic Motion Phase Orbit/);
  assert.equal(/<script/i.test(svg), false);
});
