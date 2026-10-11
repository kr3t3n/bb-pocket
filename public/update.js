document.querySelector('#update-pocket').addEventListener('click',async()=>{
 const button=document.querySelector('#update-pocket'),status=document.querySelector('#update-status');button.disabled=true;status.textContent='Updating Pocket…';
 try{
  if('serviceWorker'in navigator){for(const registration of await navigator.serviceWorker.getRegistrations()){if(new URL(registration.scope).origin===location.origin)await registration.unregister()}}
  for(const name of await caches.keys())if(name.startsWith('pocket-shell-'))await caches.delete(name);
  location.replace('/?updated='+Date.now());
 }catch{status.textContent='Could not update. Check your connection and try again.';button.disabled=false}
});
