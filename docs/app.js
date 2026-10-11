import {MAX_MEMO,dateKey,parseDate,validDate,readableError,allEntries,saveEntry,deleteEntry,readPreference,writePreference,normalizePhoto,makeBackup,parseBackup,importEntries} from './core.js';

const paths={journal:'<path d="M4 4h13a3 3 0 0 1 3 3v14H7a3 3 0 0 1-3-3V4Z"/><path d="M4 17h16M8 4v13m4-9h4m-4 4h4"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h1m6 0h1m-8 3h1"/>',plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',settings:'<path d="m9 3-.7 2.3-2 .9-2.2-.5-2 3.5 1.5 1.8v2l-1.5 1.8 2 3.5 2.2-.5 2 .9L9 21h4l.7-2.3 2-.9 2.2.5 2-3.5-1.5-1.8v-2l1.5-1.8-2-3.5-2.2.5-2-.9L13 3Z"/><circle cx="11" cy="12" r="3"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5-7 8-3-3-3 3"/>',edit:'<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',left:'<path d="m15 5-7 7 7 7"/>',right:'<path d="m9 5 7 7-7 7"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',check:'<path d="m5 12 4 4L19 6"/>',leaf:'<path d="M20 3C7 2 2 7 4 15c7 7 16 1 16-12Z"/><path d="M3 21 15 9"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.journal}</svg>`;
const $=selector=>document.querySelector(selector);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const weekdays=['SUN','MON','TUE','WED','THU','FRI','SAT'];
const monthNames=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const fullDate=value=>new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(parseDate(value));
const today=dateKey();
const state={entries:[],samples:true,hiddenSamples:[],view:'timeline',query:'',month:today.slice(0,7),selectedDay:today,ready:false,storage:true};
const sampleDetails=[
  ['cafe',0,'いつものカフェで、ひとやすみ。\n焼きたてのクロワッサンと、窓から入る光。こういう朝が好き。'],
  ['walk',2,'少し遠回りして、川沿いを散歩。\n風がすっかり秋の匂いになっていた。'],
  ['lunch',5,'今日のお昼は、トマトとバジルのパスタ。\nおいしくできたので、未来の自分にメモ。'],
  ['flowers',8,'帰り道に見つけたコスモスを、窓辺に。\n部屋に花があるだけで、気持ちまで明るくなる。'],
  ['sea',22,'夕暮れの海。\n何も考えず、波の音を聞いていた。こんな時間も、ちゃんと残しておきたい。'],
  ['reading',35,'雨の日は、読みかけの本とあたたかいお茶。\n今日は予定をつめこまない日にした。']
];
const samples=sampleDetails.map(([name,days,memo],index)=>{const d=parseDate(today);d.setDate(d.getDate()-days);return {id:`sample-${name}`,date:dateKey(d),memo,sample:true,url:`./assets/${name}.jpg`,createdAt:`2026-01-01T00:00:0${index}.000Z`};});
const urls=new Map();
const photoURL=entry=>{if(entry.sample)return entry.url;if(!urls.has(entry.id))urls.set(entry.id,URL.createObjectURL(entry.blob));return urls.get(entry.id);};
let editor=null, modalKind='', busy=false, toastTimer, confirmResolver=null, offlineReady=false;
const modal=$('#modal'), confirmModal=$('#confirmModal');

document.querySelectorAll('[data-view]').forEach(button=>{const view=button.dataset.view;button.innerHTML=icon(view==='timeline'?'journal':'calendar')+`<span>${view==='timeline'?'日々のきろく':'カレンダー'}</span>`;});
document.querySelectorAll('[data-action="settings"]').forEach(button=>button.innerHTML=icon('settings')+(button.classList.contains('nav-button')?'<span>設定・バックアップ</span>':''));
document.querySelectorAll('[data-action="create"]').forEach(button=>button.innerHTML=icon('plus')+'<span>記録する</span>');
$('.local-note').innerHTML=icon('lock')+'この端末だけに保存';
$('.search-toggle').innerHTML=icon('search');$('#searchIcon').innerHTML=icon('search');
$('#todayLabel').textContent=new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+' のきろく';

function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3600);}
function sortedEntries(){return [...state.entries,...(state.samples?samples.filter(e=>!state.hiddenSamples.includes(e.id)):[])].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));}
const matches=entry=>entry.memo.normalize('NFKC').toLocaleLowerCase('ja').includes(state.query.normalize('NFKC').toLocaleLowerCase('ja'));
const findEntry=id=>state.entries.find(e=>e.id===id)||samples.find(e=>e.id===id);
function card(entry,index=0){const d=parseDate(entry.date);return `<button class="entry-card" data-action="detail" data-id="${escape(entry.id)}" aria-label="${escape(fullDate(entry.date))}の${entry.sample?'サンプル':'記録'}：${escape(entry.memo.slice(0,70)||'写真の記録')}"><div class="photo-wrap"><img src="${escape(photoURL(entry))}" alt="${entry.sample?'サンプル写真':'記録した写真'}" loading="${index===0?'eager':'lazy'}" decoding="async" width="800" height="600"></div><div class="entry-info"><div class="entry-date"><strong>${String(d.getDate()).padStart(2,'0')}</strong><span>${weekdays[d.getDay()]}</span></div><div class="entry-text"><p>${escape(entry.memo||'写真で残した、今日のひとこま。')}</p>${entry.sample?'<span class="sample-tag">SAMPLE · サンプル</span>':''}</div></div></button>`;}
function empty(kind='diary'){const options={diary:['まだ、まっさらな一ページ。','今日見つけた小さなことを、<br>写真とひとことで残してみませんか。','最初のひとこまを記録', 'create'],search:['その言葉は、まだ日記のなかに。','ほかの言葉や、短いキーワードで<br>もう一度探してみてください。','検索をクリア','reset-search'],day:['この日は、まだ余白。','あとからでも大丈夫。<br>思い出したひとこまを残せます。','この日に記録する','create-day'],month:['この月は、まだ余白。','日付を選んで、<br>小さな思い出を残してみませんか。','ひとこまを記録','create']};const [title,text,label,action]=options[kind];return `<div class="empty-state"><div class="empty-illustration" aria-hidden="true">${icon(kind==='search'?'search':'leaf')}</div><h3>${title}</h3><p>${text}</p><button class="${kind==='search'?'secondary':'primary'}" data-action="${action}">${icon(kind==='search'?'search':'plus')}${label}</button></div>`;}
function render(){
  if(!state.ready)return;
  document.body.classList.toggle('calendar-view',state.view==='calendar');
  const all=sortedEntries(), entries=all.filter(matches), isSearch=Boolean(state.query);
  $('#entryCount').textContent=isSearch?`${entries.length}件の検索結果`:`${all.length} こま`;
  $('#viewTitle').textContent=state.view==='timeline'?'日々のきろく':'カレンダー';
  $('#sampleNotice').hidden=!state.samples||!samples.some(e=>!state.hiddenSamples.includes(e.id));
  document.querySelectorAll('[data-view]').forEach(button=>{const selected=button.dataset.view===state.view;button.classList.toggle('active',selected);if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  if(state.view==='calendar'){$('#content').innerHTML=calendar(entries);return;}
  if(!entries.length){$('#content').innerHTML=empty(isSearch?'search':'diary');return;}
  const groups=new Map();for(const entry of entries){const month=entry.date.slice(0,7);if(!groups.has(month))groups.set(month,[]);groups.get(month).push(entry);}
  $('#content').innerHTML=(isSearch?`<p class="results-label">「${escape(state.query)}」を含むきろく</p>`:'')+[...groups].map(([key,group])=>{const [year,month]=key.split('-').map(Number);return `<section class="month-section" aria-label="${year}年${month}月"><h3 class="month-heading"><span class="month-number">${String(month).padStart(2,'0')}<span class="month-jp">月</span></span><span class="month-year">${year}</span><span class="month-english">${monthNames[month-1]}</span></h3><div class="entries-grid">${group.map(card).join('')}</div></section>`;}).join('');
}
function calendar(entries){
  const [year,month]=state.month.split('-').map(Number), days=new Date(year,month,0).getDate(), first=new Date(year,month-1,1).getDay();
  const counts=new Map();entries.forEach(e=>counts.set(e.date,(counts.get(e.date)||0)+1));
  let cells='<span></span>'.repeat(first);
  for(let day=1;day<=days;day++){const key=`${state.month}-${String(day).padStart(2,'0')}`,count=counts.get(key)||0;cells+=`<button class="calendar-day${key===today?' today':''}${key===state.selectedDay?' selected':''}" data-action="select-day" data-date="${key}" aria-label="${month}月${day}日、${count?`記録${count}件`:'記録なし'}" aria-pressed="${key===state.selectedDay}"${key===today?' aria-current="date"':''}>${day}${count?'<span class="day-dot"></span>':''}</button>`;}
  const shown=entries.filter(e=>state.selectedDay?e.date===state.selectedDay:e.date.startsWith(state.month));
  return `<div class="calendar-box"><div class="calendar-header"><button class="icon-button" data-action="prev-month" aria-label="前の月" ${state.month==='1900-01'?'disabled':''}>${icon('left')}</button><h3><small>${year}年</small>${month}月</h3><button class="icon-button" data-action="next-month" aria-label="次の月" ${state.month==='2100-12'?'disabled':''}>${icon('right')}</button></div><div class="week-labels" aria-hidden="true">${['日','月','火','水','木','金','土'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-grid">${cells}</div><p class="calendar-key">${state.query?'検索に一致する':'記録のある'}日</p></div><h3 class="day-heading">${state.selectedDay?escape(fullDate(state.selectedDay)):`${month}月のきろく`}<span class="count">　${shown.length}こま</span></h3>${shown.length?`<div class="entries-grid">${shown.map(card).join('')}</div>`:empty(state.query?'search':state.selectedDay?'day':'month')}`;
}
function openModal(kind,title,body){
  modalKind=kind;modal.innerHTML=`<div class="modal-header"><h2 id="modalTitle" tabindex="-1">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="閉じる">${icon('close')}</button></div>${body}`;
  if(!modal.open)modal.showModal();
  modal.scrollTop=0;$('#modalTitle').focus({preventScroll:true});
}
function discardEditor(){if(editor?.previewURL)URL.revokeObjectURL(editor.previewURL);editor=null;}
function closeModal(){modal.close();discardEditor();modalKind='';}
function isDirty(){return editor&&(editor.photoChanged||$('#memoInput')?.value!==editor.initialMemo||$('#dateInput')?.value!==editor.initialDate);}
async function requestClose(){if(busy){toast('処理が終わるまでお待ちください');return;}if(isDirty()&&!await confirmAction('編集中の内容を閉じますか？','まだ保存されていない内容は失われます。','保存せず閉じる',true))return;closeModal();}
function confirmAction(title,message,label,danger=false){
  return new Promise(resolve=>{confirmResolver=resolve;confirmModal.innerHTML=`<h2 id="confirmTitle">${escape(title)}</h2><p>${escape(message)}</p><div class="confirm-actions"><button class="secondary" data-confirm="no" autofocus>キャンセル</button><button class="primary${danger?' danger-button':''}" data-confirm="yes">${escape(label)}</button></div>`;confirmModal.showModal();});
}
function resolveConfirm(result){confirmModal.close();confirmResolver?.(result);confirmResolver=null;}
confirmModal.addEventListener('click',event=>{const button=event.target.closest('[data-confirm]');if(button)resolveConfirm(button.dataset.confirm==='yes');});
confirmModal.addEventListener('cancel',event=>{event.preventDefault();resolveConfirm(false);});
modal.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
modal.addEventListener('click',event=>{if(event.target===modal){const rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)requestClose();}});

function showDetail(id){const entry=findEntry(id);if(!entry)return;discardEditor();openModal('detail','ひとこまをひらく',`<img class="detail-photo" src="${escape(photoURL(entry))}" alt="${entry.sample?'サンプル写真':'記録した写真'}"><div class="detail-copy"><p class="detail-date">${escape(fullDate(entry.date))}${entry.sample?'<span class="sample-tag">サンプル</span>':''}</p><p class="detail-memo">${escape(entry.memo||'写真で残した、今日のひとこま。')}</p><div class="detail-actions"><button class="secondary" data-action="edit" data-id="${escape(id)}">${icon('edit')}${entry.sample?'自分の記録にする':'編集する'}</button><button class="danger-text" data-action="delete" data-id="${escape(id)}" aria-label="${entry.sample?'このサンプルを非表示':'この記録を削除'}">${icon('trash')}${entry.sample?'非表示':'削除'}</button></div></div>`);}
async function showEditor(id=null,initialDate=today){
  if(busy)return;
  const entry=id?findEntry(id):null;discardEditor();
  editor={id:entry&&!entry.sample?entry.id:null,blob:entry?.blob||null,initialMemo:entry?.memo||'',initialDate:entry?.date||initialDate,photoChanged:false,previewURL:null,createdAt:entry?.createdAt};
  openModal('editor',entry&&!entry.sample?'ひとこまを編集':'今日のひとこま',`<form id="entryForm" class="modal-body"><p class="modal-subtitle">${entry?.sample?'サンプルをもとに、自分の記録として保存できます。':'忘れたくない瞬間を、ひとつ。'}</p><label class="photo-picker" id="photoPicker">${entry?`<img src="${escape(photoURL(entry))}" alt="選択した写真"><span class="change-photo">写真を選び直す</span>`:`${icon('image')}<strong>写真を選ぶ</strong><small>お気に入りの一枚を、ここに。</small>`}<input type="file" id="photoInput" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif" aria-label="写真を選ぶ"></label><label class="field"><span class="field-label">${icon('calendar')}日付</span><input type="date" id="dateInput" value="${escape(editor.initialDate)}" min="1900-01-01" max="2100-12-31" required></label><label class="field"><span class="field-label">ひとことメモ<small>空欄でも保存できます</small></span><textarea id="memoInput" rows="4" maxlength="${MAX_MEMO}" placeholder="どんな一日でしたか？">${escape(editor.initialMemo)}</textarea><span class="field-count" id="memoCount">${editor.initialMemo.length} / ${MAX_MEMO}</span></label><p class="form-error" id="editorError" role="alert" hidden></p><button class="primary full-width" type="submit" id="saveButton">${icon('check')}このひとこまを保存</button><p class="editor-note">${icon('lock')}写真とメモは、この端末だけに保存されます</p></form>`);
  $('#photoInput').addEventListener('change',choosePhoto);
  $('#memoInput').addEventListener('input',()=>$('#memoCount').textContent=`${$('#memoInput').value.length} / ${MAX_MEMO}`);
  $('#entryForm').addEventListener('submit',saveForm);
  if(entry?.sample){
    setEditorBusy(true,'写真を準備中…');
    try{const response=await fetch(new URL(entry.url,document.baseURI));if(!response.ok)throw new Error('サンプル写真を読み込めませんでした。写真を選び直してください。');editor.blob=await response.blob();}catch(error){editorError(readableError(error));}finally{setEditorBusy(false);}
  }
}
function editorError(message){$('#editorError').hidden=false;$('#editorError').textContent=message;}
function setEditorBusy(value,label='保存中…'){busy=value;$('#saveButton').disabled=value;$('#photoInput').disabled=value;$('#dateInput').disabled=value;$('#memoInput').disabled=value;$('#saveButton').innerHTML=value?`<span class="spinner" aria-hidden="true"></span>${label}`:icon('check')+'このひとこまを保存';}
async function choosePhoto(event){
  const file=event.target.files?.[0];if(!file)return;setEditorBusy(true,'写真を準備中…');$('#editorError').hidden=true;
  try{const blob=await normalizePhoto(file);if(editor.previewURL)URL.revokeObjectURL(editor.previewURL);editor.blob=blob;editor.previewURL=URL.createObjectURL(blob);editor.photoChanged=true;const input=$('#photoInput');$('#photoPicker').innerHTML=`<img src="${editor.previewURL}" alt="選択した写真"><span class="change-photo">写真を選び直す</span>`;$('#photoPicker').append(input);}catch(error){editorError(readableError(error));}finally{event.target.value='';setEditorBusy(false);}
}
async function saveForm(event){
  event.preventDefault();if(busy)return;
  if(!editor.blob){editorError('残したい写真を1枚選んでください。');$('#photoInput').focus();return;}
  const date=$('#dateInput').value,memo=$('#memoInput').value.trim();
  if(!validDate(date)){editorError('1900年〜2100年の正しい日付を選んでください。');return;}
  if(memo.length>MAX_MEMO){editorError(`メモは${MAX_MEMO}文字以内にしてください。`);return;}
  setEditorBusy(true);$('#editorError').hidden=true;
  try{
    const now=new Date().toISOString(),isEdit=Boolean(editor.id);
    const entry={id:editor.id||crypto.randomUUID(),date,memo,blob:editor.blob,createdAt:editor.createdAt||now,updatedAt:now};
    await saveEntry(entry);
    if(urls.has(entry.id)){URL.revokeObjectURL(urls.get(entry.id));urls.delete(entry.id);}
    const index=state.entries.findIndex(e=>e.id===entry.id);if(index<0)state.entries.push(entry);else state.entries[index]=entry;
    busy=false;closeModal();state.query='';$('#searchInput').value='';state.month=date.slice(0,7);state.selectedDay=date;render();toast(isEdit?'ひとこまを更新しました':'ひとこまを保存しました');
    if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  }catch(error){editorError(readableError(error));setEditorBusy(false);}
}
async function removeRecord(id){
  const entry=findEntry(id);if(!entry)return;
  const confirmed=await confirmAction(entry.sample?'このサンプルを非表示にしますか？':'このひとこまを削除しますか？',entry.sample?'この端末の一覧からサンプルを取り除きます。':'写真とメモがこの端末から削除されます。\nこの操作は取り消せません。','削除する',true);if(!confirmed)return;
  busy=true;
  try{
    if(entry.sample){const hidden=[...state.hiddenSamples,id];await writePreference('hiddenSamples',hidden);state.hiddenSamples=hidden;}
    else {await deleteEntry(id);state.entries=state.entries.filter(e=>e.id!==id);if(urls.has(id)){URL.revokeObjectURL(urls.get(id));urls.delete(id);}}
    busy=false;closeModal();render();toast(entry.sample?'サンプルを非表示にしました':'ひとこまを削除しました');
  }catch(error){busy=false;toast(readableError(error));}
}
async function setSamples(value){
  try{await writePreference('samples',value);if(value){await writePreference('hiddenSamples',[]);state.hiddenSamples=[];}state.samples=value;render();toast(value?'サンプルを表示しました':'サンプルを非表示にしました');}catch(error){toast(readableError(error));const input=$('#sampleToggle');if(input)input.checked=state.samples;}
}
function offlineLabel(){return offlineReady?'オフラインでも使えます':navigator.onLine?'オフライン用の準備中です':'オフラインです';}
function showSettings(){
  const bytes=state.entries.reduce((sum,e)=>sum+e.blob.size,0),size=bytes<1024*1024?`${Math.round(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;
  discardEditor();openModal('settings','設定とバックアップ',`<div class="modal-body"><section class="settings-section"><h3>わたしのきろく</h3><div class="storage-stats"><span>${state.entries.length}こまを保存</span><span>写真 ${size}</span></div><p>写真とメモは、このブラウザ・端末内に保存されます。サーバーへの送信や、ほかの端末との自動同期はありません。</p><p class="settings-small">ブラウザのデータ消去・端末の故障・ストレージの自動整理で消えることがあります。大切な記録は、ときどきバックアップを。プライベートブラウズでは保存が保持されない場合があります。</p><div class="offline-state" id="offlineState">${icon('check')}${offlineLabel()}</div></section><section class="settings-section"><h3>バックアップ</h3><p>自分で保存した写真とメモを、ひとつのファイルに。復元時は今の記録を残し、同じIDの記録は重複して追加しません。</p><div class="backup-actions"><button class="secondary full-width" id="exportButton" data-action="export">${icon('download')}バックアップを書き出す</button><label class="secondary full-width file-button">${icon('upload')}バックアップから復元<input type="file" id="restoreInput" accept=".json,application/json" aria-label="バックアップから復元"></label></div><p class="settings-small">サンプルは書き出し対象外です。復元は100MB・1,000件まで。ホーム画面版へ移すときも、この機能を使えます。</p><p id="backupStatus" class="settings-small" role="status"></p><p id="backupError" class="form-error" role="alert" hidden></p></section><section class="settings-section"><div class="settings-row"><label for="sampleToggle">サンプルの日記を表示</label><input type="checkbox" id="sampleToggle" class="switch" role="switch" ${state.samples?'checked':''}></div><p class="settings-small">アプリの雰囲気を試せる6つの記録です。写真と出来事は、このデモのために作成しました。</p></section><section class="settings-section"><h3>ホーム画面に、ひとこまを。</h3><p>いつものアプリのように、すぐに開けます。</p><details><summary>iPhone・iPadで追加する</summary><ol><li>Safariでこのページを開く</li><li>共有ボタンをタップ</li><li>「ホーム画面に追加」を選ぶ</li></ol></details><details><summary>Androidで追加する</summary><ol><li>Chromeでこのページを開く</li><li>メニュー（︙）をタップ</li><li>「ホーム画面に追加」または「アプリをインストール」を選ぶ</li></ol></details></section><p class="settings-footer">ひとこま <span class="demo-badge">デモ</span></p></div>`);
  $('#sampleToggle').addEventListener('change',event=>setSamples(event.target.checked));
  $('#restoreInput').addEventListener('change',restoreBackup);
}
function setBackupBusy(value){busy=value;$('#exportButton').disabled=value;$('#restoreInput').disabled=value;$('#sampleToggle').disabled=value;}
function backupError(message){$('#backupError').textContent=message;$('#backupError').hidden=false;}
async function exportBackup(){
  if(busy)return;setBackupBusy(true);$('#backupError').hidden=true;$('#backupStatus').textContent='写真をまとめています…';
  try{const blob=await makeBackup(state.entries),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`hitokoma-backup-${dateKey()}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#backupStatus').textContent=`${state.entries.length}こまのバックアップを書き出しました。ダウンロード先をご確認ください。`;toast('バックアップを書き出しました');}catch(error){backupError(readableError(error));$('#backupStatus').textContent='';}finally{setBackupBusy(false);}
}
async function restoreBackup(event){
  const file=event.target.files?.[0];if(!file)return;setBackupBusy(true);$('#backupError').hidden=true;$('#backupStatus').textContent='バックアップを確認しています…';
  try{
    const records=await parseBackup(file,(n,total)=>$('#backupStatus').textContent=`写真を確認しています… ${n} / ${total}`);
    const existing=new Set(state.entries.map(e=>e.id)),count=records.filter(e=>!existing.has(e.id)).length;
    if(!count){$('#backupStatus').textContent='追加する記録はありません。すべて復元済み、または空のバックアップです。';return;}
    const ok=await confirmAction(`${count}こまを復元しますか？`,`今の記録を残したまま、写真とメモを追加します。${records.length-count?`\n同じIDの${records.length-count}こまはスキップします。`:''}`,'復元する');
    if(!ok){$('#backupStatus').textContent='復元をキャンセルしました。';return;}
    $('#backupStatus').textContent='この端末に保存しています…';const added=await importEntries(records);state.entries=await allEntries();render();busy=false;showSettings();$('#backupStatus').textContent=`${added}こまを復元しました。`;toast(`${added}こまを復元しました`);
  }catch(error){backupError(readableError(error));$('#backupStatus').textContent='';}finally{event.target.value='';setBackupBusy(false);}
}

document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action],[data-view]');if(!target||target.disabled)return;
  if(target.dataset.view){state.view=target.dataset.view;render();window.scrollTo({top:0,behavior:'instant'});return;}
  const action=target.dataset.action;
  if(busy&&!['close-modal'].includes(action))return;
  switch(action){
    case 'create':showEditor();break;
    case 'create-day':showEditor(null,state.selectedDay||today);break;
    case 'detail':showDetail(target.dataset.id);break;
    case 'edit':showEditor(target.dataset.id);break;
    case 'delete':await removeRecord(target.dataset.id);break;
    case 'settings':showSettings();break;
    case 'close-modal':await requestClose();break;
    case 'hide-samples':await setSamples(false);break;
    case 'search':$('#searchWrap').hidden=!$('#searchWrap').hidden;$('.search-toggle').setAttribute('aria-expanded',String(!$('#searchWrap').hidden));if(!$('#searchWrap').hidden)$('#searchInput').focus();else{state.query='';$('#searchInput').value='';render();}break;
    case 'clear-search':$('#searchWrap').hidden=true;$('.search-toggle').setAttribute('aria-expanded','false');state.query='';$('#searchInput').value='';render();$('.search-toggle').focus();break;
    case 'reset-search':state.query='';$('#searchInput').value='';render();$('#searchInput').focus();break;
    case 'select-day':state.selectedDay=target.dataset.date;render();document.querySelector(`[data-date="${state.selectedDay}"]`)?.focus({preventScroll:true});break;
    case 'prev-month':case 'next-month':{const d=parseDate(`${state.month}-01`);d.setMonth(d.getMonth()+(action==='next-month'?1:-1));state.month=dateKey(d).slice(0,7);state.selectedDay=null;render();document.querySelector(`[data-action="${action}"]`)?.focus({preventScroll:true});break;}
    case 'export':await exportBackup();break;
  }
});
$('#searchInput').addEventListener('input',event=>{state.query=event.target.value.trim();render();});
document.addEventListener('error',event=>{if(event.target.tagName==='IMG'&&!event.target.classList.contains('brand')){const image=event.target;if(image.closest('.photo-wrap')){const fallback=document.createElement('span');fallback.className='photo-placeholder';fallback.textContent='写真を読み込めませんでした';image.replaceWith(fallback);}else if(image.classList.contains('detail-photo')){image.alt='写真を読み込めませんでした。編集から写真を選び直せます。';}}},true);
window.addEventListener('beforeunload',event=>{if(busy||isDirty()){event.preventDefault();event.returnValue='';}});
window.addEventListener('online',()=>{if($('#offlineState'))$('#offlineState').innerHTML=icon('check')+offlineLabel();});
window.addEventListener('offline',()=>{if($('#offlineState'))$('#offlineState').innerHTML=icon('check')+offlineLabel();});
// Refresh records after another tab has changed them, without interrupting an open editor.
document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'&&state.ready&&!modal.open&&state.storage){try{state.entries=await allEntries();render();}catch{ /* Existing records stay visible. */ }}});

async function init(){
  try{const [entries,show,hidden]=await Promise.all([allEntries(),readPreference('samples'),readPreference('hiddenSamples')]);state.entries=entries;state.samples=show!==false;state.hiddenSamples=Array.isArray(hidden)?hidden:[];}
  catch(error){state.storage=false;const warning=document.createElement('p');warning.className='form-error';warning.setAttribute('role','alert');warning.textContent=readableError(error);$('#content').before(warning);}
  state.ready=true;render();
  if('serviceWorker' in navigator){
    try{
      const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
      if(registration.active)offlineReady=true;
      registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='activated'){offlineReady=true;if($('#offlineState'))$('#offlineState').innerHTML=icon('check')+offlineLabel();}});});
      navigator.serviceWorker.ready.then(()=>{offlineReady=true;if($('#offlineState'))$('#offlineState').innerHTML=icon('check')+offlineLabel();});
    }catch{offlineReady=false;}
  }
}
init();
