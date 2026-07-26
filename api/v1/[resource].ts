import gateway from '../../services/council-gateway/src/index';

export const config = { runtime: 'edge' };

export default function handler(request: Request) {
  return gateway.fetch(request);
}
