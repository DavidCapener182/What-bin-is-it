import { defineHandler } from 'nitro';

import gateway from '../../../../api/_gateway/index.ts';

export default defineHandler((event) => gateway.fetch(event.req));
