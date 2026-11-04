import type { PiiCategory, RawFinding } from './types';
import { ibanValid, isStrongSecret, luhnValid, verhoeffValid } from './validators';

type Detector = (text: string) => RawFinding[];

const CUE = {
  phone: /\b(?:phone|mobile|cell|tel|telephone|contact|call|whatsapp|sms|mob|fax)\b|फोन|मोबाइल/i,
  aadhaar: /aadhaar|aadhar|adhaar|\bUID\b|आधार/i,
  pan: /\bPAN\b|[Pp]ermanent [Aa]ccount/,
  passport: /passport|travel document/i,
  bank: /\b(?:bank|account|acct|routing|ifsc|swift)\b/i,
  ssn: /\bSSN\b|social security/i,
  gps: /\b(?:gps|coordinates?|coords?|location|latlng|geo|geolocation)\b/i,
  address: /\b(?:address|addr|residence|resides|lives at|live at|located at|home|office|flat|house|apartment|ship(?:ping)? to|deliver(?:y)? to|mailing|postal)\b/i,
  ip: /\b(?:ip|ip address|host|hostname|server|client|remote|src|dst|source|origin)\b/i,
  plate: /\b(?:plate|registration|vehicle|car|bike|reg\.? ?no|number plate)\b/i,
};

const POSTAL_RE = /\b\d{5}(?:-\d{4})?\b|\b\d{6}\b/;

function nearby(text: string, start: number, end: number, cue: RegExp, radius = 60): boolean {
  return cue.test(text.slice(Math.max(0, start - radius), Math.min(text.length, end + radius)));
}

function finding(text: string, category: PiiCategory, start: number, end: number, confidence: number): RawFinding[] {
  return confidence > 0 ? [{ category, value: text.slice(start, end), start, end, confidence }] : [];
}

function allMatches(re: RegExp, text: string): RegExpMatchArray[] {
  return Array.from(text.matchAll(re));
}

// Email

const EMAIL_RE = /(?<![A-Za-z0-9._%+-])[A-Za-z0-9_%+-][A-Za-z0-9._%+-]{0,63}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}(?![A-Za-z0-9-])/g;
const PLACEHOLDER_DOMAIN_RE = /[@.](?:example|test|invalid|localhost|domain)\.(?:com|org|net|edu|local|test)$/i;

function detectEmails(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(EMAIL_RE, text)) {
    const value = m[0];
    const start = m.index ?? 0;
    const local = value.slice(0, value.indexOf('@'));
    if (local.includes('..') || local.endsWith('.')) continue;
    if (PLACEHOLDER_DOMAIN_RE.test(value)) continue;
    out.push(...finding(text, 'email', start, start + value.length, 0.97));
  }
  return out;
}

// Phone (international, Indian mobile, North American formats)

const PHONE_RE = /(?<![\w+])(?:\+\d{1,3}[ .-]?)?(?:\(\d{1,4}\)[ .-]?)?\d{2,5}(?:[ .-]?\d{2,5}){0,4}(?!\w)/g;
const DATE_LIKE_RE = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$|^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/;
const IPV4_LIKE_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function phoneConfidence(raw: string, text: string, start: number, end: number): number {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return 0;
  if (/^(\d)\1+$/.test(digits)) return 0;
  if (DATE_LIKE_RE.test(raw) || IPV4_LIKE_RE.test(raw)) return 0;
  if (raw.startsWith('+')) return digits.length >= 8 ? 0.9 : 0;
  const cue = nearby(text, start, end, CUE.phone, 40);
  if (digits.length === 10 && /^[6-9]/.test(digits)) return cue ? 0.9 : 0.7;
  if (cue) return 0.85;
  if (/[ .()-]/.test(raw) && digits.length >= 10) return 0.75;
  return 0;
}

function detectPhones(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(PHONE_RE, text)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    out.push(...finding(text, 'phone', start, end, phoneConfidence(m[0], text, start, end)));
  }
  return out;
}

// Aadhaar (12 digits, Verhoeff checksum)

const AADHAAR_RE = /(?<!\d)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?!\d)/g;

function detectAadhaar(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(AADHAAR_RE, text)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (!verhoeffValid(m[0].replace(/\D/g, ''))) continue;
    const confidence = nearby(text, start, end, CUE.aadhaar) ? 0.95 : 0.6;
    out.push(...finding(text, 'aadhaar', start, end, confidence));
  }
  return out;
}

