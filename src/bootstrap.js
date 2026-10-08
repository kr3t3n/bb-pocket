const allowed=['opus','sol','astra','grok'];
const selected=allowed.includes(document.documentElement.dataset.theme)?document.documentElement.dataset.theme:'opus';
import('/themes/'+selected+'/app.js').catch(()=>{
 const app=document.querySelector('#app');app.textContent='Pocket could not load this theme. ';
 const retry=document.createElement('button');retry.className='primary';retry.textContent='Retry';retry.onclick=()=>location.reload();app.append(retry);
 const reset=document.createElement('button');reset.className='secondary';reset.textContent='Use Opus';reset.onclick=()=>{try{localStorage.removeItem('pocket:theme')}catch{}location.reload()};app.append(reset);
});
