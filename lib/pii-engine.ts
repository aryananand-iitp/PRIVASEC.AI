// Real PII detection engine for text content. Uses regex patterns,
// validation, and contextual heuristics. No fake results — if a pattern
// doesn't match, no finding is produced. Confidence is computed from
// validation strength and surrounding context.

export type PiiCategory =
  | 'email'
  | 'phone'
  | 'credit_card'
  | 'bank_account'
  | 'ip_address'
  | 'api_key'
  | 'auth_token'
  | 'username'
  | 'passport'
  | 'government_id'
  | 'license_plate'
  | 'date_of_birth'
  | 'full_address'
  | 'gps_coordinates'
  | 'person_name';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type RawFinding = {
  category: PiiCategory;
  value: string;
  start: number;
  end: number;
  confidence: number; // 0..1
};

export type Finding = RawFinding & {
  masked_value: string;
  snippet: string;
  location: string;
  severity: Severity;
  why_sensitive: string;
  why_matters: string;
  recommended_action: string;
};

type PatternDef = {
  category: PiiCategory;
  re: RegExp;
  validate?: (v: string, ctx: string) => boolean;
  minConfidence: number;
  baseSeverity: Severity;
};

// --- Pattern definitions ---

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE = /(?:(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)|\d{1,4})[\s.-]?)\d{3,4}[\s.-]?\d{3,4}\b/g;
const CC_RE = /\b(?:\d[ -]?){13,16}\b/g;
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const IPV6_RE = /\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b/g;
const APIKEY_RE = /\b(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/gi;
const AUTHTOKEN_RE = /\b(?:bearer|authorization|auth[_-]?token|access[_-]?token)\s*[:=]\s*['"]?[A-Za-z0-9_\-\.]{16,}['"]?/gi;
const USERNAME_RE = /(?<=^|\s)@[A-Za-z0-9_]{3,30}(?=\s|$)/g;
const PASSPORT_RE = /\b[A-Z]{1,2}\d{7,9}\b/g;
const LICENSE_PLATE_RE = /\b[A-Z]{2,3}[-\s]?\d{1,4}[-\s]?[A-Z]{0,2}\b/g;
const GPS_RE = /(?:lat[:\s]*-?\d{1,3}\.\d+[, ]+lng[:\s]*-?\d{1,3}\.\d+)|(-?\d{1,3}\.\d{4,},\s*-?\d{1,3}\.\d{4,})/gi;

// Indicative patterns — require context keywords nearby to elevate confidence.
const BANK_RE = /\b\d{9,18}\b/g;
const GOV_ID_RE = /\b[A-Z]{3}\d{7}\b|\b\d{10,12}\b/g;
const DOB_RE = /\b(?:DOB|date of birth|born on|birth date)[:\s]*?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/gi;

const PATTERNS: PatternDef[] = [
  { category: 'email', re: EMAIL_RE, minConfidence: 0.95, baseSeverity: 'high' },
  { category: 'phone', re: PHONE_RE, validate: (v: string) => v.replace(/\D/g, '').length >= 7, minConfidence: 0.7, baseSeverity: 'medium' },
  { category: 'credit_card', re: CC_RE, validate: luhnCheck, minConfidence: 0.9, baseSeverity: 'critical' },
  { category: 'ip_address', re: IPV4_RE, minConfidence: 0.85, baseSeverity: 'medium' },
  { category: 'ip_address', re: IPV6_RE, minConfidence: 0.8, baseSeverity: 'medium' },
  { category: 'api_key', re: APIKEY_RE, minConfidence: 0.9, baseSeverity: 'critical' },
  { category: 'auth_token', re: AUTHTOKEN_RE, minConfidence: 0.9, baseSeverity: 'critical' },
  { category: 'username', re: USERNAME_RE, minConfidence: 0.6, baseSeverity: 'low' },
  { category: 'passport', re: PASSPORT_RE, validate: (v: string) => /[A-Z]/.test(v) && /\d/.test(v), minConfidence: 0.75, baseSeverity: 'critical' },
  { category: 'license_plate', re: LICENSE_PLATE_RE, minConfidence: 0.65, baseSeverity: 'medium' },
  { category: 'gps_coordinates', re: GPS_RE, minConfidence: 0.8, baseSeverity: 'high' },
  { category: 'bank_account', re: BANK_RE, validate: (v: string, ctx: string) => /\b(bank|account|acct|iban|routing)\b/i.test(ctx), minConfidence: 0.55, baseSeverity: 'high' },
  { category: 'government_id', re: GOV_ID_RE, validate: (v: string, ctx: string) => /\b(id|aadhaar|ssn|national|government|license|passport|pan)\b/i.test(ctx), minConfidence: 0.5, baseSeverity: 'high' },
  { category: 'date_of_birth', re: DOB_RE, minConfidence: 0.85, baseSeverity: 'high' },
];

// Luhn checksum — validates credit card number structure.
function luhnCheck(v: string, _ctx?: string): boolean {
  const digits = v.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

// Person name detection: capitalized word pairs preceded by name-context cues.
function detectNames(text: string): RawFinding[] {
  const findings: RawFinding[] = [];
  const nameCues = /\b(?:mr|mrs|ms|dr|shri|smt|name(?:d)? is|name:|signed|regards|yours truly|sincerely)\b[,:]?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/gi;
  let m;
  while ((m = nameCues.exec(text)) !== null) {
    findings.push({
      category: 'person_name',
      value: m[1],
      start: m.index + m[0].length - m[1].length,
      end: m.index + m[0].length,
      confidence: 0.7,
    });
  }
  return findings;
}

// Full address: street number + street name + city-ish pattern, requires
// address-context cue nearby.
function detectAddresses(text: string): RawFinding[] {
  const findings: RawFinding[] = [];
  const addrRe = /\b(\d{1,5}\s+[A-Z][A-Za-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Place|Pl|Marg|Galli|Chowk)[,.]?\s+[A-Z][A-Za-z]+(?:,?\s*[A-Z]{2})?(?:\s+\d{4,6})?)\b/g;
  let m;
  while ((m = addrRe.exec(text)) !== null) {
    const ctx = text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80);
    const hasCue = /\b(address|residence|live at|located at|home|office|flat|house)\b/i.test(ctx);
    findings.push({
      category: 'full_address',
      value: m[1],
      start: m.index,
      end: m.index + m[1].length,
      confidence: hasCue ? 0.8 : 0.5,
    });
  }
  return findings;
}

export function detectPii(text: string): RawFinding[] {
  const raw: RawFinding[] = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(text)) !== null) {
      const value = m[0];
      const start = m.index;
      const end = m.index + value.length;
      const ctx = text.slice(Math.max(0, start - 100), Math.min(text.length, end + 100));
      if (p.validate && !p.validate(value, ctx)) continue;
      // Boost confidence when validating succeeded; otherwise use minConfidence.
      const confidence = Math.min(0.99, p.minConfidence + (p.validate ? 0.05 : 0));
      raw.push({ category: p.category, value, start, end, confidence });
    }
  }
  raw.push(...detectNames(text));
  raw.push(...detectAddresses(text));

  // De-duplicate overlapping findings — keep the higher-confidence one.
  raw.sort((a, b) => a.start - b.start || b.confidence - a.confidence);
  const deduped: RawFinding[] = [];
  let lastEnd = -1;
  for (const f of raw) {
    if (f.start < lastEnd) continue;
    deduped.push(f);
    lastEnd = f.end;
  }
  return deduped;
}

