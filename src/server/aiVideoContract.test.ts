import test from 'node:test';
import assert from 'node:assert/strict';

process.env.LEARNMATE_SKIP_AUTO_LISTEN = 'true';

const {
  buildAnimatedLessonPromptRequest,
  synthesizeAnimatedLessonSvg,
  normalizeSvgMathLabels,
  buildLanguageInstruction,
  buildSocraticActionRule,
} = await import('./routes/aiTutorRoutes');
const { resolveLiveVoicePersonaConfig } = await import('./ws/voiceLiveServer');
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

test('synthesizeAnimatedLessonSvg strips raw LaTeX backslashes and produces sanitized animated SVG', () => {
  assert.equal(
    normalizeSvgMathLabels('$f \\le \\mu mg \\cos\\theta + \\frac{1}{2}$'),
    'f ≤ μ mg cosθ + (1)/(2)'
  );

  const svg = synthesizeAnimatedLessonSvg({
    lessonTitle: 'Block on Incline: $\\theta$ Equilibrium',
    durationSec: 12,
    summary: 'Condition $f \\le \\mu N$ governs static equilibrium.',
    keyframes: [
      {
        timeSec: 0,
        title: 'Normal Force',
        formula: 'N = mg\\cos\\theta',
        visualCue: 'Perpendicular reaction vector',
        caption: 'Resolve weight normal to the plane.',
      },
      {
        timeSec: 4,
        title: 'Friction Limit',
        formula: 'f \\le \\mu N',
        visualCue: 'Static friction cap',
        caption: 'Prevent slipping below threshold angle.',
      },
    ],
  });

  assert.match(svg, /^<svg[\s\S]*<\/svg>$/i);
  assert.match(svg, /<animate/);
  assert.equal(/\\cos|\\le|\\mu|\\frac/.test(svg), false);
  assert.match(svg, /mgcosθ|cosθ|≤/);
  assert.equal(/<script/i.test(svg), false);
});

test('Socratic Hint 1 anti-spoiler and Live Voice persona configs enforce strict separation', () => {
  const hint1Rule = buildSocraticActionRule(1, 'explain', true);
  assert.match(hint1Rule, /1 to 2 concise sentences/i);
  assert.match(hint1Rule, /NEVER show derivation steps/i);
  assert.match(hint1Rule, /NEVER reveal the final/i);

  const hindiLang = buildLanguageInstruction('Pure Hindi', 'pure_hindi');
  const hinglishLang = buildLanguageInstruction('Hinglish', 'hinglish_faculty');
  const englishLang = buildLanguageInstruction('English', 'pure_english');
  assert.match(hindiLang, /Devanagari/);
  assert.match(hinglishLang, /Hinglish/i);
  assert.match(englishLang, /PURE ENGLISH/);

  const hindiPersona = resolveLiveVoicePersonaConfig('pure_hindi');
  const indianEnPersona = resolveLiveVoicePersonaConfig('indian_english');
  const pureEnPersona = resolveLiveVoicePersonaConfig('pure_english');
  const hinglishPersona = resolveLiveVoicePersonaConfig('hinglish_faculty');

  assert.equal(new Set([
    hindiPersona.voiceName,
    indianEnPersona.voiceName,
    pureEnPersona.voiceName,
    hinglishPersona.voiceName,
  ]).size, 4);
  assert.match(hindiPersona.systemInstruction, /देवनागरी/);
});

