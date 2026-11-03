// Browser-based transcription engine for audio/video files.
// Uses Transformers.js (@xenova/transformers) running Whisper-tiny in the
// browser via WebGPU/WASM. No audio bytes leave the device.
// For live microphone recording, see lib/speech.ts (Web Speech API).

import type { RawFinding } from '@/lib/pii-engine';

export type TranscriptSegment = {
  id: string;
  start: number;   // seconds
  end: number;     // seconds
  text: string;
};

export type TranscribeProgress = (pct: number, label: string) => void;

type Pipeline = Awaited<ReturnType<typeof import('@xenova/transformers').pipeline>>;

let whisperPromise: Promise<Pipeline> | null = null;

async function getWhisper(): Promise<Pipeline> {
  if (!whisperPromise) {
    const { pipeline } = await import('@xenova/transformers');
    whisperPromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
      progress_callback: () => {},
    }) as Promise<Pipeline>;
  }
  return whisperPromise;
}

// Decode an audio/video File into a Float32Array at 16kHz mono using the
// browser's WebAudio API — the format Whisper expects.
async function decodeAudio(file: Blob, onProgress?: TranscribeProgress): Promise<Float32Array> {
  onProgress?.(5, 'Decoding audio…');
  const arrayBuf = await file.arrayBuffer();
  const AudioCtx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuf);
  } catch {
    // Some video containers need a different approach — try again with a copy
    decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0));
  }
  audioCtx.close();

  const targetSampleRate = 16000;
  const numChannels = decoded.numberOfChannels;
  const sourceLen = decoded.length;
  const ratio = decoded.sampleRate / targetSampleRate;
  const targetLen = Math.floor(sourceLen / ratio);
  const out = new Float32Array(targetLen);

  // Mix down to mono
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channelData.push(decoded.getChannelData(ch));

  for (let i = 0; i < targetLen; i++) {
    const srcIdx = Math.floor(i * ratio);
    let sample = 0;
    for (let ch = 0; ch < numChannels; ch++) sample += channelData[ch][srcIdx] ?? 0;
    out[i] = sample / numChannels;
  }
  onProgress?.(20, 'Audio decoded');
  return out;
}

export async function transcribeAudio(
  file: File | Blob,
  onProgress?: TranscribeProgress,
  withTimestamps = true,
): Promise<TranscriptSegment[]> {
  onProgress?.(0, 'Loading speech model…');
  const whisper = await getWhisper();
  onProgress?.(10, 'Model ready');

  const audioData = await decodeAudio(file, onProgress);

  // chunk_length 30s with timestamps produces per-segment results
  onProgress?.(30, 'Transcribing audio…');
  let result: any;
  try {
    if (withTimestamps) {
      result = await (whisper as any)(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      });
    } else {
      result = await (whisper as any)(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
      });
    }
  } catch (err) {
    // Fallback: no timestamps
    onProgress?.(40, 'Retrying without timestamps…');
    result = await (whisper as any)(audioData, { chunk_length_s: 30, stride_length_s: 5 });
  }

  onProgress?.(90, 'Processing transcript…');

  const segments: TranscriptSegment[] = [];
  if (result && Array.isArray(result.chunks)) {
    for (let i = 0; i < result.chunks.length; i++) {
      const c = result.chunks[i];
      segments.push({
        id: `seg-${i}`,
        start: Math.round((c.timestamp?.[0] ?? 0) * 100) / 100,
        end: Math.round((c.timestamp?.[1] ?? 0) * 100) / 100,
        text: (c.text ?? '').trim(),
      });
    }
  } else if (result && typeof result.text === 'string') {
    segments.push({
      id: 'seg-0',
      start: 0,
      end: 0,
      text: result.text.trim(),
    });
  }

  onProgress?.(100, 'Transcription complete');
  return segments;
}

// Check whether the browser can decode and run Whisper (WebGPU or WASM).
export function isTranscriptionSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  // Transformers.js falls back to WASM if WebGPU is unavailable, so almost
  // any modern browser works. Return true optimistically.
  return true;
}

// Convert segments to plain text (for the PII engine, which works on text).
export function segmentsToText(segments: TranscriptSegment[]): string {
  return segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
}

// Map PII findings (which use character offsets in the concatenated text)
// back to the segment they appear in, for highlight rendering.
export function mapFindingsToSegments(
  segments: TranscriptSegment[],
  findings: RawFinding[],
): Map<string, RawFinding[]> {
  const text = segmentsToText(segments);
  const map = new Map<string, RawFinding[]>();
  // Build cumulative character offsets per segment
  let offset = 0;
  const offsets: number[] = [];
  for (const s of segments) {
    offsets.push(offset);
    offset += s.text.length + 1; // +1 for the join space
  }
  for (const f of findings) {
    // Find which segment this finding's start falls into
    let segIdx = 0;
    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i] <= f.start) segIdx = i;
      else break;
    }
    const segId = segments[segIdx]?.id;
    if (segId) {
      const arr = map.get(segId) ?? [];
      arr.push(f);
      map.set(segId, arr);
    }
  }
  return map;
}
