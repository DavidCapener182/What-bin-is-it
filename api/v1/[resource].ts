import gateway from '../_gateway/index.ts';

export const config = { runtime: 'nodejs' };

export default function handler(request: Request) {
  return gateway.fetch(request);
}
