import { useEffect } from 'react';

import { registerPwa } from '@/lib/pwa-install.web';

export function PwaRegistration() {
  useEffect(() => registerPwa(), []);
  return null;
}
