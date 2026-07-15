import { verifyRequest, json } from '../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  const session = await verifyRequest(request);
  return json({ authenticated: !!session, role: session?.role || null });
}
