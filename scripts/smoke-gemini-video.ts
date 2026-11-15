import 'dotenv/config';
import { Type } from '@google/genai';
import { getValidatedGenAIClient } from '../src/server/coreStudyEngine';
import {
  buildAnimatedLessonPromptRequest,
  synthesizeAnimatedLessonSvg,
} from '../src/server/routes/aiTutorRoutes';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const reqSpec = buildAnimatedLessonPromptRequest({
    prompt: 'Convex lens ray optics focal convergence',
    aspectRatio: '16:9',
  });

  if (!apiKey) {
    console.log(
      '[smoke:gemini-video] GEMINI_API_KEY is not set in environment; verified static request contract only (live API skipped).'
    );
    console.log('[smoke:gemini-video] Contract payload:', JSON.stringify(reqSpec));
    process.exit(0);
  }

  const ai = getValidatedGenAIClient();
  console.log(`[smoke:gemini-video] Calling live Gemini API with model=${reqSpec.model}...`);
  const response = await ai.models.generateContent({
    model: reqSpec.model,
    contents: reqSpec.contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          lessonTitle: { type: Type.STRING },
          durationSec: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          keyframes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                timeSec: { type: Type.NUMBER },
                title: { type: Type.STRING },
                formula: { type: Type.STRING },
                visualCue: { type: Type.STRING },
                caption: { type: Type.STRING },
              },
              required: ['timeSec', 'title', 'formula', 'visualCue', 'caption'],
            },
          },
        },
        required: ['lessonTitle', 'durationSec', 'summary', 'keyframes'],
      },
    },
  });

  const parsed = JSON.parse(response.text || '{}');
  const svg = synthesizeAnimatedLessonSvg({
    lessonTitle: String(parsed.lessonTitle || 'Concept Lesson'),
    durationSec: Number(parsed.durationSec) || 12,
    summary: String(parsed.summary || ''),
    keyframes: Array.isArray(parsed.keyframes) ? parsed.keyframes : [],
  });
  console.log(`[smoke:gemini-video] Success! Generated animated SVG (${svg.length} bytes).`);
}

main().catch((err) => {
  console.error('[smoke:gemini-video] Error:', err?.message || err);
  process.exit(1);
});