// PAN (Indian Permanent Account Number: AAAPA1234A)

const PAN_RE = /(?<![A-Za-z0-9])[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z](?![A-Za-z0-9])/g;

function detectPan(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(PAN_RE, text)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const confidence = nearby(text, start, end, CUE.pan) ? 0.95 : 0.7;
    out.push(...finding(text, 'pan', start, end, confidence));
  }
  return out;
}

// Credit cards (13-19 digits, Luhn, rejects repeated digits)

const CARD_RE = /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g;
const CARD_PREFIX_RE = /^(?:4|5[1-5]|2[2-7]|3[47]|6011|65|3[068])/;

function detectCards(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(CARD_RE, text)) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) continue;
    if (/^(\d)\1+$/.test(digits)) continue;
    if (!luhnValid(digits)) continue;
    const start = m.index ?? 0;
    out.push(...finding(text, 'credit_card', start, start + m[0].length, CARD_PREFIX_RE.test(digits) ? 0.97 : 0.9));
  }
  return out;
}

// Bank accounts: IBAN (mod-97 checked) and cue-gated national account numbers

const IBAN_RE = /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?(?![A-Za-z0-9])/g;
const ACCOUNT_DIGITS_RE = /(?<!\d)\d{9,18}(?!\d)/g;

function detectBankAccounts(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(IBAN_RE, text)) {
    const clean = m[0].replace(/ /g, '');
    if (clean.length < 15 || clean.length > 34 || !ibanValid(clean)) continue;
    const start = m.index ?? 0;
    out.push(...finding(text, 'bank_account', start, start + m[0].length, 0.95));
  }
  for (const m of allMatches(ACCOUNT_DIGITS_RE, text)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (!nearby(text, start, end, CUE.bank, 40)) continue;
    out.push(...finding(text, 'bank_account', start, end, 0.8));
  }
  return out;
}

// Government IDs: US SSN (cue required)

const SSN_RE = /(?<![\d-])\d{3}-\d{2}-\d{4}(?![\d-])/g;

function detectSsn(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(SSN_RE, text)) {
    const [area, group, serial] = m[0].split('-');
    if (area === '000' || area === '666' || area.startsWith('9') || group === '00' || serial === '0000') continue;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const confidence = nearby(text, start, end, CUE.ssn, 40) ? 0.95 : 0;
    out.push(...finding(text, 'government_id', start, end, confidence));
  }
  return out;
}

// Passport numbers (cue required)

const PASSPORT_RE = /(?<![A-Za-z0-9])(?:[A-PR-WYZ]\d{7}|[A-Z]{1,2}\d{7,8})(?![A-Za-z0-9])/g;

function detectPassports(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(PASSPORT_RE, text)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (!nearby(text, start, end, CUE.passport, 60)) continue;
    out.push(...finding(text, 'passport', start, end, 0.9));
  }
  return out;
}

// Date of birth (cue required, month and day validated)

const DOB_RE = /(?<=\b(?:DOB|D\.O\.B\.?|date of birth|born on|birth ?date|born)\s*[:-]?\s*)(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2})(?!\d)/gi;

function detectDates(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(DOB_RE, text)) {
    const parts = m[1].split(/[/.-]/).map(Number);
    const [day, month] = String(parts[0]).length === 4 ? [parts[2], parts[1]] : [parts[0], parts[1]];
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    out.push(...finding(text, 'date_of_birth', start, end, 0.9));
  }
  return out;
}

// Vehicle plates (Indian format, state code validated, cue required)

const PLATE_RE = /(?<![A-Za-z0-9])([A-Z]{2})[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4}(?![A-Za-z0-9])/g;
const INDIAN_STATE_CODES = new Set([
  'AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CG', 'DD', 'DL', 'DN', 'GA', 'GJ', 'HR', 'HP', 'JH', 'JK', 'KA', 'KL',
  'LA', 'LD', 'MH', 'ML', 'MN', 'MP', 'MZ', 'NL', 'OD', 'PB', 'PY', 'RJ', 'SK', 'TN', 'TG', 'TR', 'UP', 'UK', 'UA', 'WB',
]);

