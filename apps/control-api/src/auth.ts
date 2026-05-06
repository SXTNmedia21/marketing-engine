import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from './config.js';

export async function requireBearer(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const auth = req.headers.authorization ?? '';
  const expected = `Bearer ${config.control_plane_token}`;
  if (auth !== expected) {
    reply.code(401).send({ error: 'unauthorized' });
  }
}