// --- Explanations ---

const EXPLANATIONS: Record<PiiCategory, {
  severity: Severity;
  why_sensitive: string;
  why_matters: string;
  recommended_action: string;
}> = {
  email: {
    severity: 'high',
    why_sensitive: 'An email address directly identifies a person and is often used as a username for many services.',
    why_matters: 'Public exposure can increase unwanted contact, spam, phishing attempts, and social-engineering risk. It does not by itself mean an account has been compromised.',
    recommended_action: 'Mask or permanently redact the email address before sharing. Avoid posting it in publicly indexed content.',
  },
  phone: {
    severity: 'medium',
    why_sensitive: 'A phone number can identify an individual and enable direct contact, SMS phishing (smishing), and account-recovery attacks.',
    why_matters: 'Exposure may lead to spam calls or messages and can be used in social-engineering attempts. It does not confirm any account is compromised.',
    recommended_action: 'Mask all but the last few digits, or redact entirely, before publishing.',
  },
  credit_card: {
    severity: 'critical',
    why_sensitive: 'A credit or debit card number is a payment instrument. Valid numbers (passing Luhn) are especially sensitive.',
    why_matters: 'Exposure can enable fraudulent transactions and identity theft. Treat any valid-looking card number as critical.',
    recommended_action: 'Permanently redact the full number. Never mask only part of a card number in content intended for public sharing.',
  },
  bank_account: {
    severity: 'high',
    why_sensitive: 'Bank account numbers can be used to identify and move funds in some jurisdictions.',
    why_matters: 'Exposure can enable unauthorized transfers or fraud, especially combined with other identifiers.',
    recommended_action: 'Redact the account number entirely. Do not share banking details in public content.',
  },
  ip_address: {
    severity: 'medium',
    why_sensitive: 'An IP address can reveal approximate location, ISP, and be used for targeted attacks.',
    why_matters: 'Exposure may allow network-level probing or approximate geolocation. It does not by itself grant access to any device.',
    recommended_action: 'Redact IP addresses from logs or screenshots before sharing.',
  },
  api_key: {
    severity: 'critical',
    why_sensitive: 'An API key grants programmatic access to a service or account.',
    why_matters: 'Exposure can lead to unauthorized access, abuse, or billing fraud. Treat any exposed API key as a confirmed credential incident and rotate it immediately.',
    recommended_action: 'Redact the key and rotate (revoke + regenerate) it in the issuing service immediately.',
  },
  auth_token: {
    severity: 'critical',
    why_sensitive: 'An authentication token or bearer token impersonates a user session.',
    why_matters: 'Exposure can allow full account takeover. Treat any exposed token as a confirmed credential incident and invalidate active sessions.',
    recommended_action: 'Redact the token and invalidate all sessions in the issuing service immediately.',
  },
  username: {
    severity: 'low',
    why_sensitive: 'A username is a public handle on a platform. It is usually not secret, but can be used to profile or target.',
    why_matters: 'Exposure alone is low risk, but combined with other identifiers it can aid impersonation or account-targeting.',
    recommended_action: 'Usually safe to keep in public content. Consider masking if the username is tied to a sensitive context.',
  },
  passport: {
    severity: 'critical',
    why_sensitive: 'A passport number is a government identity document identifier.',
    why_matters: 'Exposure can enable identity theft, travel fraud, and impersonation. Treat as critical and never share publicly.',
    recommended_action: 'Permanently redact. If the document itself was shared, also redact the full document image.',
  },
  government_id: {
    severity: 'high',
    why_sensitive: 'A national ID, SSN, Aadhaar, or similar government identifier uniquely identifies a person.',
    why_matters: 'Exposure can enable identity theft, benefit fraud, and impersonation. Treat as sensitive personal data.',
    recommended_action: 'Permanently redact. Never publish government identifiers in any content.',
  },
  license_plate: {
    severity: 'medium',
    why_sensitive: 'A vehicle registration plate can identify the owner and track movement.',
    why_matters: 'Exposure can aid physical-world tracking or vehicle-related fraud. It does not by itself confirm ownership details.',
    recommended_action: 'Blur the plate in images/videos, or redact the number in text, before sharing.',
  },
  date_of_birth: {
    severity: 'high',
    why_sensitive: 'A date of birth is a key identity attribute used in account recovery and verification.',
    why_matters: 'Exposure can help bypass identity-verification questions and aid impersonation.',
    recommended_action: 'Redact the full date. Avoid sharing birth dates alongside names in public content.',
  },
  full_address: {
    severity: 'high',
    why_sensitive: 'A residential or workplace address can pinpoint a person\'s physical location.',
    why_matters: 'Exposure can enable stalking, harassment, or physical-world targeting. It does not confirm anyone is currently at that location.',
    recommended_action: 'Redact or generalize the address before sharing. Remove house/flat numbers first.',
  },
  gps_coordinates: {
    severity: 'high',
    why_sensitive: 'GPS coordinates give an exact geographic location.',
    why_matters: 'Exposure can reveal a person\'s home, workplace, or frequent locations with high precision.',
    recommended_action: 'Strip GPS metadata from photos and videos before sharing. Redact explicit coordinates in text.',
  },
  person_name: {
    severity: 'medium',
    why_sensitive: 'A personal name identifies an individual. On its own it is often public, but in sensitive contexts it can matter.',
    why_matters: 'Exposure alone is low risk, but combined with other identifiers it can aid impersonation or targeting. Context matters.',
    recommended_action: 'Review the surrounding context. Mask the name if it appears alongside other personal identifiers.',
  },
};

