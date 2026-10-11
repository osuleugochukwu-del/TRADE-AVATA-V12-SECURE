const reId=/[A-Za-z_][A-Za-z0-9_.]*/y;
const reNum=/(?:\d+\.\d+|\d+\.|\.\d+|\d+)/y;

export function tokenize(input){
  const out=[]; let i=0;
  while(i<input.length){
    const c=input[i];
    if(/\s/.test(c)){i++;continue;}
    if(c==='#'){while(i<input.length&&input[i]!=='\n')i++;continue;}
    if(c==='"'||c==="'"){
      const q=c; i++; let s='';
      while(i<input.length&&input[i]!==q){
        if(input[i]==='\\'&&i+1<input.length){
          const n=input[++i]; s+=n==='n'?'\n':n==='t'?'\t':n;
          i++; continue;
        }
        s+=input[i++];
      }
      if(input[i]!==q)throw new SyntaxError('Unterminated string');
      i++; out.push({type:'string',value:s}); continue;
    }
    reNum.lastIndex=i; const nm=reNum.exec(input);
    if(nm){out.push({type:'number',value:Number(nm[0])}); i=reNum.lastIndex; continue;}
    reId.lastIndex=i; const id=reId.exec(input);
    if(id){out.push({type:'id',value:id[0]}); i=reId.lastIndex; continue;}
    const two=input.slice(i,i+2);
    if(['>=','<=','==','!=','&&','||'].includes(two)){out.push({type:'op',value:two});i+=2;continue;}
    if('+-*/%><=!(),[]'.includes(c)){out.push({type:'op',value:c});i++;continue;}
    throw new SyntaxError(`Unexpected character ${JSON.stringify(c)} at ${i}`);
  }
  return out;
}
