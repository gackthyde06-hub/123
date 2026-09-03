import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
process.chdir(ROOT);
console.log(`[boot:V2.6.31] runtime direct start · node ${process.version} · cwd ${ROOT}`);
await import('./server.js');
