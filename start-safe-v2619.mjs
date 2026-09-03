import {boot} from './start-safe.mjs';
try{await boot()}catch(e){console.error(e?.stack||e);process.exit(1)}
