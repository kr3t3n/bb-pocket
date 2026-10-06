let dbPromise;
function db(){return dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open('bb-pocket',1);r.onupgradeneeded=()=>r.result.createObjectStore('cache');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function get(key){try{const d=await db();return await new Promise((resolve,reject)=>{const r=d.transaction('cache').objectStore('cache').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}catch{return null}}
export async function put(key,value){try{const d=await db();await new Promise((resolve,reject)=>{const tx=d.transaction('cache','readwrite');tx.objectStore('cache').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch{}}
export function read(key,fallback){try{return JSON.parse(localStorage.getItem('pocket:'+key))??fallback}catch{return fallback}}
export function save(key,value){try{localStorage.setItem('pocket:'+key,JSON.stringify(value));return true}catch{return false}}
