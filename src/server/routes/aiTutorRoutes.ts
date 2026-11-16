import { Router, Response } from 'express';
import { ThinkingLevel, Type } from '@google/genai';
import { AuthenticatedRequest } from '../middleware/authAndSecurity';
import {
  ALLOWED_GEMINI_MODELS,
  buildThinkingFallbackChain,
  generateWithModelFallback,
  getModelRoutingConfig,
  getValidatedGenAIClient,
  sendStructuredUpstreamError,
} from '../coreStudyEngine';
import { retrieveTopKChunksForStudentPersistent } from '../../services/ingestionJobsService';
import { escapeXmlText, sanitizeSvgMarkup } from '../../utils/svgSanitizer';

export const aiTutorRouter = Router();

export function buildLanguageInstruction(language = 'English', teacherPersona?: string): string {
  const normalizedLang = String(language || '').trim().toLowerCase();
  const normalizedPersona = String(teacherPersona || '').trim().toLowerCase();

  if (
    normalizedLang === 'pure hindi' ||
    normalizedLang === 'hindi' ||
    normalizedPersona === 'pure_hindi'
  ) {
    return 'LANGUAGE REQUIREMENT (PURE HINDI): Respond strictly in clear, natural Hindi written in Devanagari script (देवनागरी हिंदी में सरल और स्पष्ट व्याख्या), keeping only equations and symbols in LaTeX. Never default to English prose.';
  }
  if (normalizedPersona === 'indian_english') {
    return 'LANGUAGE REQUIREMENT (INDIAN ENGLISH): Respond as a warm, articulate Indian IIT-JEE professor speaking in natural Indian English classroom cadence ("Let us write the governing equation step by step..."). Do not mix Hindi words.';
  }
  if (normalizedLang === 'hinglish' || normalizedPersona === 'hinglish_faculty') {
    return 'LANGUAGE REQUIREMENT (HINGLISH): Respond as a senior Kota/IIT-JEE faculty mentor in natural Hinglish (warm conversational Hindi words in Latin script mixed smoothly with English technical JEE terms and formulas).';
  }
  return 'LANGUAGE REQUIREMENT (PURE ENGLISH): Respond strictly in clear, encouraging standard academic English tailored for JEE Main & Advanced.';
}

export function buildSocraticActionRule(
  effectiveHintStep: number | 'full' | undefined,
  action: string,
  socraticMode: boolean
): string {
  if (action === 'unit_check') {
    return 'DIMENSIONAL & UNIT AUDIT: Explicitly verify LHS and RHS SI dimensions $[M^a L^b T^c]$ and common unit pitfalls.';
  }
  if (action === 'recheck_quiz') {
    return 'CONCEPT RECHECK: Provide a crisp recap followed by 1 quick self-check numerical/MCQ problem and its hidden verification key.';
  }
  if (effectiveHintStep === 1 || (socraticMode && !effectiveHintStep)) {
    return 'SOCRATIC HINT 1 OF 3 (CONCEPTUAL NUDGE ONLY — STRICT ANTI-SPOILER): Reply in STRICTLY 1 to 2 concise sentences. Name ONLY the single governing law or starting formula/principle and ask 1 diagnostic check-in question. NEVER show derivation steps, NEVER substitute numbers, and NEVER reveal the final numerical or symbolic answer.';
  }
  if (effectiveHintStep === 2) {
    return 'SOCRATIC HINT 2 OF 3 (EQUATION SETUP & BOUNDARY CONDITIONS): In 2 to 4 concise lines, show how to set up the governing equation and substitute known variables or boundary conditions. Do NOT compute or reveal the final answer.';
  }
  if (effectiveHintStep === 3) {
    return 'SOCRATIC HINT 3 OF 3 (KEY INTERMEDIATE STEP): Show the crucial algebraic/calculus transformation and warn of one common JEE exam trap, leaving the final arithmetic evaluation for the student.';
  }
  return 'Structure clearly: 1) Core Law & Citations, 2) Step-by-Step Derivation, 3) Common Exam Trap.';
}

const MATH_FORMAT_INSTRUCTION =
  'Format ALL mathematical, physics, and chemical equations using valid LaTeX syntax ($...$ for inline formulas and $$...$$ for display equations). Never mention the word KaTeX in your response. Highlight key definitions and fundamental laws in **bold** and highlight exceptions, boundary conditions, or common JEE exam traps in *italics*.';

