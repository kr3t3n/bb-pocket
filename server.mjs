import {createPocketServer} from './bridge.mjs';
const pocket=await createPocketServer({port:Number(process.env.PORT||8890),upstream:process.env.BB_UPSTREAM,bbUrl:process.env.POCKET_BB_URL,publicHost:process.env.POCKET_HOST,dataDir:process.env.POCKET_DATA_DIR});
console.log(`BB Pocket listening on ${pocket.port}`);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>pocket.close().then(()=>process.exit(0),e=>{console.error(e);process.exit(1)}));
