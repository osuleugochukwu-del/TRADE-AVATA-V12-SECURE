import {tokenize} from './lexer.js';

const PREC={or:1,'||':1,and:2,'&&':2,'==':3,'!=':3,'>':4,'<':4,'>=':4,'<=':4,'+':5,'-':5,'*':6,'/':6,'%':6};

class ExprParser{
  constructor(text){this.t=tokenize(text);this.i=0;}
  peek(){return this.t[this.i];}
  take(){return this.t[this.i++];}
  match(v){if(this.peek()?.value===v){this.i++;return true;}return false;}
  parse(){const x=this.binary(0);if(this.peek())throw new SyntaxError(`Unexpected token ${this.peek().value}`);return x;}
  binary(min){
    let left=this.unary();
    while(true){const op=this.peek()?.value; const p=PREC[op]; if(p==null||p<min)break; this.take(); const right=this.binary(p+1); left={type:'binary',op,left,right};}
    return left;
  }
  unary(){const t=this.peek(); if(t&&['-','+','!','not'].includes(t.value)){this.take();return{type:'unary',op:t.value,arg:this.unary()};}return this.postfix();}
  postfix(){
    let node=this.primary();
    while(this.match('[')){
      const offset=this.binary(0);
      if(!this.match(']'))throw new SyntaxError('Expected ]');
      node={type:'history',target:node,offset};
    }
    return node;
  }
  primary(){
    const t=this.take(); if(!t)throw new SyntaxError('Expected expression');
    if(t.type==='number'||t.type==='string')return{type:t.type,value:t.value};
    if(t.type==='id'){
      if(['true','false'].includes(t.value))return{type:'boolean',value:t.value==='true'};
      if(this.match('(')){
        const args=[]; if(!this.match(')')){do{args.push(this.binary(0));}while(this.match(',')); if(!this.match(')'))throw new SyntaxError('Expected )');}
        return{type:'call',name:t.value,args};
      }
      return{type:'identifier',name:t.value};
    }
    if(t.value==='('){const e=this.binary(0);if(!this.match(')'))throw new SyntaxError('Expected )');return e;}
    throw new SyntaxError(`Unexpected token ${t.value}`);
  }
}

export const parseExpr=text=>{
  const ast=new ExprParser(text).parse();
  const banned=new Set(['eval','Function','fetch','WebSocket','document','window','localStorage','sessionStorage','child_process','process.env']);
  const walk=n=>{if(!n||typeof n!=='object')return; if(n.type==='call'&&banned.has(n.name))throw new SyntaxError(`Forbidden function ${n.name}`); for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}};
  walk(ast); return ast;
};