// 0. Unified Citation-Aware AI Tutor Endpoint (/api/ai/tutor)
aiTutorRouter.post('/tutor', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.userUid!;
    const {
      question,
      prompt,
      chapter = '',
      subject = '',
      materialId,
      currentPage,
      context = '',
      contextMode = 'open_jee',
      difficultyLevel,
      difficulty,
      language,
      teacherPersona,
      socraticMode = false,
      hintLevel,
      socraticHintStep,
      action = 'explain',
      imageBase64,
      imageMimeType = 'image/png',
    } = req.body || {};

    const resolvedDifficulty = String(difficultyLevel || difficulty || 'jee_main');
    const resolvedLanguage = String(
      language ||
        (teacherPersona === 'pure_hindi'
          ? 'Pure Hindi'
          : teacherPersona === 'hinglish_faculty'
          ? 'Hinglish'
          : 'English')
    );
    const resolvedPersona = String(
      teacherPersona ||
        (resolvedLanguage.toLowerCase().includes('hindi') && !resolvedLanguage.toLowerCase().includes('hinglish')
          ? 'pure_hindi'
          : resolvedLanguage.toLowerCase() === 'hinglish'
          ? 'hinglish_faculty'
          : 'indian_english')
    );
    const rawStep = socraticHintStep ?? hintLevel;
    const effectiveHintStep: 1 | 2 | 3 | 'full' | undefined =
      rawStep === 'full'
        ? 'full'
        : rawStep === 1 || rawStep === 2 || rawStep === 3
        ? rawStep
        : socraticMode
        ? 1
        : undefined;

    const queryText = String(question || prompt || '').trim();
    if (!queryText) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'A question or prompt is required.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    // Retrieve top-K grounded chunks scoped strictly to this authenticated student (with Firestore persistence)
    const matchedChunks = await retrieveTopKChunksForStudentPersistent({
      uid,
      materialId: typeof materialId === 'string' ? materialId : undefined,
      query: `${chapter} ${queryText}`,
      topK: 4,
      currentPage: typeof currentPage === 'number' ? currentPage : undefined,
    });

    const citations = matchedChunks.map((c) => ({
      chunkId: c.chunkId,
      materialId: c.materialId,
      pageNumber: c.pageNumber,
      timestampLabel: c.timestampLabel || null,
      snippet: c.text.slice(0, 180),
    }));

    const retrievedContext =
      matchedChunks.length > 0
        ? matchedChunks
            .map((c) => `[Source Page ${c.pageNumber}${c.timestampLabel ? ` @ ${c.timestampLabel}` : ''}]: ${c.text}`)
            .join('\n\n')
        : String(context || '').slice(0, 6000);

    // Fail-safe in strict material mode when neither chunks nor context match
    if (contextMode === 'strict_material' && !retrievedContext.trim()) {
      res.json({
        answer:
          'I could not find grounded passages in your currently selected study material for this question. Please open the relevant material or switch to Open JEE Mode to answer from general JEE syllabus.',
        text:
          'I could not find grounded passages in your currently selected study material for this question. Please open the relevant material or switch to Open JEE Mode to answer from general JEE syllabus.',
        citations: [],
        contextMode,
        verificationStatus: 'insufficient_material_context',
        modelUsed: 'none',
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const langInstruction = buildLanguageInstruction(resolvedLanguage, resolvedPersona);

    const difficultyRule =
      resolvedDifficulty === 'board'
        ? 'DIFFICULTY CALIBRATION (NCERT / BOARD LEVEL): Focus on crystal-clear intuitive fundamentals and direct NCERT formula steps.'
        : resolvedDifficulty === 'jee_advanced'
        ? 'DIFFICULTY CALIBRATION (JEE ADVANCED LEVEL): Emphasize multi-concept coupling, differential derivations, degenerate/boundary cases, and rigor.'
        : 'DIFFICULTY CALIBRATION (JEE MAIN 2027 LEVEL): Balance conceptual speed, +4/-1 elimination traps, and Section B numerical rounding precision.';

    const modeRule =
      contextMode === 'strict_material'
        ? 'STRICT MATERIAL CONTEXT MODE: Answer ONLY using the Source Context excerpts below. Cite page numbers inline as [Page N]. If a detail is absent from the source excerpts, explicitly state that it is not present in the provided source.'
        : 'OPEN JEE TUTOR MODE: Ground explanations in the student’s material citations ([Page N]) where relevant and extend freely across the full JEE Main/Advanced syllabus.';

    const actionRule = buildSocraticActionRule(
      effectiveHintStep,
      String(action || 'explain'),
      Boolean(socraticMode)
    );

    const parts: any[] = [];
    if (typeof imageBase64 === 'string' && imageBase64.trim()) {
      const cleanedB64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
      if (cleanedB64.length > 0 && cleanedB64.length <= 12_000_000) {
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: cleanedB64,
          },
        });
      }
    }

    parts.push({
      text: `Subject: ${subject || 'JEE STEM'} | Chapter: ${chapter || 'General'}\nQuestion: ${queryText}\n\nRetrieved Material Excerpts:\n${
        retrievedContext || 'No uploaded material selected (Open JEE Syllabus context).'
      }`,
    });

    const tutorModels =
      resolvedDifficulty === 'jee_advanced'
        ? buildThinkingFallbackChain(models.thinking)
        : [models.fast, ...buildThinkingFallbackChain(models.thinking)];
    const { result, modelUsed, fallbackUsed } = await generateWithModelFallback(
      tutorModels,
      (model) =>
        ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            systemInstruction: `You are LearnMate JEE Classroom Tutor. ${langInstruction} ${MATH_FORMAT_INSTRUCTION} ${difficultyRule} ${modeRule} ${actionRule}`,
          },
        })
    );

    const answerText = result.text ?? '';
    res.json({
      answer: answerText,
      text: answerText,
      citations,
      contextMode,
      difficultyLevel: resolvedDifficulty,
      hintStep: effectiveHintStep ?? null,
      language: resolvedLanguage,
      verificationStatus: citations.length > 0 ? 'grounded_with_citations' : 'open_jee_syllabus',
      modelUsed,
      fallbackUsed,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/tutor', req.requestId);
  }
});

