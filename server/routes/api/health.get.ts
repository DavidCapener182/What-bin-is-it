import { defineHandler } from 'nitro';

export default defineHandler(() => ({
  ok: true,
  service: 'what-bin-is-it-tonight',
  pwa: true,
  push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
}));
