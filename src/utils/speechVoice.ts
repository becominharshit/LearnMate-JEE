export type SpeechLocaleTarget = 'pure_hindi' | 'hinglish_faculty' | 'indian_english' | 'pure_english';

export function hasDevanagariScript(text: string): boolean {
  return /[\u0900-\u097F]/.test(String(text || ''));
}

/**
 * Deterministically picks the closest installed SpeechSynthesisVoice for the requested
 * persona/locale without falling back to an unrelated language accent.
 */
export function selectSpeechSynthesisVoice(
  voices: Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'default'>[],
  target: SpeechLocaleTarget,
  spokenText = ''
): { voice: Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'default'> | null; lang: string } {
  const effectiveTarget: SpeechLocaleTarget =
    target === 'pure_hindi' || hasDevanagariScript(spokenText) ? 'pure_hindi' : target;

  const normalized = voices.map((v) => ({
    voice: v,
    lang: String(v.lang || '').toLowerCase(),
    name: String(v.name || '').toLowerCase(),
  }));

  if (effectiveTarget === 'pure_hindi') {
    const exactHiIn = normalized.find((v) => v.lang === 'hi-in' || v.lang === 'hi_in');
    const anyHi = normalized.find((v) => v.lang.startsWith('hi'));
    const namedHindi = normalized.find((v) => /hindi|lekha|kalpana|hemant|swara|madhur/.test(v.name));
    const fallbackIn = normalized.find((v) => v.lang === 'en-in' || v.lang === 'en_in');
    const chosen = exactHiIn || anyHi || namedHindi || fallbackIn;
    return {
      voice: chosen ? chosen.voice : null,
      lang: 'hi-IN',
    };
  }

  if (effectiveTarget === 'indian_english' || effectiveTarget === 'hinglish_faculty') {
    const exactEnIn = normalized.find((v) => v.lang === 'en-in' || v.lang === 'en_in');
    const namedIndian = normalized.find(
      (v) =>
        v.lang.startsWith('en') &&
        /india|indian|ravi|heera|neerja|prabhat|rishi|veena|sangeeta/.test(v.name)
    );
    const anyHi = normalized.find((v) => v.lang.startsWith('hi'));
    const ukEnglish = normalized.find((v) => v.lang === 'en-gb' || v.lang === 'en_gb');
    const chosen =
      effectiveTarget === 'hinglish_faculty'
        ? exactEnIn || namedIndian || anyHi || ukEnglish
        : exactEnIn || namedIndian || ukEnglish;
    return {
      voice: chosen ? chosen.voice : null,
      lang: 'en-IN',
    };
  }

  // Pure English: strictly avoid Indian/Hindi voice overrides
  const exactEnUs = normalized.find((v) => v.lang === 'en-us' || v.lang === 'en_us');
  const exactEnGb = normalized.find((v) => v.lang === 'en-gb' || v.lang === 'en_gb');
  const anyNeutralEn = normalized.find(
    (v) => v.lang.startsWith('en') && !v.lang.includes('in')
  );
  const chosen = exactEnUs || exactEnGb || anyNeutralEn;
  return {
    voice: chosen ? chosen.voice : null,
    lang: chosen ? chosen.voice.lang || 'en-US' : 'en-US',
  };
}

export function speakWithLocaleVoice(params: {
  text: string;
  target: SpeechLocaleTarget;
  onEnd?: () => void;
  rate?: number;
}): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    params.onEnd?.();
    return;
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  const cleanSpoken = String(params.text || '')
    .replace(/\$\$[^$]+\$\$/g, ' equation ')
    .replace(/\$[^$]+\$/g, ' formula ')
    .replace(/[*#_`]/g, '')
    .trim();

  if (!cleanSpoken) {
    params.onEnd?.();
    return;
  }

  const triggerSpeak = () => {
    const voices = synth.getVoices();
    const { voice, lang } = selectSpeechSynthesisVoice(voices, params.target, cleanSpoken);
    const utter = new SpeechSynthesisUtterance(cleanSpoken);
    utter.lang = lang;
    utter.rate = params.rate ?? 1.0;
    if (voice) {
      utter.voice = voice as SpeechSynthesisVoice;
    }
    if (params.onEnd) {
      utter.onend = () => params.onEnd?.();
      utter.onerror = () => params.onEnd?.();
    }
    synth.speak(utter);
  };

  if (synth.getVoices().length > 0) {
    triggerSpeak();
    return;
  }

  let spoken = false;
  const handleVoicesChanged = () => {
    if (spoken) return;
    spoken = true;
    synth.removeEventListener?.('voiceschanged', handleVoicesChanged);
    triggerSpeak();
  };
  synth.addEventListener?.('voiceschanged', handleVoicesChanged);
  window.setTimeout(() => {
    if (!spoken) {
      spoken = true;
      synth.removeEventListener?.('voiceschanged', handleVoicesChanged);
      triggerSpeak();
    }
  }, 180);
}