// 1. Deep Reasoning / High Thinking Endpoint (configured reasoning model with safe fallback)
aiTutorRouter.post('/think', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.userUid!;
    const {
      prompt,
      language = 'English',
      teacherPersona = 'hinglish_faculty',
      isVoiceTeacher = false,
      context = '',
      materialId,
      currentPage,
      mode = 'doubt',
      contextMode = 'open_jee',
      socraticHintStep,
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Prompt is required.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const langInstruction = buildLanguageInstruction(language, teacherPersona);

    if (mode === 'custom_set') {
      const { result, modelUsed } = await generateWithModelFallback(
        buildThinkingFallbackChain(models.thinking),
        (model) =>
          ai.models.generateContent({
            model,
            contents: `Generate a JEE practice question set for topic "${prompt}". Context: ${String(context).slice(0, 4000)}. ${langInstruction} ${MATH_FORMAT_INSTRUCTION}`,
            config: {
              systemInstruction:
                'You are a senior IIT-JEE faculty member creating high-yield JEE questions. Return a JSON array of 5 questions with id, subject, section ("Section A"), text, options (array of 4 strings), correctIndex (0-3), chapter, and explanation. Use $...$ for all math/physics/chemistry symbols.',
              ...(model === models.thinking
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
                : {}),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    subject: { type: Type.STRING },
                    section: { type: Type.STRING },
                    text: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctIndex: { type: Type.INTEGER },
                    chapter: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: [
                    'id',
                    'subject',
                    'section',
                    'text',
                    'options',
                    'correctIndex',
                    'chapter',
                    'explanation',
                  ],
                },
              },
            },
          })
      );
      res.json({
        questions: JSON.parse((result.text ?? '[]').trim()),
        provenanceType: 'AI_GENERATED',
        modelUsed,
      });
      return;
    }

    const retrieved = await retrieveTopKChunksForStudentPersistent({
      uid,
      materialId: typeof materialId === 'string' ? materialId : undefined,
      query: prompt,
      topK: 4,
      currentPage: typeof currentPage === 'number' ? currentPage : undefined,
    });

    const citations = retrieved.map((c) => ({
      chunkId: c.chunkId,
      pageNumber: c.pageNumber,
      timestampLabel: c.timestampLabel || null,
      snippet: c.text.slice(0, 160),
    }));

    const effectiveContext =
      retrieved.length > 0
        ? retrieved
            .map((c) => `[Source Page ${c.pageNumber}]: ${c.text}`)
            .join('\n\n')
        : String(context || '').slice(0, 6000);

    const contextModeRule =
      contextMode === 'strict_material'
        ? 'STRICT MATERIAL CONTEXT MODE: Answer strictly based on the provided Study Material Context below and cite page numbers ([Page N]). If absent from the material, state clearly that it is outside the uploaded material.'
        : 'OPEN JEE TUTOR MODE: Answer any JEE Main or JEE Advanced Physics, Chemistry, or Mathematics doubt comprehensively, citing uploaded material pages where helpful.';

    const socraticInstruction =
      socraticHintStep === 1
        ? 'SOCRATIC HINT 1 OF 3 (CONCEPTUAL NUDGE ONLY — STRICT ANTI-SPOILER): Reply in STRICTLY 1 to 2 concise sentences. Name ONLY the single governing law or starting formula and ask 1 diagnostic question. NEVER show derivation steps, NEVER substitute numbers, and NEVER reveal the final numerical or symbolic answer.'
        : socraticHintStep === 2
        ? 'SOCRATIC HINT 2 OF 3 (EQUATION SETUP & BOUNDARY CONDITIONS): Do NOT reveal the final answer yet. Show variable substitution in 2 to 4 concise lines and ask the student to simplify.'
        : socraticHintStep === 3
        ? 'SOCRATIC HINT 3 OF 3 (INTERMEDIATE STEP): Show the key intermediate algebraic/calculus step and exam trap, leaving final arithmetic to the student.'
        : isVoiceTeacher
        ? 'Act like a dedicated live classroom teacher standing at the board. Walk through the derivation step-by-step in cohesive spoken paragraphs and finish with a warm check-in question.'
        : 'Break down every solution into: 1) **Core Concept & Governing Formula**, 2) **Step-by-Step Derivation & Solution**, and 3) *Common JEE Exam Trap to Avoid*, followed by a brief check-in question.';

    const { result, modelUsed, fallbackUsed } = await generateWithModelFallback(
      buildThinkingFallbackChain(models.thinking),
      (model) =>
        ai.models.generateContent({
          model,
          contents: `Student Question / Request: ${prompt}\n\nActive Study Material Context:\n${
            effectiveContext || 'General JEE Main & Advanced Syllabus'
          }`,
          config: {
            systemInstruction: `You are LearnMate JEE's Senior Classroom Teacher. ${langInstruction} ${MATH_FORMAT_INSTRUCTION} ${contextModeRule} ${socraticInstruction}`,
            ...(model === models.thinking
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
              : {}),
          },
        })
    );

    res.json({
      text: result.text ?? '',
      citations,
      modelUsed,
      fallbackUsed,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/think', req.requestId);
  }
});

