'use client';

export const scannerSteps = [
  { key: 'input', label: 'Select Input', description: 'Choose your media source' },
  { key: 'extract', label: 'Extract Content', description: 'Transcribe audio to text' },
  { key: 'review', label: 'Review Transcript', description: 'Correct the transcript' },
  { key: 'scan', label: 'Scan for PII', description: 'Detect personal information' },
  { key: 'report', label: 'Privacy Report', description: 'Review and protect' },
] as const;

export type ScannerStep = (typeof scannerSteps)[number]['key'];
export type StepStatus = 'pending' | 'active' | 'complete';

export function stepIndex(step: ScannerStep): number {
  return scannerSteps.findIndex((s) => s.key === step);
}

export function statusFor(current: number, idx: number): StepStatus {
  if (idx < current) return 'complete';
  if (idx === current) return 'active';
  return 'pending';
}