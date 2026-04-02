/**
 * Tests for lib/fingerprint.ts — computeFingerprint
 * and lib/geo.ts — extractIp
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { computeFingerprint } from '@/lib/fingerprint';
import { extractIp } from '@/lib/geo';

// ── helpers ───────────────────────────────────────────────────────────────────

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex');
}

function makeRequest(headers: Record<string, string>) {
  return { headers: { get: (k: string) => headers[k] ?? null } } as never;
}

function makeHeaders(map: Record<string, string>) {
  return { get: (k: string) => map[k] ?? null } as unknown as Headers;
}

// ── computeFingerprint ────────────────────────────────────────────────────────

describe('computeFingerprint', () => {
  it('uses x-forwarded-for ip and user-agent', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4', 'user-agent': 'TestAgent/1' });
    expect(computeFingerprint(req)).toBe(sha256('1.2.3.4:TestAgent/1'));
  });

  it('takes first IP from x-forwarded-for when comma-separated', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'user-agent': 'UA' });
    expect(computeFingerprint(req)).toBe(sha256('1.2.3.4:UA'));
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-real-ip': '9.9.9.9', 'user-agent': 'UA' });
    expect(computeFingerprint(req)).toBe(sha256('9.9.9.9:UA'));
  });

  it('uses "unknown" when no IP header is present', () => {
    const req = makeRequest({ 'user-agent': 'UA' });
    expect(computeFingerprint(req)).toBe(sha256('unknown:UA'));
  });

  it('uses "unknown" when no user-agent header is present', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });
    expect(computeFingerprint(req)).toBe(sha256('1.2.3.4:unknown'));
  });

  it('returns a 64-character hex string', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4', 'user-agent': 'UA' });
    expect(computeFingerprint(req)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different fingerprints for different IPs', () => {
    const r1 = makeRequest({ 'x-forwarded-for': '1.1.1.1', 'user-agent': 'UA' });
    const r2 = makeRequest({ 'x-forwarded-for': '2.2.2.2', 'user-agent': 'UA' });
    expect(computeFingerprint(r1)).not.toBe(computeFingerprint(r2));
  });

  it('produces different fingerprints for different user-agents', () => {
    const r1 = makeRequest({ 'x-forwarded-for': '1.1.1.1', 'user-agent': 'Chrome' });
    const r2 = makeRequest({ 'x-forwarded-for': '1.1.1.1', 'user-agent': 'Firefox' });
    expect(computeFingerprint(r1)).not.toBe(computeFingerprint(r2));
  });

  it('is deterministic — same inputs produce same output', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4', 'user-agent': 'UA' });
    expect(computeFingerprint(req)).toBe(computeFingerprint(req));
  });
});

// ── extractIp ─────────────────────────────────────────────────────────────────

describe('extractIp', () => {
  it('returns first IP from x-forwarded-for', () => {
    expect(extractIp(makeHeaders({ 'x-forwarded-for': '1.2.3.4' }))).toBe('1.2.3.4');
  });

  it('returns first IP when x-forwarded-for has multiple values', () => {
    expect(extractIp(makeHeaders({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    expect(extractIp(makeHeaders({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
  });

  it('returns "unknown" when no IP headers are present', () => {
    expect(extractIp(makeHeaders({}))).toBe('unknown');
  });

  it('trims whitespace from x-forwarded-for value', () => {
    expect(extractIp(makeHeaders({ 'x-forwarded-for': '  1.2.3.4  ' }))).toBe('1.2.3.4');
  });
});