// 2. Low-Latency Fast Responses (gemini-3.1-flash-lite)
aiTutorRouter.post('/fast', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, language = 'English', context = '' } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Prompt is required.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const langInstruction =
      language === 'Hindi'
        ? 'Explain in crisp, friendly Hindi (2-4 bullet points max).'
        : language === 'Hinglish'
        ? 'Explain in crisp, friendly Hinglish (2-4 bullet points max).'
        : 'Explain in crisp, intuitive English (2-4 bullet points max).';

    const { result, modelUsed } = await generateWithModelFallback(
      [models.fast, ...buildThinkingFallbackChain(models.thinking)],
      (model) =>
        ai.models.generateContent({
          model,
          contents: `${prompt.slice(0, 4000)}\nContext: ${String(context).slice(0, 4000)}`,
          config: {
            systemInstruction: `You are a fast JEE intuition coach. ${langInstruction} Format all math/physics/chemistry expressions in LaTeX ($...$ or $$...$$), highlight key laws in **bold**, and highlight exceptions in *italics*. Never mention the word KaTeX.`,
          },
        })
    );

    res.json({ text: result.text ?? '', modelUsed });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/fast', req.requestId);
  }
});

// 3. Multimodal Image & Verified Transcript Analysis (gemini-4-argon -> gemini-4-hydrogen fallback)
aiTutorRouter.post('/analyze', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      prompt,
      mediaBase64,
      mimeType,
      youtubeUrl,
      transcriptOrOutline = '',
      sourceType = 'photo',
    } = req.body || {};

    // Honest enforcement: never let AI hallucinate video notes from a URL without transcript text!
    if (youtubeUrl && String(transcriptOrOutline || '').trim().length < 30 && !mediaBase64) {
      res.status(422).json({
        errorCode: 'CAPTIONS_UNAVAILABLE',
        message:
          'YouTube transcript or timestamped captions are required before AI analysis. Paste captions or use /api/ingest/youtube first.',
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();

    const parts: any[] = [];
    if (typeof mediaBase64 === 'string' && mediaBase64.trim() && mimeType) {
      const cleanedB64 = mediaBase64.replace(/^data:[^;]+;base64,/, '').trim();
      parts.push({
        inlineData: {
          data: cleanedB64,
          mimeType: String(mimeType),
        },
      });
    }

    const analysisPrompt = youtubeUrl
      ? `Organize these verified YouTube lecture captions/transcript excerpts (${youtubeUrl}) into source-cited JEE notes without inventing content outside the transcript:\nTranscript:\n"${String(transcriptOrOutline).slice(0, 12000)}"\nUser focus: "${prompt || 'Complete structured chapter notes with timestamp citations'}"`
      : prompt ||
        'Perform high-accuracy OCR and concept extraction on this uploaded handwritten/printed JEE study material. Extract equations accurately in LaTeX ($...$ and $$...$$) without ever adding unrelated chapters or formulas. Do not mention the word KaTeX.';

    parts.push({ text: analysisPrompt });

    const { result, modelUsed, fallbackUsed } = await generateWithModelFallback(
      buildThinkingFallbackChain(models.analyze),
      (model) =>
        ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            systemInstruction:
              'You are LearnMate JEE Multimodal & Handwritten Document Analyzer. Extract text, equations ($...$ and $$...$$), **bold** key concepts, and *italic* exceptions faithfully from ONLY the uploaded document or transcript. Never output the word KaTeX.',
          },
        })
    );

    res.json({
      text: result.text ?? '',
      sourceType,
      modelUsed,
      fallbackUsed,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/analyze', req.requestId);
  }
});

