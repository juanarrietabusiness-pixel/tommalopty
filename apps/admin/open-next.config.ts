import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Adaptador de Next.js para Cloudflare Workers.
// La caché incremental (ISR) se puede respaldar en KV o R2 cuando el proyecto
// tenga esos recursos creados; por defecto usa la caché en memoria del worker.
export default defineCloudflareConfig();