function detectPlates(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(PLATE_RE, text)) {
    if (!INDIAN_STATE_CODES.has(m[1])) continue;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (!nearby(text, start, end, CUE.plate, 40)) continue;
    out.push(...finding(text, 'license_plate', start, end, 0.85));
  }
  return out;
}

// API keys and access tokens

const KEY_PREFIX_PATTERNS: Array<[RegExp, PiiCategory, number]> = [
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, 'api_key', 0.97],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, 'api_key', 0.97],
  [/\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, 'api_key', 0.97],
  [/\b(?:sk|rk|pk)_(?:live|test)_[0-9A-Za-z]{16,}\b/g, 'api_key', 0.97],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, 'api_key', 0.97],
  [/\bxox[abprs]-[0-9A-Za-z-]{10,}\b/g, 'api_key', 0.97],
  [/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, 'api_key', 0.95],
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g, 'api_key', 0.99],
  [/\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, 'auth_token', 0.97],
];

const KEY_ASSIGNMENT_RE = /(?<=(?:api[_-]?key|apikey|api[_-]?secret|secret[_-]?key|client[_-]?secret|access[_-]?key|private[_-]?key)\s*[:=]\s*["']?)[A-Za-z0-9_\-/+=.]{16,}/gi;
const TOKEN_ASSIGNMENT_RE = /(?<=(?:[A-Za-z]*[_-]?token|bearer|authorization)\s*[:=]?\s*(?:bearer\s+)?["']?)[A-Za-z0-9._~+/=-]{16,}/gi;
const PLACEHOLDER_RE = /your|example|placeholder|changeme|dummy|sample|xxxx|<|\$\{/i;

function detectSecrets(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const [re, category, confidence] of KEY_PREFIX_PATTERNS) {
    for (const m of allMatches(re, text)) {
      const start = m.index ?? 0;
      out.push(...finding(text, category, start, start + m[0].length, confidence));
    }
  }
  for (const m of allMatches(KEY_ASSIGNMENT_RE, text)) {
    if (!isStrongSecret(m[0]) || PLACEHOLDER_RE.test(m[0])) continue;
    const start = m.index ?? 0;
    out.push(...finding(text, 'api_key', start, start + m[0].length, 0.85));
  }
  for (const m of allMatches(TOKEN_ASSIGNMENT_RE, text)) {
    if (!isStrongSecret(m[0]) || PLACEHOLDER_RE.test(m[0])) continue;
    const start = m.index ?? 0;
    out.push(...finding(text, 'auth_token', start, start + m[0].length, 0.9));
  }
  return out;
}

// IP addresses

const IPV4_RE = /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\d]|\.\d)/g;
const IPV6_RE = /(?<![A-Fa-f0-9:])(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}(?![A-Fa-f0-9:])/g;
const VERSION_PREFIX_RE = /\b(?:v|ver|version|release)\.?\s*$/i;
const UNSPECIFIED_IPS = new Set(['0.0.0.0', '255.255.255.255']);

function detectIps(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(IPV4_RE, text)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (UNSPECIFIED_IPS.has(m[0])) continue;
    if (VERSION_PREFIX_RE.test(text.slice(Math.max(0, start - 12), start))) continue;
    const confidence = nearby(text, start, end, CUE.ip, 40) ? 0.95 : 0.85;
    out.push(...finding(text, 'ip_address', start, end, confidence));
  }
  for (const m of allMatches(IPV6_RE, text)) {
    const start = m.index ?? 0;
    out.push(...finding(text, 'ip_address', start, start + m[0].length, 0.9));
  }
  return out;
}

// GPS coordinates (range-checked)

const GPS_LABELED_RE = /\blat(?:itude)?\s*[:=]?\s*(-?\d{1,3}\.\d{3,})\s*[,;]?\s*(?:lng|lon|long|longitude)\s*[:=]?\s*(-?\d{1,3}\.\d{3,})/gi;
const GPS_PAIR_RE = /(?<![\d.-])(-?\d{1,3}\.\d{4,})\s*[,;]\s*(-?\d{1,3}\.\d{4,})(?![\d.])/g;

function inGpsRange(lat: number, lng: number): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function detectGps(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(GPS_LABELED_RE, text)) {
    if (!inGpsRange(Number(m[1]), Number(m[2]))) continue;
    const start = m.index ?? 0;
    out.push(...finding(text, 'gps_coordinates', start, start + m[0].length, 0.95));
  }
  for (const m of allMatches(GPS_PAIR_RE, text)) {
    if (!inGpsRange(Number(m[1]), Number(m[2]))) continue;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const confidence = nearby(text, start, end, CUE.gps, 40) ? 0.85 : 0.6;
    out.push(...finding(text, 'gps_coordinates', start, end, confidence));
  }
  return out;
}

