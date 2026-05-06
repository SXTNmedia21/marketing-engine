import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from './config.js';

export async function requireBearer(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const auth = req.headers.authorization ?? '';
  const expected = `Bearer ${config.control_plane_token}`;
  // Use timingSafeEqual on equal-length Buffers to prevent remote timing oracle
  // attacks on CONTROL_PLANE_TOKEN.  Buffers must be the same length; if lengths
  // differ the request is already invalid so we return early without leaking timing.
  const authBuf = Buffer.from(auth);
  const expectedBuf = Buffer.from(expected);
  const valid =
    authBuf.length === expectedBuf.length &&
    timingSafeEqual(authBuf, expectedBuf);
  if (!valid) {
    reply.code(401).send({ error: 'unauthorized' });
  }
}