// 4. General Tasks + Google Search Grounding + Sanitized SVG Diagram Maker (gemini-4-hydrogen)
aiTutorRouter.post('/search', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, useSearch = true, mode = 'search' } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Prompt is required.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();

    if (mode === 'svg_diagram') {
      const { result, modelUsed } = await generateWithModelFallback(
        [models.fast, ...buildThinkingFallbackChain(models.thinking)],
        (model) =>
          ai.models.generateContent({
            model,
            contents: `Create a clean, textbook-accurate scientific SVG diagram for JEE: "${prompt.slice(0, 1000)}". Return ONLY valid <svg viewBox="0 0 680 420" ...>...</svg> markup with crisp black/indigo strokes, clear arrows, angle arcs, and italic mathematical labels. Never include <script>, event handlers, or external URLs.`,
            config: {
              systemInstruction:
                'Output ONLY raw valid <svg>...</svg> code (no markdown fences) with viewBox="0 0 680 420", white background, clean vector lines, arrows, and academic serif math labels.',
            },
          })
      );
      const raw = (result.text ?? '').replace(/```svg|```xml|```/g, '').trim();
      const safeSvg = sanitizeSvgMarkup(raw);
      if (!safeSvg) {
        res.status(502).json({
          errorCode: 'INVALID_SVG_OUTPUT',
          message: 'Generated diagram did not contain valid safe SVG markup. Please retry.',
          requestId: req.requestId,
        });
        return;
      }
      res.json({ svg: safeSvg, modelUsed });
      return;
    }

    const { result, modelUsed } = await generateWithModelFallback(
      [models.fast, ...buildThinkingFallbackChain(models.thinking)],
      (model) =>
        ai.models.generateContent({
          model,
          contents: prompt.slice(0, 4000),
          config: useSearch
            ? {
                tools: [{ googleSearch: {} }],
                systemInstruction:
                  'You are LearnMate JEE Search-Grounded Assistant. Provide accurate, up-to-date JEE Main, JEE Advanced, NTA, and NCERT information.',
              }
            : {
                systemInstruction: 'You are LearnMate JEE Study Assistant.',
              },
        })
    );

    const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = chunks
      .map((chunk: any) => ({
        title: chunk.web?.title || 'Verified Source',
        uri: chunk.web?.uri || '',
      }))
      .filter((s: any) => Boolean(s.uri));

    res.json({
      text: result.text ?? '',
      sources,
      modelUsed,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/search', req.requestId);
  }
});

// 5. High-Res Concept Visual Generation (gemini-3-pro-image)
aiTutorRouter.post('/image-pro', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, aspectRatio = '16:9', imageSize = '1K' } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Prompt is required for visual generation.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const { result: response } = await generateWithModelFallback(
      [models.image, models.imageEdit],
      (model) =>
        ai.models.generateContent({
          model,
          contents: `High-clarity scientific textbook educational diagram for JEE student: ${prompt.slice(0, 1000)}. Clean white paper style, high contrast labels, zero clutter.`,
          config: {
            imageConfig: {
              aspectRatio,
              imageSize,
            },
          },
        })
    );

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData) {
        res.json({
          imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        });
        return;
      }
    }

    res.status(503).json({
      errorCode: 'IMAGE_GENERATION_EMPTY',
      message: 'No image data returned from image generation model. Please retry.',
      retryAfterSeconds: 5,
      requestId: req.requestId,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/image-pro', req.requestId);
  }
});

// 6. Fast Visual Editing / Problem Diagram Markup (gemini-nano-banana-2.1)
aiTutorRouter.post('/image-edit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, imageBase64, mimeType = 'image/png' } = req.body || {};
    if (!prompt) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Prompt is required for image editing.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const parts: any[] = [];
    if (typeof imageBase64 === 'string' && imageBase64.trim()) {
      const cleaned = imageBase64.replace(/^data:[^;]+;base64,/, '').trim();
      parts.push({ inlineData: { data: cleaned, mimeType } });
    }
    parts.push({ text: prompt });

    const { result: response } = await generateWithModelFallback(
      [models.imageEdit, models.image],
      (model) =>
        ai.models.generateContent({
          model,
          contents: { parts },
        })
    );

    const resParts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of resParts) {
      if (part.inlineData) {
        res.json({
          imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        });
        return;
      }
    }

    res.status(503).json({
      errorCode: 'IMAGE_EDIT_EMPTY',
      message: 'No edited image returned. Please retry.',
      retryAfterSeconds: 5,
      requestId: req.requestId,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/image-edit', req.requestId);
  }
});

// 7. Interactive Animated Concept Lesson Generation (GEMINI_MODEL_FAST + SMIL Animated SVG)
export interface AnimatedLessonKeyframe {
  timeSec: number;
  title: string;
  formula: string;
  visualCue: string;
  caption: string;
}

export interface AnimatedConceptLessonPlan {
  lessonTitle: string;
  durationSec: number;
  summary: string;
  keyframes: AnimatedLessonKeyframe[];
}

export function normalizeSvgMathLabels(raw: string): string {
  return String(raw || '')
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\dfrac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\vec\{([^{}]+)\}/g, '$1')
    .replace(/\\hat\{([^{}]+)\}/g, '$1̂')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\cos\b/g, 'cos')
    .replace(/\\sin\b/g, 'sin')
    .replace(/\\tan\b/g, 'tan')
    .replace(/\\cot\b/g, 'cot')
    .replace(/\\sec\b/g, 'sec')
    .replace(/\\csc\b/g, 'csc')
    .replace(/\\ln\b/g, 'ln')
    .replace(/\\log\b/g, 'log')
    .replace(/\\theta\b/g, 'θ')
    .replace(/\\phi\b/g, 'φ')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\gamma\b/g, 'γ')
    .replace(/\\omega\b/g, 'ω')
    .replace(/\\Omega\b/g, 'Ω')
    .replace(/\\mu\b/g, 'μ')
    .replace(/\\lambda\b/g, 'λ')
    .replace(/\\sigma\b/g, 'σ')
    .replace(/\\Sigma\b/g, 'Σ')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\varepsilon_0\b/g, 'ε₀')
    .replace(/\\varepsilon\b/g, 'ε')
    .replace(/\\le\b|\\leq\b/g, '≤')
    .replace(/\\ge\b|\\geq\b/g, '≥')
    .replace(/\\neq\b/g, '≠')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\times\b/g, '×')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\pm\b/g, '±')
    .replace(/\\to\b|\\rightarrow\b/g, '→')
    .replace(/\\implies\b/g, '⇒')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\int\b/g, '∫')
    .replace(/\\partial\b/g, '∂')
    .replace(/\\degree\b|\^\\circ/g, '°')
    .replace(/[{}]/g, '')
    .replace(/\\+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildAnimatedLessonPromptRequest(params: {
  prompt: string;
  aspectRatio?: string;
  imageBase64?: string;
  imageMimeType?: string;
}) {
  const models = getModelRoutingConfig();
  const allowedAspectRatios = new Set(['16:9', '9:16', '1:1', '4:3', '3:4']);
  const safeAspect = allowedAspectRatios.has(String(params.aspectRatio || ''))
    ? String(params.aspectRatio)
    : '16:9';
  const promptText = `Design an interactive 12-second animated IIT-JEE concept lesson for: "${String(
    params.prompt
  ).slice(0, 600)}". Return a structured lesson title, concise summary, and 4 sequential animation keyframes (t = 0s, 4s, 8s, 12s) with exact physics/chemistry/math formulas, visual motion cues, and classroom captions. IMPORTANT: Inside title, formula, visualCue, and summary fields for SVG text rendering, use clean readable Unicode math symbols (e.g. "cos θ", "≤ μN", "ΣF = ma", "ΔK", "π") and NEVER output raw LaTeX backslashes like \\cos, \\le, or \\frac. Aspect ratio context: ${safeAspect}.`;

  const cleanedImg =
    typeof params.imageBase64 === 'string'
      ? params.imageBase64.replace(/^data:[^;]+;base64,/, '').trim()
      : '';

  const parts: any[] = [];
  if (cleanedImg) {
    parts.push({
      inlineData: {
        mimeType: String(params.imageMimeType || 'image/png'),
        data: cleanedImg,
      },
    });
  }
  parts.push({ text: promptText });

  return {
    model: models.fast,
    aspectRatio: safeAspect,
    contents: { parts },
  };
}