// Physical addresses (street pattern, requires address context or a postal code)

const STREET_RE = /\b\d{1,5}[A-Za-z]?\s+(?:[A-Z][A-Za-z.'-]+\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Place|Pl|Court|Ct|Terrace|Circle|Marg|Galli|Gali|Chowk|Nagar|Colony|Sector)\b\.?(?:,?\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)?/g;

function detectAddresses(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(STREET_RE, text)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    let confidence = 0;
    if (nearby(text, start, end, CUE.address, 100)) confidence = 0.85;
    else if (POSTAL_RE.test(text.slice(end, end + 15))) confidence = 0.75;
    out.push(...finding(text, 'full_address', start, end, confidence));
  }
  return out;
}

// Personal names (only after explicit name cues; common non-name words are trimmed)

const NAME_RE = /(?<=\b(?:My name is|my name is|[Nn]ame is|[Nn]ame\s*:|Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Shri|Smt\.?|Sincerely,|Regards,|Signed:|Signed by:|Patient:|Customer:|Applicant:|Employee:)\s+)[A-Z][A-Za-z'-]{1,30}(?:\s+[A-Z][A-Za-z'-]{1,30}){0,3}/g;
const NAME_STOPWORDS = new Set([
  'account', 'type', 'number', 'street', 'road', 'customer', 'service', 'support', 'team', 'manager',
  'department', 'name', 'test', 'example', 'the', 'this', 'please', 'thanks', 'dear', 'hello', 'hi', 'sir',
  'madam', 'office', 'phone', 'email', 'address', 'id', 'code', 'status', 'date', 'time', 'and', 'or',
  'sincerely', 'regards',
]);

function detectNames(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(NAME_RE, text)) {
    const tokens = Array.from(m[0].matchAll(/\S+/g));
    while (tokens.length > 0 && NAME_STOPWORDS.has(tokens[0][0].toLowerCase())) tokens.shift();
    while (tokens.length > 0 && NAME_STOPWORDS.has(tokens[tokens.length - 1][0].toLowerCase())) tokens.pop();
    if (tokens.length === 0) continue;
    const base = m.index ?? 0;
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const start = base + (first.index ?? 0);
    const end = base + (last.index ?? 0) + last[0].length;
    out.push(...finding(text, 'person_name', start, end, 0.8));
  }
  return out;
}

const USERNAME_RE = /(?<![\w@.])@[A-Za-z0-9_]{3,30}(?![\w@])/g;
const USERNAME_STOPWORDS = new Set(['@channel', '@everyone', '@here']);

function detectUsernames(text: string): RawFinding[] {
  const out: RawFinding[] = [];
  for (const m of allMatches(USERNAME_RE, text)) {
    if (USERNAME_STOPWORDS.has(m[0].toLowerCase())) continue;
    const start = m.index ?? 0;
    out.push(...finding(text, 'username', start, start + m[0].length, 0.6));
  }
  return out;
}

const DETECTORS: Detector[] = [
  detectEmails,
  detectPhones,
  detectAadhaar,
  detectPan,
  detectCards,
  detectBankAccounts,
  detectSsn,
  detectPassports,
  detectDates,
  detectPlates,
  detectSecrets,
  detectIps,
  detectGps,
  detectAddresses,
  detectNames,
  detectUsernames,
];

// Highest confidence wins; ties go to the longer span. Any candidate overlapping a kept finding is dropped.
export function detectPii(text: string): RawFinding[] {
  const candidates = DETECTORS.flatMap((detect) => detect(text));
  candidates.sort((a, b) => b.confidence - a.confidence || (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const kept: RawFinding[] = [];
  for (const c of candidates) {
    if (kept.some((k) => c.start < k.end && k.start < c.end)) continue;
    kept.push(c);
  }
  return kept.sort((a, b) => a.start - b.start);
}
