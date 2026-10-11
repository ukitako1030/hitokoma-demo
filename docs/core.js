export const MAX_MEMO = 2000;
export const MAX_BACKUP = 100 * 1024 * 1024;
const DB_NAME = `hitokoma:${new URL('./', import.meta.url).pathname}:v1`;
let database;
export const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const parseDate = value => new Date(`${value}T12:00:00`);
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '2100-12-31' && !Number.isNaN(parseDate(value).getTime()) && dateKey(parseDate(value)) === value;
}
export function readableError(error) {
  if (error?.name === 'QuotaExceededError') return '端末の保存容量が足りません。バックアップを取ってから、不要な記録や端末のデータを整理してください。';
  if (['SecurityError','InvalidStateError','UnknownError'].includes(error?.name)) return 'このブラウザでは保存できません。プライベートブラウズを解除するか、通常のSafari・Chromeで開いてください。';
  return error?.message || '操作を完了できませんでした。もう一度お試しください。';
}
export function openDB() {
  if (database) return Promise.resolve(database);
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('entries', {keyPath:'id'});
      request.result.createObjectStore('preferences');
    };
    request.onsuccess = () => {
      database = request.result;
      database.onversionchange = () => {database.close(); database = null;};
      resolve(database);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('ほかのタブの「ひとこま」を閉じて、もう一度お試しください。'));
  });
}
async function transaction(store, mode, run) {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(store, mode);
    let request;
    try { request = run(tx.objectStore(store)); } catch(error) { tx.abort(); reject(error); return; }
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = event => reject(tx.error || event.target.error || new Error('保存に失敗しました。もう一度お試しください。'));
    tx.onabort = () => reject(tx.error || new Error('保存が中断されました。もう一度お試しください。'));
  });
}
// ArrayBuffer avoids Blob persistence failures in some WebKit implementations.
// Convert before opening a transaction, so image reads cannot let it expire.
async function serializeEntry(entry) {
  const {blob,...rest}=entry;
  return {...rest,photoBytes:await blob.arrayBuffer(),photoType:blob.type};
}
export const allEntries = async () => (await transaction('entries','readonly',store=>store.getAll())).map(record=>{
  if(record.blob)return record;
  const {photoBytes,photoType,...rest}=record;
  return {...rest,blob:new Blob([photoBytes],{type:photoType||'image/jpeg'})};
});
export const saveEntry = async entry => {
  const record=await serializeEntry(entry);
  return transaction('entries','readwrite',store=>store.put(record));
};
export async function saveDailyEntries(entries, replaceExisting = false) {
  const dates = new Set(entries.map(entry => entry.date));
  if (dates.size !== entries.length) throw new Error('同じ日の写真は1枚だけ選んでください。');
  const records = [];
  for (const entry of entries) records.push(await serializeEntry(entry));
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', 'readwrite'), store = tx.objectStore('entries');
    const request = store.getAll(); let failure;
    request.onsuccess = () => {
      const ids = new Set(records.map(record => record.id));
      const conflicts = request.result.filter(record => dates.has(record.date) && !ids.has(record.id));
      if (conflicts.length && !replaceExisting) {
        failure = new Error('この日の記録が更新されました。もう一度保存して内容をご確認ください。'); tx.abort(); return;
      }
      try {
        for (const record of conflicts) store.delete(record.id);
        for (const record of records) store.put(record);
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = event => reject(failure || tx.error || event.target.error);
    tx.onabort = () => reject(failure || tx.error || new Error('保存が中断されました。元の記録は変更していません。'));
  });
}
export const deleteEntry = id => transaction('entries','readwrite',store=>store.delete(id));
export const readPreference = key => transaction('preferences','readonly',store=>store.get(key));
export const writePreference = (key,value) => transaction('preferences','readwrite',store=>store.put(value,key));
export async function importEntries(entries) {
  // One transaction: a failed import never leaves half a backup in the diary.
  const records=[];
  for(const entry of entries)records.push(await serializeEntry(entry));
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('entries','readwrite'), store=tx.objectStore('entries');
    let added=0;
    for(const entry of records) {
      const request=store.getKey(entry.id);
      request.onsuccess=()=>{if(request.result===undefined){store.add(entry);added++;}};
    }
    tx.oncomplete=()=>resolve(added);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error || new Error('復元が中断されました。既存の記録は変更していません。'));
  });
}
export async function normalizePhoto(file) {
  if (!(file instanceof Blob) || !file.size) throw new Error('写真が空です。別の写真を選んでください。');
  if (file.size > 40 * 1024 * 1024) throw new Error('写真は40MB以内のものを選んでください。');
  if (!/^image\/(jpeg|png|webp|heic|heif|avif)$/i.test(file.type)) throw new Error('写真として読み込めません。JPEG・PNG・WebP形式の写真を選んでください。');
  const url=URL.createObjectURL(file);
  try {
    const img=new Image(); img.src=url;
    try { await img.decode(); } catch { throw new Error('この写真を読み込めませんでした。JPEG・PNGなど別の形式で選び直してください。'); }
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth*img.naturalHeight > 100000000) throw new Error('写真が大きすぎます。小さくしてから選んでください。');
    const ratio=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio)); canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
    const ctx=canvas.getContext('2d');
    if (!ctx) throw new Error('写真を処理できませんでした。ブラウザを再起動してお試しください。');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.84));
    canvas.width=canvas.height=1;
    if (!blob) throw new Error('写真の変換に失敗しました。別の写真を選んでください。');
    return blob;
  } finally {URL.revokeObjectURL(url);}
}
export const blobToDataURL = blob => new Promise((resolve,reject)=>{
  const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('写真の書き出しに失敗しました。')); reader.readAsDataURL(blob);
});
export async function makeBackup(entries) {
  if(entries.length>1000)throw new Error('バックアップは1,000件までです。記録を整理してからお試しください。');
  const records=[];
  for(const {id,date,memo,blob,createdAt,updatedAt} of entries) records.push({id,date,memo,createdAt,updatedAt,photo:await blobToDataURL(blob)});
  const json=JSON.stringify({format:'hitokoma-backup',version:1,exportedAt:new Date().toISOString(),entries:records});
  if (new Blob([json]).size > MAX_BACKUP) throw new Error('バックアップが100MBを超えています。不要な記録を整理してからお試しください。');
  return new Blob([json],{type:'application/json'});
}
export async function parseBackup(file,onProgress=()=>{}) {
  if (!file.size || file.size>MAX_BACKUP) throw new Error('バックアップは100MB以内のJSONファイルを選んでください。');
  let data;
  try {data=JSON.parse(await file.text());} catch {throw new Error('バックアップの形式が正しくありません。「ひとこま」で書き出したJSONファイルを選んでください。');}
  if(data?.format!=='hitokoma-backup'||data.version!==1||!Array.isArray(data.entries)||data.entries.length>1000) throw new Error('対応していないバックアップです。ひとこまの形式・バージョンをご確認ください（最大1,000件）。');
  const ids=new Set(), records=[];
  for(const [index,record] of data.entries.entries()) {
    if(!record || typeof record.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(record.id)||record.id.startsWith('sample-')||ids.has(record.id)||!validDate(record.date)||typeof record.memo!=='string'||record.memo.length>MAX_MEMO||typeof record.photo!=='string'||record.photo.length>8000000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(record.photo)) throw new Error(`${index+1}件目の記録が正しくありません。復元を中止しました。`);
    ids.add(record.id);
    let bytes;
    try {bytes=Uint8Array.from(atob(record.photo.split(',')[1]), c=>c.charCodeAt(0));} catch {throw new Error(`${index+1}件目の写真が壊れています。`);}
    const type=record.photo.slice(5,record.photo.indexOf(';'));
    let blob;
    try {blob=await normalizePhoto(new Blob([bytes],{type}));} catch {throw new Error(`${index+1}件目の写真を読み込めません。復元を中止しました。`);}
    const now=new Date().toISOString();
    records.push({id:record.id,date:record.date,memo:record.memo,blob,createdAt:typeof record.createdAt==='string'&&!Number.isNaN(Date.parse(record.createdAt))?record.createdAt:now,updatedAt:typeof record.updatedAt==='string'&&!Number.isNaN(Date.parse(record.updatedAt))?record.updatedAt:now});
    onProgress(index+1,data.entries.length);
  }
  return records;
}