function maskValue(value: string, category: PiiCategory): string {
  switch (category) {
    case 'email': {
      const [u, d] = value.split('@');
      return `${u.slice(0, 2)}${'*'.repeat(Math.max(2, u.length - 2))}@${d}`;
    }
    case 'phone':
      return value.replace(/\d(?=\d{2})/g, '*');
    case 'credit_card':
      return '*'.repeat(value.length - 4) + value.slice(-4);
    case 'api_key':
    case 'auth_token':
      return value.slice(0, 6) + '*'.repeat(Math.max(4, value.length - 6));
    case 'ip_address':
      return value.replace(/\d/g, (d, i) => (i < value.lastIndexOf('.') ? '*' : d));
    default:
      return '*'.repeat(Math.min(value.length, 8));
  }
}

function makeSnippet(text: string, start: number, end: number): string {
  const pad = 24;
  const s = Math.max(0, start - pad);
  const e = Math.min(text.length, end + pad);
  return (s > 0 ? '…' : '') + text.slice(s, e) + (e < text.length ? '…' : '');
}

function makeLocation(text: string, start: number): string {
  const upto = text.slice(0, start);
  const line = upto.split('\n').length;
  const col = start - (upto.lastIndexOf('\n') + 1) + 1;
  return `Line ${line}, Column ${col}`;
}

