This directory contains the Apache-2.0 licensed language core from ComicBit/bb-plugin-genui,
commit e75404de9cf5cece924c529a2b93cefaa86b3928 (version 0.1.0).
https://github.com/ComicBit/bb-plugin-genui

core.mjs is an unminified esbuild ESM bundle exporting compile, evaluate,
initialState, collectLoads, dataKey and toMarkdown from core/index.ts.
It retains the upstream bounded interpreter, without eval or host globals.
Pocket loads referenced data through the installed genui plugin's load_data RPC,
which enforces thread-scoped file access. Pocket only exposes plain reply actions;
stateful forms and other desktop actions remain available in full BB.
