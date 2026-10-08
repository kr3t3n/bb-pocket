import {save} from './storage.js';
export const themes=[
 {id:'opus',name:'Opus 5.5',description:'Default · compact lists and grouped sheets',colors:['#0e1211','#1c2b22','#bcebc4']},
 {id:'sol',name:'Sol 6.1',description:'Navy cards and quick status filters',colors:['#101b20','#20353d','#bcebc4']},
 {id:'astra',name:'6-Astra',description:'Calm green cards and a bottom New action',colors:['#121c17','#253626','#bcebc4']},
 {id:'grok',name:'Grok 4.7',description:'High contrast and colored status edges',colors:['#0b0e0d','#1b2720','#bcebc4']},
];
export function openThemeMenu(menuShell,toast){
 const current=document.documentElement.dataset.theme||'opus';
 menuShell('Themes',`<div class="pocket-theme-picker"><p class="pocket-theme-intro">Choose the layout and appearance you prefer. Your drafts and settings stay with you.</p><div role="group" aria-label="Pocket themes">${themes.map(t=>`<button type="button" class="pocket-theme-choice" data-pocket-theme="${t.id}" aria-pressed="${current===t.id}"><span class="pocket-theme-swatch" aria-hidden="true">${t.colors.map(c=>`<i style="background:${c}"></i>`).join('')}</span><span class="pocket-theme-label"><strong>${t.name}</strong><small>${t.description}</small></span><span class="pocket-theme-check" aria-hidden="true">${current===t.id?'✓':''}</span></button>`).join('')}</div><p class="pocket-theme-intro">Saved on this device. Switching briefly reloads Pocket.</p></div>`);
 document.querySelectorAll('[data-pocket-theme]').forEach(button=>button.addEventListener('click',()=>{
  const id=button.dataset.pocketTheme;if(id===current)return;
  if(!themes.some(t=>t.id===id))return;
  if(!save('theme',id)){toast('Could not save your theme. Check device storage.');return}
  location.reload();
 }));
}