function severityFor(category: PiiCategory, confidence: number): Severity {
  const base = EXPLANATIONS[category].severity;
  // Slightly elevate if confidence is very high and base is not already critical.
  if (base === 'critical') return 'critical';
  if (base === 'high' && confidence >= 0.9) return 'high';
  if (base === 'medium' && confidence >= 0.85) return 'high';
  return base;
}

export function explainFindings(text: string): Finding[] {
  const raw = detectPii(text);
  return raw.map((r) => {
    const ex = EXPLANATIONS[r.category];
    return {
      ...r,
      masked_value: maskValue(r.value, r.category),
      snippet: makeSnippet(text, r.start, r.end),
      location: makeLocation(text, r.start),
      severity: severityFor(r.category, r.confidence),
      why_sensitive: ex.why_sensitive,
      why_matters: ex.why_matters,
      recommended_action: ex.recommended_action,
    };
  });
}

// --- Risk scoring ---

export type RiskBand = 'low' | 'moderate' | 'high' | 'critical';

export function riskBand(score: number): RiskBand {
  if (score <= 20) return 'low';
  if (score <= 40) return 'moderate';
  if (score <= 70) return 'high';
  return 'critical';
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  low: 4,
  medium: 12,
  high: 25,
  critical: 40,
};

export function computeRiskScore(findings: Finding[]): number {
  if (findings.length === 0) return 0;
  let raw = 0;
  for (const f of findings) {
    raw += SEVERITY_WEIGHT[f.severity] * f.confidence;
  }
  // Diminishing returns: many findings shouldn't push past 100 trivially.
  const scaled = Math.min(100, Math.round(raw / (1 + raw * 0.012)));
  return Math.max(1, scaled);
}

// --- Redaction ---

export type RedactMode = 'mask' | 'redact';

export function applyRedaction(text: string, findings: Finding[], mode: RedactMode, selected: Set<string>): string {
  // Replace selected findings' value spans. Process from the end backwards so
  // earlier offsets don't shift.
  const sorted = findings
    .filter((f) => selected.has(f.category + '|' + f.start))
    .sort((a, b) => b.start - a.start);
  let out = text;
  for (const f of sorted) {
    const replacement = mode === 'redact' ? '[REDACTED]' : f.masked_value;
    out = out.slice(0, f.start) + replacement + out.slice(f.end);
  }
  return out;
}

export function verifyRedaction(protectedText: string, originalFindings: Finding[]): {
  removedCount: number;
  remainingCount: number;
  remainingValues: string[];
  finalScore: number;
} {
  let removedCount = 0;
  const remainingValues: string[] = [];
  for (const f of originalFindings) {
    if (protectedText.includes(f.value)) {
      remainingValues.push(f.masked_value);
    } else {
      removedCount += 1;
    }
  }
  const remainingCount = originalFindings.length - removedCount;
  const finalScore = remainingCount === 0 ? 0 : computeRiskScore(
    explainFindings(protectedText)
  );
  return { removedCount, remainingCount, remainingValues, finalScore };
}

// --- Language hint detection ---

export function detectLanguageHint(text: string): string {
  // Very rough: check Unicode script ranges for a first hint. Falls back to 'en'.
  if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Devanagari (Hindi, Marathi)
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa';
  if (/[\u0600-\u06FF]/.test(text)) return 'ur'; // Arabic script (Urdu/Arabic)
  if (/[\u0E00-\u0E7F]/.test(text)) return 'th';
  return 'en';
}

export const CATEGORY_LABELS: Record<PiiCategory, string> = {
  email: 'Email Address',
  phone: 'Phone Number',
  credit_card: 'Credit Card Number',
  bank_account: 'Bank Account Number',
  ip_address: 'IP Address',
  api_key: 'API Key',
  auth_token: 'Authentication Token',
  username: 'Username / Handle',
  passport: 'Passport Number',
  government_id: 'Government ID Number',
  license_plate: 'License Plate',
  date_of_birth: 'Date of Birth',
  full_address: 'Street Address',
  gps_coordinates: 'GPS Coordinates',
  person_name: 'Person Name',
};
