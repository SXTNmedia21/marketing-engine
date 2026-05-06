import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// hoisted mocks must be declared with vi.hoisted so they are available at module load time
const mockEmailsSend = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockEmailsSend },
  })),
}));

import { EmailClient } from '../src/client.js';
import { DbSuppressionChecker } from '../src/suppression.js';
import { verifyResendWebhook } from '../src/webhook.js';
import { renderEmail } from '../src/render.js';
import { LeadConfirmationEmail } from '../src/templates/lead-confirmation.js';
import { NurtureEmail } from '../src/templates/nurture.js';
import type { SendOptions } from '../src/types.js';
import type { SuppressionStore } from '../src/suppression.js';
import React from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSendOptions(overrides: Partial<SendOptions> = {}): SendOptions {
  return {
    to: 'recipient@example.com',
    from: 'sender@example.com',
    subject: 'Test subject',
    html: '<p>Hello</p>',
    text: 'Hello',
    stream: 'marketing',
    idempotency_key: 'key_001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// EmailClient.send
// ---------------------------------------------------------------------------
describe('EmailClient.send', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns suppressed result when suppression checker says yes', async () => {
    const suppression = {
      isSuppressed: vi.fn().mockResolvedValue({ suppressed: true, reason: 'hard_bounce' }),
    };
    const client = new EmailClient(
      { api_key: 'test', default_from: 'noreply@example.com' },
      suppression,
    );

    const result = await client.send(makeSendOptions());
    expect(result.ok).toBe(false);
    expect(result.suppressed_reason).toBe('hard_bounce');
    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  it('sends successfully and returns message_id on success', async () => {
    const suppression = {
      isSuppressed: vi.fn().mockResolvedValue({ suppressed: false }),
    };
    mockEmailsSend.mockResolvedValue({ data: { id: 'msg_xyz' }, error: null });

    const client = new EmailClient(
      { api_key: 'test', default_from: 'noreply@example.com' },
      suppression,
    );
    const result = await client.send(makeSendOptions());
    expect(result.ok).toBe(true);
    expect(result.message_id).toBe('msg_xyz');
  });

  it('returns error when resend returns an error object', async () => {
    const suppression = {
      isSuppressed: vi.fn().mockResolvedValue({ suppressed: false }),
    };
    mockEmailsSend.mockResolvedValue({
      data: null,
      error: { message: 'rate_limit_exceeded' },
    });

    const client = new EmailClient(
      { api_key: 'test', default_from: 'noreply@example.com' },
      suppression,
    );
    const result = await client.send(makeSendOptions());
    expect(result.ok).toBe(false);
    expect(result.error).toBe('rate_limit_exceeded');
  });

  it('returns error when resend throws an exception', async () => {
    const suppression = {
      isSuppressed: vi.fn().mockResolvedValue({ suppressed: false }),
    };
    mockEmailsSend.mockRejectedValue(new Error('network failure'));

    const client = new EmailClient(
      { api_key: 'test', default_from: 'noreply@example.com' },
      suppression,
    );
    const result = await client.send(makeSendOptions());
    expect(result.ok).toBe(false);
    expect(result.error).toContain('network failure');
  });
});

// ---------------------------------------------------------------------------
// verifyResendWebhook
// ---------------------------------------------------------------------------
describe('verifyResendWebhook', () => {
  it('returns error when svix headers are missing', () => {
    const result = verifyResendWebhook('{}', {}, 'secret');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('missing_svix_headers');
  });

  it('returns error for bad signature', () => {
    const result = verifyResendWebhook(
      '{}',
      {
        'svix-id': 'msg_fake',
        'svix-timestamp': '1700000000',
        'svix-signature': 'v1,invalidsig',
      },
      'whsec_testsecret',
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('signature_invalid');
  });

  it('checks for header aliases (Svix-Id etc)', () => {
    // Missing even the aliased headers — should return missing_svix_headers
    const result = verifyResendWebhook('{}', { 'X-Other': 'value' }, 'secret');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('missing_svix_headers');
  });
});

// ---------------------------------------------------------------------------
// DbSuppressionChecker
// ---------------------------------------------------------------------------
describe('DbSuppressionChecker', () => {
  it('returns suppressed: true when store has a match', async () => {
    const store: SuppressionStore = {
      has: vi.fn().mockResolvedValue({ email_hash: 'hash1', reason: 'spam_complaint', ts: new Date() }),
      add: vi.fn(),
    };
    const checker = new DbSuppressionChecker(store, async () => 'hash1');
    const result = await checker.isSuppressed('user@example.com');
    expect(result.suppressed).toBe(true);
    expect(result.reason).toBe('spam_complaint');
  });

  it('returns suppressed: false when store has no match', async () => {
    const store: SuppressionStore = {
      has: vi.fn().mockResolvedValue(null),
      add: vi.fn(),
    };
    const checker = new DbSuppressionChecker(store, async () => 'hash1');
    const result = await checker.isSuppressed('clean@example.com');
    expect(result.suppressed).toBe(false);
  });

  it('passes hashed email to store.has', async () => {
    const hasMock = vi.fn().mockResolvedValue(null);
    const store: SuppressionStore = { has: hasMock, add: vi.fn() };
    const hashFn = async (email: string) => `hash_of_${email}`;
    const checker = new DbSuppressionChecker(store, hashFn);
    await checker.isSuppressed('test@example.com');
    expect(hasMock).toHaveBeenCalledWith('hash_of_test@example.com');
  });
});

// ---------------------------------------------------------------------------
// Email render
// ---------------------------------------------------------------------------
describe('renderEmail', () => {
  it('renders LeadConfirmationEmail to html and text without throwing', async () => {
    const element = React.createElement(LeadConfirmationEmail, {
      recipient_first_name: 'Ola',
      campaign_name: 'Test Campaign',
      cta_url: 'https://example.com/cta',
      cta_label: 'Get started',
      preview_text: 'Preview text here',
      body_paragraphs: ['First paragraph', 'Second paragraph'],
      unsubscribe_url: 'https://example.com/unsubscribe',
    });
    const result = await renderEmail(element);
    expect(typeof result.html).toBe('string');
    expect(typeof result.text).toBe('string');
    expect(result.html.length).toBeGreaterThan(0);
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.html).toContain('Ola');
    expect(result.html).toContain('Test Campaign');
  });

  it('renders NurtureEmail to html and text without throwing', async () => {
    const element = React.createElement(NurtureEmail, {
      recipient_first_name: 'Kari',
      campaign_name: 'Nurture Campaign',
      preview_text: 'Open this',
      hook_paragraph: 'Hook text here',
      value_paragraphs: ['Value 1', 'Value 2'],
      cta_url: 'https://example.com/cta',
      cta_label: 'Click here',
      unsubscribe_url: 'https://example.com/unsub',
    });
    const result = await renderEmail(element);
    expect(result.html).toContain('Kari');
    expect(result.html.length).toBeGreaterThan(100);
  });

  it('NurtureEmail renders social proof when provided', async () => {
    const element = React.createElement(NurtureEmail, {
      recipient_first_name: 'Jon',
      campaign_name: 'Test',
      preview_text: 'Open',
      hook_paragraph: 'Hook',
      value_paragraphs: ['v1'],
      cta_url: 'https://example.com',
      cta_label: 'Go',
      unsubscribe_url: 'https://example.com/unsub',
      social_proof: { quote: 'Great product!', author: 'Restaurant Owner' },
    });
    const result = await renderEmail(element);
    expect(result.html).toContain('Great product!');
    expect(result.html).toContain('Restaurant Owner');
  });
});
