import {esc} from './ui.js';
export function replyButtons(row){
 if(!row.uiReplies?.length)return '';
 return `<div class="pocket-ui-replies" aria-label="Reply options">${row.uiReplies.map(r=>`<button type="button" class="secondary" data-ui-reply="${esc(r.text)}">${esc(r.label)}</button>`).join('')}<small>Choose an answer to add it to your draft.</small></div>`;
}
export function setupUiReplies(){
 document.addEventListener('click',e=>{
  const button=e.target.closest('[data-ui-reply]');if(!button)return;
  const draft=document.querySelector('#draft');if(!draft)return;
  const text=button.dataset.uiReply;draft.value=draft.value.trim()?draft.value+'\n\n'+text:text;
  draft.dispatchEvent(new Event('input',{bubbles:true}));draft.focus({preventScroll:true});
 });
}
