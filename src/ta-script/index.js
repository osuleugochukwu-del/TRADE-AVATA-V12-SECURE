export {parse,parseExpr} from './parser.js';
export {execute,checkAccess} from './runtime.js';

import {parse} from './parser.js';
import {execute} from './runtime.js';

export function describeProgram(program){
  return {
    version:program.version,
    revision:program.revision,
    name:program.name,
    kind:program.kind,
    overlay:program.overlay,
    calculate:program.calculate||'all-bars',
    accessPolicy:program.accessPolicy||'public',
    entitlement:program.entitlement||null,
    defaultAttach:program.defaultAttach||'none',
    grantVia:program.grantVia||'ta_id',
    inputs:(program.inputs||[]).map(x=>x.name)
  };
}

export function compile(source){
  const program=parse(source);
  const descriptor=describeProgram(program);
  return {
    program,
    descriptor,
    run:(bars,options={})=>execute(program,bars,options),
    runContexts:(contexts,options={})=>{
      const out={};
      for(const [name,spec] of Object.entries(contexts||{})){
        const bars=Array.isArray(spec)?spec:spec.bars;
        const local=Array.isArray(spec)?{}:spec.options||{};
        out[name]=execute(program,bars,{...options,...local,contextName:name});
      }
      return out;
    }
  };
}