export function synthesizeAnimatedLessonSvg(plan: AnimatedConceptLessonPlan): string {
  const safeTitle = escapeXmlText(
    normalizeSvgMathLabels(plan.lessonTitle || 'JEE Animated Concept Lesson').slice(0, 68)
  );
  const safeSummary = escapeXmlText(
    normalizeSvgMathLabels(plan.summary || 'Step-by-step animated visual derivation').slice(0, 120)
  );
  const frames = (Array.isArray(plan.keyframes) && plan.keyframes.length > 0
    ? plan.keyframes
    : [
        {
          timeSec: 0,
          title: 'Setup & Initial State',
          formula: 'ΣF = ma',
          visualCue: 'Define axes and initial variables',
          caption: 'Establish coordinate frame and boundary conditions.',
        },
        {
          timeSec: 4,
          title: 'Vector Decomposition',
          formula: 'F_∥ = mg sin θ, N = mg cos θ',
          visualCue: 'Resolve vectors along trajectory',
          caption: 'Split governing components along orthogonal axes.',
        },
        {
          timeSec: 8,
          title: 'Dynamic Evolution',
          formula: 'v(t) = u + at',
          visualCue: 'Animate displacement over time',
          caption: 'Track state transition across the interval.',
        },
        {
          timeSec: 12,
          title: 'JEE Key Takeaway',
          formula: 'ΔK + ΔU = W_nc',
          visualCue: 'Highlight conserved invariant',
          caption: 'Verify units, limits, and sign convention.',
        },
      ]
  ).slice(0, 4);

  const stageCards = frames
    .map((kf, idx) => {
      const x = 32 + idx * 158;
      const delaySec = idx * 2.4;
      const cleanTitle = normalizeSvgMathLabels(String(kf.title || '')).slice(0, 20);
      const cleanFormula = normalizeSvgMathLabels(String(kf.formula || '')).slice(0, 21);
      const cleanCue = normalizeSvgMathLabels(String(kf.visualCue || '')).slice(0, 22);
      return `
        <g transform="translate(${x}, 276)">
          <rect x="0" y="0" width="144" height="104" rx="10" fill="#111827" stroke="#334155" stroke-width="1.5">
            <animate attributeName="stroke" values="#334155;#2563EB;#00A86B;#334155" keyTimes="0;0.25;0.65;1" dur="9.6s" begin="${delaySec}s" repeatCount="indefinite" />
          </rect>
          <text x="10" y="20" font-size="11" font-weight="700" fill="#60A5FA">t = ${Math.round(Number(kf.timeSec) || idx * 4)}s</text>
          <text x="10" y="39" font-size="11" font-weight="700" fill="#F8FAFC">${escapeXmlText(cleanTitle)}</text>
          <text x="10" y="61" font-size="11" font-weight="600" fill="#34D399">${escapeXmlText(cleanFormula)}</text>
          <text x="10" y="83" font-size="10" fill="#94A3B8">${escapeXmlText(cleanCue)}</text>
        </g>`;
    })
    .join('');

  const rawSvg = `<svg viewBox="0 0 680 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" font-family="Inter, sans-serif">
    <defs>
      <linearGradient id="anim-bg" x1="0" y1="0" x2="680" y2="420" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#070B14" />
        <stop offset="100%" stop-color="#0F172A" />
      </linearGradient>
      <linearGradient id="anim-flow" x1="60" y1="0" x2="620" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#2563EB" />
        <stop offset="50%" stop-color="#7C3AED" />
        <stop offset="100%" stop-color="#00A86B" />
      </linearGradient>
    </defs>
    <rect width="680" height="420" rx="14" fill="url(#anim-bg)" />
    <text x="32" y="38" font-size="17" font-weight="700" fill="#F8FAFC">${safeTitle}</text>
    <text x="32" y="59" font-size="12" fill="#94A3B8">${safeSummary}</text>

    <!-- Interactive Physics / Concept Motion Stage -->
    <rect x="32" y="76" width="616" height="178" rx="12" fill="#111827" stroke="rgba(255,255,255,0.10)" stroke-width="1.5" />
    <line x1="64" y1="210" x2="616" y2="210" stroke="#334155" stroke-width="2" stroke-dasharray="6 5" />
    <path d="M 76 196 Q 210 92, 340 156 T 604 128" fill="none" stroke="url(#anim-flow)" stroke-width="4" stroke-linecap="round">
      <animate attributeName="stroke-dasharray" values="0,800;800,0" dur="4.8s" repeatCount="indefinite" />
    </path>

    <!-- Animated Particle / State Pulse -->
    <circle cx="80" cy="186" r="10" fill="#00A86B" stroke="#F8FAFC" stroke-width="2">
      <animateMotion path="M 0 10 Q 134 -94, 264 -30 T 528 -58" dur="4.8s" repeatCount="indefinite" />
      <animate attributeName="r" values="9;13;9" dur="1.6s" repeatCount="indefinite" />
    </circle>

    <!-- Progress Scrub Bar -->
    <rect x="64" y="232" width="552" height="6" rx="3" fill="#1E293B" />
    <rect x="64" y="232" width="0" height="6" rx="3" fill="url(#anim-flow)">
      <animate attributeName="width" values="0;552;0" dur="9.6s" repeatCount="indefinite" />
    </rect>

    ${stageCards}
    <text x="32" y="402" font-size="11" fill="#64748B">Interactive Animated Concept Lesson · ${Math.max(4, Number(plan.durationSec) || 12)}s loop</text>
  </svg>`;

  return sanitizeSvgMarkup(rawSvg);
}

