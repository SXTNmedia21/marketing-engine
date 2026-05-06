import { z } from 'zod';

export const VoiceSessionPurposeSchema = z.enum([
  'qualify_hot_lead',
  'voicemail_drop',
  'voice_lp_inbound',
  'follow_up',
]);

export type VoiceSessionPurpose = z.infer<typeof VoiceSessionPurposeSchema>;

export const VoiceSessionOutcomeSchema = z.enum([
  'connected',
  'no_answer',
  'voicemail_left',
  'declined',
  'meeting_booked',
  'qualified',
  'disqualified',
  'escalated_to_human',
  'failed',
]);

export type VoiceSessionOutcome = z.infer<typeof VoiceSessionOutcomeSchema>;

export interface DispatchInput {
  visitor_id: string;
  contact_id?: string;
  campaign_id?: string;
  phone_number: string;
  purpose: VoiceSessionPurpose;
  context_summary: string;
  consent_recorded: boolean;
}

export interface DispatchResult {
  ok: boolean;
  session_id?: string;
  room_name?: string;
  error?: string;
}

export const LiveKitSessionEventSchema = z.object({
  session_id: z.string(),
  room_name: z.string(),
  agent: z.literal('marketing_bdr'),
  event:
    z.enum([
      'room.created',
      'participant.joined',
      'participant.left',
      'transcript.partial',
      'transcript.final',
      'tool.called',
      'session.ended',
    ]),
  ts: z.string(),
  payload: z.record(z.unknown()).default({}),
});

export type LiveKitSessionEvent = z.infer<typeof LiveKitSessionEventSchema>;
