import {compile,evaluate,initialState,collectLoads,dataKey,toMarkdown} from '../vendor/genui/core.mjs';

export function uiFences(text=''){
 const lines=text.split('\n'),out=[];
 for(let i=0;i<lines.length;i++){
  const m=/^ {0,3}(`{3,}|~{3,})\s*([\w-]*)\s*$/.exec(lines[i]);if(!m)continue;
  let end=i+1;const close=new RegExp('^ {0,3}'+m[1][0]+'{'+m[1].length+',}\\s*$');
  while(end<lines.length&&!close.test(lines[end]))end++;
  if(m[2].toLowerCase()==='ui'&&end<lines.length)out.push({start:i,end,source:lines.slice(i+1,end).join('\n')});
  i=end;
 }
 return out;
}
export async function renderGenui(text,load){
 const lines=text.split('\n'),fences=uiFences(text),output=[],replies=[];let next=0;
 for(const fence of fences){
  output.push(...lines.slice(next,fence.start));next=fence.end+1;
  const {program}=compile(fence.source);
  if(!program){output.push(...lines.slice(fence.start,fence.end+1));continue}
  const data=new Map();
  for(const request of collectLoads(program))data.set(dataKey(request),await load(request));
  const {roots}=evaluate(program,initialState(program,data),data);
  output.push(toMarkdown(roots));
  function visit(node){
   if(!node||typeof node!=='object')return;
   if(Array.isArray(node)){node.forEach(visit);return}
   if(node.kind==='node'&&node.type==='Button'){
    const p=node.props,actions=p.action||[];
    if(!actions.length||actions.length===1&&actions[0].type==='send'){
     const text=actions.length?actions[0].text:p.label;
     if(typeof text==='string'&&text.trim()&&typeof p.label==='string')replies.push({label:p.label,text});
    }
   }
   // Forms/stateful controls must not be mistaken for standalone replies.
   if(node.kind==='node'&&node.type!=='Form')Object.values(node.props||{}).forEach(visit);
  }
  roots.forEach(visit);
 }
 output.push(...lines.slice(next));return {text:output.join('\n'),replies:replies.slice(0,50)};
}
export function latestConversation(rows){return [...rows].reverse().find(r=>r.kind==='conversation'&&['user','assistant'].includes(r.role))}