function quotedPrefix(text){
  const m=text.match(/^\s*(["'])(.*?)\1\s*(.*)$/); if(!m)throw new SyntaxError('Expected quoted name'); return{name:m[2],rest:m[3]};
}

export function parse(source){
  const lines=String(source).split(/\r?\n/);
  const program={
    version:'1.0',revision:'R4',name:'Untitled TA Script',kind:'script',overlay:false,calculate:'all-bars',
    accessPolicy:'public',entitlement:null,defaultAttach:'none',grantVia:'ta_id',
    inputs:[],lets:[],functions:[],states:[],sets:[],plots:[],markers:[],signals:[],alerts:[],armed:[],entries:[],exits:[],orders:[],actions:[]
  };
  for(let n=0;n<lines.length;n++){
    let line=lines[n].trim(); if(!line||line.startsWith('#'))continue;
    try{
      if(/^ta_script\s+/i.test(line)){const v=line.split(/\s+/)[1]; if(v!=='1.0')throw new SyntaxError(`Unsupported TA Script version ${v}`); program.version=v; continue;}
      if(/^revision\s+/i.test(line)){program.revision=line.split(/\s+/)[1];continue;}
      if(/^(script|indicator|strategy)\s+/i.test(line)){const kind=line.match(/^(script|indicator|strategy)/i)[1].toLowerCase();program.kind=kind;program.name=quotedPrefix(line.replace(/^(script|indicator|strategy)\s+/i,'')).name;continue;}
      if(/^overlay\s+/i.test(line)){const v=line.split(/\s+/)[1]?.toLowerCase();program.overlay=v==='true'||v==='yes'||v==='on';continue;}
      if(/^calculate\s+on\s+bar_close$/i.test(line)){program.calculate='bar-close';continue;}
      let access=line.match(/^access\s+(public|owner_only|owner_or_grant)$/i);
      if(access){program.accessPolicy=access[1].toLowerCase();continue;}
      let entitlement=line.match(/^entitlement\s+([\"'])(.*?)\1\s*$/i);
      if(entitlement){program.entitlement=entitlement[2].trim();if(!program.entitlement)throw new SyntaxError('entitlement cannot be empty');continue;}
      let attach=line.match(/^default_attach\s+(none|owner|authorized)$/i);
      if(attach){program.defaultAttach=attach[1].toLowerCase();continue;}
      let grant=line.match(/^grant_via\s+(ta_id)$/i);
      if(grant){program.grantVia=grant[1].toLowerCase();continue;}

      let m=line.match(/^input\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if(m){program.inputs.push({name:m[1],expr:parseExpr(m[2])});continue;}
      m=line.match(/^let\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if(m){program.lets.push({name:m[1],expr:parseExpr(m[2])});continue;}
      m=line.match(/^function\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*=\s*(.+)$/i);
      if(m){const params=m[2].trim()?m[2].split(',').map(x=>x.trim()).filter(Boolean):[];if(params.some(x=>!/^[A-Za-z_]\w*$/.test(x)))throw new SyntaxError('Invalid function parameter');program.functions.push({name:m[1],params,expr:parseExpr(m[3])});continue;}
      m=line.match(/^state\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i);
      if(m){const x={name:m[1],expr:parseExpr(m[2])};program.states.push(x);continue;}
      m=line.match(/^set\s+([A-Za-z_]\w*)\s*=\s*(.+?)\s+when\s+(.+)$/i);
      if(m){const x={type:'set',name:m[1],expr:parseExpr(m[2]),when:parseExpr(m[3])};program.sets.push(x);program.actions.push(x);continue;}

      if(/^plot\s+/i.test(line)){
        const rest=line.replace(/^plot\s+/i,''); const am=rest.match(/^(.*)\s+as\s+(["'])(.*?)\2\s*$/i); if(!am)throw new SyntaxError('plot syntax: plot <expr> as "Name"'); program.plots.push({expr:parseExpr(am[1]),name:am[3]});continue;
      }
      if(/^marker\s+/i.test(line)){
        const q=quotedPrefix(line.replace(/^marker\s+/i,''));
        const mm=q.rest.match(/^at\s+(.+?)(?:\s+anchor\s+(.+?))?\s+when\s+(.+)$/i);
        if(!mm)throw new SyntaxError('marker syntax: marker "Text" at <price> [anchor <bar_index>] when <expr>');
        const x={type:'marker',text:q.name,price:parseExpr(mm[1]),anchor:mm[2]?parseExpr(mm[2]):null,when:parseExpr(mm[3])};
        program.markers.push(x);program.actions.push(x);continue;
      }
      if(/^signal\s+/i.test(line)){const q=quotedPrefix(line.replace(/^signal\s+/i,'')); const wm=q.rest.match(/^when\s+(.+)$/i); if(!wm)throw new SyntaxError('signal requires when'); const x={type:'signal',name:q.name,when:parseExpr(wm[1])};program.signals.push(x);program.actions.push(x);continue;}
      if(/^alert\s+/i.test(line)){const q=quotedPrefix(line.replace(/^alert\s+/i,'')); const wm=q.rest.match(/^when\s+(.+)$/i); if(!wm)throw new SyntaxError('alert requires when'); const x={type:'alert',message:q.name,when:parseExpr(wm[1])};program.alerts.push(x);program.actions.push(x);continue;}
      if(/^armed\s+/i.test(line)){const q=quotedPrefix(line.replace(/^armed\s+/i,'')); const wm=q.rest.match(/^when\s+(.+)$/i); if(!wm)throw new SyntaxError('armed requires when'); const x={type:'armed',name:q.name,when:parseExpr(wm[1])};program.armed.push(x);program.actions.push(x);continue;}
      if(/^entry\s+/i.test(line)){
        const r=line.replace(/^entry\s+/i,''); const mm=r.match(/^(long|short)\s+(["'])(.*?)\2\s+when\s+(.+)$/i); if(!mm)throw new SyntaxError('entry syntax: entry long|short "Tag" when <expr>'); const x={type:'entry',side:mm[1].toLowerCase(),tag:mm[3],when:parseExpr(mm[4])};program.entries.push(x);program.actions.push(x);continue;
      }
      if(/^exit\s+/i.test(line)){const q=quotedPrefix(line.replace(/^exit\s+/i,'')); const wm=q.rest.match(/^when\s+(.+)$/i); if(!wm)throw new SyntaxError('exit requires when'); const x={type:'exit',tag:q.name,when:parseExpr(wm[1])};program.exits.push(x);program.actions.push(x);continue;}
      if(/^order\s+/i.test(line)){
        const r=line.replace(/^order\s+/i,'');
        const mm=r.match(/^(buy|sell)\s+qty\s+(.+?)\s+when\s+(.+)$/i); if(mm){const x={type:'order',action:mm[1].toLowerCase(),qty:parseExpr(mm[2]),when:parseExpr(mm[3])};program.orders.push(x);program.actions.push(x);continue;}
        const cm=r.match(/^close\s+(["'])(.*?)\1\s+when\s+(.+)$/i); if(cm){const x={type:'order',action:'close',tag:cm[2],when:parseExpr(cm[3])};program.orders.push(x);program.actions.push(x);continue;}
        throw new SyntaxError('order syntax: order buy|sell qty <expr> when <expr> OR order close "Tag" when <expr>');
      }
      throw new SyntaxError(`Unknown statement: ${line}`);
    }catch(err){err.message=`Line ${n+1}: ${err.message}`;throw err;}
  }
  return program;
}
