// Browser-based speech-to-text using the Web Speech API.
// Runs via the browser's built-in speech recognition service (Chrome, Edge).
// No external packages or servers required from our side.

// Minimal typings for the Web Speech API (not in standard lib.dom.d.ts everywhere).
export interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
export interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return (w.SpeechRecognition || w.webkitSpeechRecognition) ?? null;
}

export function isSpeechSupported(): boolean {
  return getCtor() !== null;
}

export interface SpeechHandlers {
  onPartial?: (text: string) => void;
  onFinal?: (text: string, timestamp?: number) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
  onStart?: () => void;
}

export interface SpeechSession {
  stop: () => void;
}

// Map our app language codes to BCP-47 tags the Web Speech API understands.
const LANG_BCP47: Record<string, string> = {
  en: 'en-US',
  hi: 'hi-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
  ur: 'ur-PK',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  ar: 'ar-SA',
  pt: 'pt-BR',
  id: 'id-ID',
};

export function speechLang(lang: string): string {
  return LANG_BCP47[lang] ?? 'en-US';
}

export function startSpeech(lang: string, handlers: SpeechHandlers): SpeechSession | null {
  const Ctor = getCtor();
  if (!Ctor) {
    handlers.onError?.('not-supported');
    return null;
  }
  const rec = new Ctor();
  rec.lang = speechLang(lang);
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onstart = () => handlers.onStart?.();
  let segStart = 0;
  rec.onresult = (e: SpeechRecognitionEvent) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) handlers.onPartial?.(interim);
    if (final) {
      const now = (Date.now() - segStart) / 1000;
      handlers.onFinal?.(final.trim(), Math.round(now * 100) / 100);
    }
  };
  rec.onerror = (e: SpeechRecognitionErrorEvent) => handlers.onError?.(e.error);
  rec.onend = () => handlers.onEnd?.();

  try {
    rec.start();
    segStart = Date.now();
  } catch {
    handlers.onError?.('start-failed');
    return null;
  }
  return {
    stop: () => {
      try { rec.stop(); } catch { /* noop */ }
    },
  };
}
