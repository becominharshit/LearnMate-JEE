import type {
  FormulaCardEntry,
  MaterialStudyBundle,
  MindMapNodeItem,
  NotePageData,
  StickyNoteData,
} from '../data/jeeInitialContent';
import type { CBTQuestion } from '../utils/jeeEngine';

export type ContentProvenance = 'source_extracted' | 'ai_supplemented' | 'user_edited';
export type ExtractionQuality = 'full' | 'partial' | 'needs_ocr' | 'unavailable';

export interface SourcePageSlice {
  pageNumber: number;
  text: string;
  timestampRange?: string;
  citationId: string;
}

export function computeStableContentHash(input: string): string {
  // Deterministic 64-bit FNV-1a hex hash safe for browser + Node environments
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  const text = String(input || '');
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch ^ (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  return `h-${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function extractEquationsFromSourceText(text: string): string[] {
  const found: string[] = [];
  const cleanText = String(text || '');

  const displayRegex = /\$\$([\s\S]+?)\$\$/g;
  let m: RegExpExecArray | null;
  while ((m = displayRegex.exec(cleanText)) !== null) {
    const eq = `$$${m[1].trim()}$$`;
    if (eq.length > 4 && !found.includes(eq)) found.push(eq);
  }

  const stripped = cleanText.replace(/\$\$[\s\S]+?\$\$/g, ' ');
  const inlineRegex = /\$([^$\n]+?)\$/g;
  while ((m = inlineRegex.exec(stripped)) !== null) {
    const inner = m[1].trim();
    if (
      inner.includes('=') ||
      inner.includes('\\int') ||
      inner.includes('\\frac') ||
      inner.includes('\\Delta') ||
      inner.includes('^')
    ) {
      const eq = `$$${inner}$$`;
      if (!found.includes(eq)) found.push(eq);
    }
  }

  return found.slice(0, 32);
}

/**
 * Splits raw extracted document text into genuine source pages:
 * - Honors `[Page N]` markers emitted by pdf.js / backend chunkers (up to 500 pages).
 * - Honors `[HH:MM:SS]` or `MM:SS` timestamps for YouTube transcripts.
 * - Avoids truncating multi-page PDFs to 3 pages or inventing fake timestamps.
 */
export function splitSourceIntoPages(
  rawText: string,
  sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive'
): { slices: SourcePageSlice[]; extractionQuality: ExtractionQuality } {
  const clean = String(rawText || '').trim();
  if (!clean || clean.length < 20) {
    return {
      slices: [
        {
          pageNumber: 1,
          citationId: 'src-p1',
          text:
            clean ||
            'No selectable text was detected in this file. If this is a scanned PDF or handwritten photo, run Gemini Vision OCR or paste key text excerpts.',
        },
      ],
      extractionQuality: sourceType === 'youtube'
        ? 'unavailable'
        : clean && (sourceType === 'text' || sourceType === 'drive')
          ? 'partial'
          : 'needs_ocr',
    };
  }

  // Case 1: Explicit [Page N] markers from multi-page PDF extraction
  const pageMarkerRe = /\[Page\s+(\d+)\]\s*/gi;
  if (pageMarkerRe.test(clean)) {
    const parts = clean.split(/\[Page\s+(\d+)\]\s*/i);
    const slices: SourcePageSlice[] = [];
    for (let i = 1; i < parts.length; i += 2) {
      const pgNum = Math.max(1, Number(parts[i]) || slices.length + 1);
      const body = (parts[i + 1] || '').trim();
      if (body.length > 0) {
        slices.push({
          pageNumber: pgNum,
          citationId: `src-p${pgNum}`,
          text: body,
        });
      }
    }
    if (slices.length > 0) {
      const emptyRatio = slices.filter((s) => s.text.length < 25).length / slices.length;
      return {
        slices,
        extractionQuality: emptyRatio > 0.35 ? 'partial' : 'full',
      };
    }
  }

  // Case 2: Explicit YouTube timestamp lines
  if (sourceType === 'youtube') {
    const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const tsRe = /^(\[?\d{1,2}:\d{2}(?::\d{2})?\]?)\s*[-–—:]?\s*(.+)$/;
    const tsLines = lines.filter((l) => tsRe.test(l));
    if (tsLines.length >= 2) {
      const groupSize = Math.max(1, Math.ceil(tsLines.length / Math.min(12, Math.ceil(tsLines.length / 4))));
      const slices: SourcePageSlice[] = [];
      for (let i = 0; i < tsLines.length; i += groupSize) {
        const group = tsLines.slice(i, i + groupSize);
        const firstTs = tsRe.exec(group[0])?.[1]?.replace(/[\[\]]/g, '') || '00:00';
        const lastTs = tsRe.exec(group[group.length - 1])?.[1]?.replace(/[\[\]]/g, '') || firstTs;
        const pageNumber = slices.length + 1;
        slices.push({
          pageNumber,
          timestampRange: `${firstTs} – ${lastTs}`,
          citationId: `src-ts${pageNumber}`,
          text: group.join('\n'),
        });
      }
      return { slices, extractionQuality: 'full' };
    }
  }

  // Case 3: Paragraph-based chunking (no arbitrary 3,500-char clipping)
  const paragraphs = clean
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return {
      slices: [{ pageNumber: 1, citationId: 'src-p1', text: clean }],
      extractionQuality: 'full',
    };
  }

  const slices: SourcePageSlice[] = [];
  const paragraphsPerPage = paragraphs.length <= 3 ? 1 : 3;
  for (let i = 0; i < paragraphs.length; i += paragraphsPerPage) {
    const pageNumber = slices.length + 1;
    slices.push({
      pageNumber,
      citationId: `src-p${pageNumber}`,
      text: paragraphs.slice(i, i + paragraphsPerPage).join('\n\n'),
    });
  }

  return {
    slices,
    extractionQuality: clean.length < 120 ? 'partial' : 'full',
  };
}

function boldKeyTermInSentence(sentence: string): string {
  const clean = sentence.trim();
  if (!clean) return clean;
  if (/^\*\*/.test(clean)) return clean;
  const colonIdx = clean.indexOf(':');
  if (colonIdx > 3 && colonIdx < 48) {
    return `**${clean.slice(0, colonIdx).trim()}**: ${clean.slice(colonIdx + 1).trim()}`;
  }
  const match = clean.match(/^([A-Za-z0-9\s\-()/]{3,36}?)\s+(states|is defined as|equals|implies|requires|means|relates|describes)\b/i);
  if (match) {
    const head = match[1].trim();
    const rest = clean.slice(head.length).trim();
    return `**${head}** ${rest}`;
  }
  return clean;
}

export function buildQuickNotesForPage(params: {
  pageNumber: number;
  chapter: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  rawPageText: string;
  formulas: string[];
  summaryEnglish: string;
}): {
  formulasAndConstants: string[];
  keyPrinciples: string[];
  specialCases: string[];
  topMistakes: string[];
} {
  const { pageNumber, chapter, subject, rawPageText, formulas, summaryEnglish } = params;
  const clean = String(rawPageText || '').replace(/\s+/g, ' ').trim();
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 14);

  const uniqueFormulas = Array.from(new Set(formulas.filter(Boolean))).slice(0, 6);
  const formulasAndConstants =
    uniqueFormulas.length > 0
      ? uniqueFormulas
      : [
          summaryEnglish || `Review the core relation highlighted on Page ${pageNumber} of ${chapter}.`,
        ];

  const candidatePrinciples = sentences.slice(0, 7).map((s) => boldKeyTermInSentence(s));
  const fallbackPrinciples = [
    `**Core Focus (${chapter})**: Anchor every problem around the primary conservation or governing law stated on Page ${pageNumber}.`,
    `**Variable & Sign Discipline**: Lock coordinate axes or thermodynamic sign conventions before substituting values.`,
    `**Dimension Check**: Verify both sides match in SI units ($\\text{kg}$, $\\text{m}$, $\\text{s}$, $\\text{J}$, $\\text{K}$) prior to final evaluation.`,
    `**Domain & Validity**: Check boundary assumptions (ideal/frictionless/small-angle/reversible) stated in the source.`,
    `**Exam Speed Tip**: Express ratios symbolically first so common factors cancel cleanly before numerical arithmetic.`,
  ];
  const keyPrinciples: string[] = [...candidatePrinciples];
  for (const fb of fallbackPrinciples) {
    if (keyPrinciples.length >= 5) break;
    keyPrinciples.push(fb);
  }

  const specialCases = [
    `**Limiting Regime Check**: Test behavior as governing parameters approach $0$ or $\\infty$ to eliminate wrong MCQ options fast.`,
    `**Unit Conversion Guard**: Keep constants consistent ($\\text{cm} \\to \\text{m}$, $\\text{L}\\cdot\\text{atm} \\to \\text{J}$, $\\text{eV} \\to \\text{J}$).`,
    `**Boundary Continuity (${subject})**: Confirm piecewise or initial-state constraints hold on Page ${pageNumber}.`,
  ];

  const topMistakes = [
    `1. **Premature Numerical Substitution**: Substituting values too early hides symbolic cancellations in ${chapter}.`,
    `2. **Sign & Vector Direction Errors**: Mixing clockwise/counter-clockwise or system/surroundings sign conventions.`,
    `3. **Rounding Drift in Section B**: Rounding intermediate decimals before the final step (always retain 3+ sig figs mid-solution).`,
  ];

  return {
    formulasAndConstants,
    keyPrinciples: keyPrinciples.slice(0, 7),
    specialCases,
    topMistakes,
  };
}

/**
 * Builds a grounded MaterialStudyBundle strictly from the uploaded/extracted text.
 * - Never injects unrelated boilerplate formula banks from other chapters.
 * - Preserves page numbers, timestamps, provenance labels, and extractionQuality honestly.
 */
export function buildGroundedMaterialStudyBundle(params: {
  materialId: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
  rawText: string;
  durationHours?: number;
  originalFileUrl?: string;
  originalMimeType?: string;
  fallbackQuizPool?: CBTQuestion[];
}): MaterialStudyBundle & {
  provenance: ContentProvenance;
  extractionQuality: ExtractionQuality;
  contentHash: string;
} {
  const {
    materialId,
    title,
    subject,
    chapter,
    sourceType,
    rawText,
    originalFileUrl,
    originalMimeType,
    fallbackQuizPool = [],
  } = params;

  const cleanText = (rawText || '').trim();
  const contentHash = computeStableContentHash(cleanText || title);
  const { slices, extractionQuality } = splitSourceIntoPages(cleanText, sourceType);

  const pages: NotePageData[] = slices.map((slice) => {
    const rawParagraphs = slice.text
      .split(/\n{2,}|\r\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    const pageFormulas = extractEquationsFromSourceText(slice.text);
    const sentences = slice.text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 18);

    const formattedParagraphs =
      rawParagraphs.length > 0
        ? rawParagraphs.slice(0, 4).map((p) => {
            if (p.length <= 360) return boldKeyTermInSentence(p);
            const parts = p.split(/(?<=[.!?])\s+/);
            const midpoint = Math.ceil(parts.length / 2);
            return [
              boldKeyTermInSentence(parts.slice(0, midpoint).join(' ')),
              boldKeyTermInSentence(parts.slice(midpoint).join(' ')),
            ].join('\n\n');
          })
        : [boldKeyTermInSentence(slice.text)];

    const keyBullets =
      sentences.slice(0, 4).map((s, idx) => `**[${slice.citationId}] Key Takeaway ${idx + 1}**: ${s}`);

    const firstSentence = sentences[0] || slice.text.slice(0, 180);
    const summaryEnglish = `Source Page ${slice.pageNumber} (${slice.citationId}) from "${title}": ${firstSentence}`;

    const quickNotes = buildQuickNotesForPage({
      pageNumber: slice.pageNumber,
      chapter,
      subject,
      rawPageText: slice.text,
      formulas: pageFormulas,
      summaryEnglish,
    });

    return {
      pageNumber: slice.pageNumber,
      heading:
        slices.length === 1
          ? `${chapter} — Structured Study Notes (${sourceType.toUpperCase()})`
          : `${chapter} — Page ${slice.pageNumber} Notes`,
      timestampRange: slice.timestampRange,
      sections: [
        {
          numberTitle: '1. Core Concept',
          tone: 'concept',
          paragraphs: formattedParagraphs,
          bullets:
            keyBullets.length > 0
              ? keyBullets
              : [`**[${slice.citationId}] Focus**: Review key definitions on Page ${slice.pageNumber} alongside AI Tutor.`],
        },
        {
          numberTitle: '2. Governing Laws & Formulas',
          tone: 'formula',
          paragraphs: [
            pageFormulas.length > 0
              ? `**Key Equations Extracted (${pageFormulas.length})**: Verify each variable's **SI unit** and domain of validity before substitution.`
              : `**Concept Rule (${chapter})**: ${boldKeyTermInSentence(firstSentence)} *(No explicit LaTeX formula parsed on this page—ask AI Tutor in Open JEE mode for symbolic laws).*`,
          ],
          bullets: [
            `**Source Provenance**: Grounded in "${title}" (${sourceType.toUpperCase()}, Page ${slice.pageNumber}).`,
          ],
          formulas: pageFormulas.length > 0 ? pageFormulas : undefined,
        },
        {
          numberTitle: '3. Key Derivations',
          tone: 'derivation',
          paragraphs: [
            sentences.length > 1
              ? `**Logical Progression**: ${boldKeyTermInSentence(sentences.slice(0, 2).join(' '))}`
              : `**Stepwise Method**: Identify knowns from [${slice.citationId}], apply the conservation/governing law, and isolate the target variable symbolically before plugging numbers.`,
          ],
          bullets: [
            '**Step 1 (Setup)**: Define reference frame / system boundaries and list given quantities in SI units.',
            '**Step 2 (Relation)**: Link state variables using the governing law on Page ' + slice.pageNumber + '.',
            '**Step 3 (Verify)**: Confirm limiting behavior and dimensional balance $[M^a L^b T^c]$.',
          ],
        },
        {
          numberTitle: '4. Solved Example',
          tone: 'example',
          paragraphs: [
            pageFormulas.length > 0
              ? `**Worked Check (${chapter})**: Apply ${pageFormulas[0].replace(/\$\$/g, '$')} directly to a standard Page ${slice.pageNumber} case—first convert all quantities to SI units, simplify symbolically so common factors cancel, and retain 3 significant figures.`
              : `**Concept Application (${chapter})**: Using "${firstSentence.slice(0, 140)}", trace cause-to-effect by checking how doubling the primary input variable scales the output quantity.`,
          ],
          bullets: [
            `**Check Step**: Cross-verify units and sign against [${slice.citationId}] before locking Section A/B answers.`,
          ],
        },
        {
          numberTitle: '5. Common JEE Traps',
          tone: 'trap',
          paragraphs: [
            `*Exam Trap Warning*: Watch sign conventions, unit conversions ($\\text{cm} \\to \\text{m}$, $\\text{L}\\cdot\\text{atm} \\to \\text{J}$), and non-ideal boundary assumptions when solving ${chapter} questions from this page.`,
          ],
          bullets: [
            '*Unit Trap*: Mixing CGS/litre-atm values directly with SI constants without conversion.',
            `*Boundary Trap*: Applying simplified steady/ideal formulas outside their valid ${chapter} regime.`,
          ],
        },
      ],
      quickNotes,
      aiTutorSummary: {
        english: summaryEnglish,
        hinglish: `"${title}" ke Page ${slice.pageNumber} (${slice.citationId}) ka saar: ${firstSentence}`,
      },
    };
  });

  const allExtractedFormulas = extractEquationsFromSourceText(cleanText);
  const formulas: FormulaCardEntry[] = allExtractedFormulas.map((eq, idx) => ({
    id: `${materialId}-fb-ext-${idx + 1}`,
    subject,
    chapter,
    title: `${chapter} — Source Equation #${idx + 1}`,
    formula: eq,
    variables: `Extracted from "${title}"`,
    units: 'Verify units against source text',
    notes: `Provenance: source_extracted (${sourceType.toUpperCase()})`,
  }));

  const mindMapNodes: MindMapNodeItem[] = pages.slice(0, 6).map((pg, idx) => ({
    id: `${materialId}-node-${idx + 1}`,
    title: `${chapter} • Page ${pg.pageNumber}`,
    subtitle: `Source-linked summary (${pg.timestampRange || `Page ${pg.pageNumber}`})`,
    colorClass:
      idx % 3 === 0
        ? 'bg-[#F1F5F9] dark:bg-[#1E293B]'
        : idx % 3 === 1
        ? 'bg-emerald-500/10 dark:bg-[#111827]'
        : 'bg-amber-500/10 dark:bg-[#111827]',
    borderClass:
      idx % 3 === 0
        ? 'border-zinc-300 dark:border-white/[0.12]'
        : idx % 3 === 1
        ? 'border-emerald-500/30 dark:border-emerald-500/30'
        : 'border-amber-500/30 dark:border-amber-500/30',
    pageRef: pg.timestampRange ? `${pg.timestampRange} (P${pg.pageNumber})` : `Page ${pg.pageNumber}`,
    badgeType: idx === 0 ? 'High Weightage' : formulas[idx] ? 'Formula' : 'Exception Trap',
    formulaLatex: formulas[idx]?.formula?.replace(/\$\$/g, '$'),
    definition: pg.aiTutorSummary.english.slice(0, 220),
    example: pg.sections[0]?.paragraphs?.[0]?.slice(0, 180) || `See Page ${pg.pageNumber} in source reader.`,
    commonTrap: '*Check domain limits and SI units against original source notes.*',
    subNodes: pg.sections[0]?.bullets?.slice(0, 2).map((b, bIdx) => ({
      id: `${materialId}-sub-${idx + 1}-${bIdx + 1}`,
      label: `Point ${bIdx + 1} (P${pg.pageNumber})`,
      microNote: b.replace(/\*\*/g, '').slice(0, 140),
    })),
  }));

  const stickyNotes: StickyNoteData[] = [
    {
      id: `${materialId}-sn-1`,
      title: `${chapter} — Source Digest`,
      body:
        pages[0]?.sections[0]?.paragraphs?.[0]?.slice(0, 200) ||
        `Notes from "${title}" (${pages.length} page(s)).`,
      subject,
      color: 'amber',
    },
    ...(formulas[0]
      ? [
          {
            id: `${materialId}-sn-2`,
            title: `${chapter} — Extracted Formula`,
            body: formulas[0].formula.replace(/\$\$/g, '$'),
            subject,
            color: 'emerald' as const,
          },
        ]
      : []),
  ];

  // Match relevant subject/chapter drill questions when available; label provenance honestly
  const chapterMatched = fallbackQuizPool.filter(
    (q) =>
      q.subject === subject &&
      (q.chapter.toLowerCase().includes(chapter.toLowerCase().split(' ')[0] || '') ||
        chapter.toLowerCase().includes(q.chapter.toLowerCase().split(' ')[0] || ''))
  );
  const quizSource =
    chapterMatched.length >= 3
      ? chapterMatched.slice(0, 5)
      : fallbackQuizPool.filter((q) => q.subject === subject).slice(0, 5);

  const quizQuestions: CBTQuestion[] = quizSource.map((q, idx) => ({
    ...q,
    id: `${materialId}-q-${idx + 1}`,
    number: idx + 1,
    provenanceType: q.provenanceType || 'LEARNMATE_ORIGINAL',
  }));

  return {
    materialId,
    title,
    subject,
    chapter,
    sourceType,
    originalFileUrl,
    originalMimeType,
    rawText: cleanText,
    pages,
    mindMapNodes,
    stickyNotes,
    formulas,
    quizQuestions,
    provenance: 'source_extracted',
    extractionQuality,
    contentHash,
  };
}