aiTutorRouter.post('/video', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, aspectRatio = '16:9', imageBase64, imageMimeType } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Prompt is required for animated concept lesson generation.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const requestSpec = buildAnimatedLessonPromptRequest({
      prompt,
      aspectRatio,
      imageBase64,
      imageMimeType,
    });

    const { result: response, modelUsed, fallbackUsed } = await generateWithModelFallback(
      [models.fast, ALLOWED_GEMINI_MODELS.intermediate, models.thinking],
      (model) =>
        ai.models.generateContent({
          model,
          contents: requestSpec.contents,
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
        })
    );

    const parsed = JSON.parse(response.text || '{}') as Partial<AnimatedConceptLessonPlan>;
    const normalizedPlan: AnimatedConceptLessonPlan = {
      lessonTitle: String(parsed.lessonTitle || prompt).slice(0, 100),
      durationSec: Number(parsed.durationSec) > 0 ? Math.min(60, Number(parsed.durationSec)) : 12,
      summary: String(parsed.summary || `Visual step-by-step concept walkthrough for ${prompt}`).slice(0, 260),
      keyframes:
        Array.isArray(parsed.keyframes) && parsed.keyframes.length > 0
          ? parsed.keyframes.slice(0, 6).map((kf, idx) => ({
              timeSec: Number.isFinite(Number(kf?.timeSec)) ? Number(kf.timeSec) : idx * 4,
              title: String(kf?.title || `Step ${idx + 1}`).slice(0, 60),
              formula: String(kf?.formula || '').slice(0, 80),
              visualCue: String(kf?.visualCue || '').slice(0, 100),
              caption: String(kf?.caption || '').slice(0, 220),
            }))
          : [],
    };

    const animatedSvg = synthesizeAnimatedLessonSvg(normalizedPlan);
    const videoUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(animatedSvg)}`;

    res.json({
      ...normalizedPlan,
      animatedSvg,
      videoUrl,
      aspectRatio: requestSpec.aspectRatio,
      modelUsed,
      fallbackUsed,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/video', req.requestId);
  }
});

// 8. Audio Transcription (gemini-3.5-transcribe)
aiTutorRouter.post('/transcribe', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body || {};
    if (!audioBase64) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'audioBase64 is required.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const { result: response, modelUsed } = await generateWithModelFallback(
      [models.transcribe, ...buildThinkingFallbackChain(models.fast)],
      (model) =>
        ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: String(audioBase64).replace(/^data:[^;]+;base64,/, '').trim(),
                },
              },
              {
                text: 'Transcribe this spoken JEE doubt or study note accurately, preserving mathematical terms and chemical formulas.',
              },
            ],
          },
        })
    );

    res.json({ transcript: response.text ?? '', modelUsed });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/transcribe', req.requestId);
  }
});

// 9. Text-to-Speech (gemini-3.8-flash-tts)
aiTutorRouter.post('/tts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text, voiceName = 'Kore', teacherPersona = 'hinglish_faculty' } = req.body || {};
    if (!text) {
      res.status(400).json({
        errorCode: 'INVALID_REQUEST',
        message: 'Text is required for TTS.',
        retryAfterSeconds: 0,
        requestId: req.requestId,
      });
      return;
    }

    const styleByPersona =
      teacherPersona === 'pure_hindi'
        ? 'Warm, patient Indian classroom teacher speaking clear Hindi with natural pedagogical pauses and encouraging tone'
        : teacherPersona === 'indian_english'
        ? 'Articulate Indian IIT-JEE professor speaking with a natural, warm Indian English accent and clear step-by-step classroom delivery'
        : teacherPersona === 'hinglish_faculty'
        ? 'Warm, energetic IIT-JEE faculty mentor explaining concepts in natural Hinglish with Indian English accent'
        : 'Clear, encouraging academic professor explaining concepts step by step';

    const models = getModelRoutingConfig();
    const ai = getValidatedGenAIClient();
    const { result: response } = await generateWithModelFallback(
      [models.tts],
      (model) =>
        ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Tutor: <breath> ${String(text).slice(0, 4000)}`,
                  speechMetadata: {
                    speaker: 'Tutor',
                    style: styleByPersona,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        })
    );

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      res.status(503).json({
        errorCode: 'TTS_EMPTY_AUDIO',
        message: 'No audio returned from speech synthesis model.',
        retryAfterSeconds: 5,
        requestId: req.requestId,
      });
      return;
    }

    res.json({
      audioUrl: `data:audio/wav;base64,${base64Audio}`,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/tts', req.requestId);
  }
});

// 10. Focus Music Generation with Lyria 3
aiTutorRouter.post('/music', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      prompt = 'Calm ambient lo-fi study instrumental for deep JEE physics problem solving',
      durationType = 'clip',
    } = req.body || {};
    const ai = getValidatedGenAIClient();
    const modelName = durationType === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents: String(prompt).slice(0, 500),
    });

    let audioBase64 = '';
    let mimeType = 'audio/wav';
    let description = '';

    for await (const chunk of responseStream) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
        if (part.text && !description) {
          description = part.text;
        }
      }
    }

    if (!audioBase64) {
      res.status(503).json({
        errorCode: 'MUSIC_EMPTY_AUDIO',
        message: 'No audio generated from Lyria model.',
        retryAfterSeconds: 5,
        requestId: req.requestId,
      });
      return;
    }

    res.json({
      audioUrl: `data:${mimeType};base64,${audioBase64}`,
      modelUsed: modelName,
      description,
    });
  } catch (error: any) {
    sendStructuredUpstreamError(res, error, '/api/ai/music', req.requestId);
  }
});
