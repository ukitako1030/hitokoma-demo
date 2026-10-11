import { PAPERS, LAYOUTS, dimensions, dailyRecords, renderSheet, makeZip, saveFile } from './print.js?v=2';
import { captureDate } from './exif.js?v=2';
import { normalizePhoto, dateKey, validDate, readableError, MAX_MEMO } from './core.js?v=2';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatMonth = month => `${month.slice(0, 4)}年 ${Number(month.slice(5))}月`;

export function mountPrint(root, { entries, sampleEntries, includeSamples, photoURL, notify, setBusy }) {
  let destroyed = false, previewURL = null, output = null;
  const months = [...new Set([dateKey().slice(0, 7), ...entries.map(e => e.date.slice(0, 7)), ...sampleEntries.map(e => e.date.slice(0, 7))])].sort().reverse();
  const options = { month: months[0], paper: '2l', layout: 'diary', format: 'jpeg', page: 0 };
  root.innerHTML = `<div class="print-studio"><div class="print-controls"><p class="studio-eyebrow">A LITTLE MONTH, ON PAPER</p><p class="studio-intro">スマホの中の思い出を、<br>手帳に貼れる一枚に。</p><label class="field"><span class="field-label">まとめる月</span><select id="printMonth">${months.map(month => `<option value="${month}">${formatMonth(month)}</option>`).join('')}</select></label><fieldset class="layout-choices"><legend>かたちを選ぶ</legend>${Object.entries(LAYOUTS).map(([key, value]) => `<label class="layout-option"><input type="radio" name="printLayout" value="${key}" ${key === 'diary' ? 'checked' : ''}><span class="layout-drawing ${key}" aria-hidden="true">${'<i></i>'.repeat(key === 'calendar' ? 7 : key === 'sticker' ? 8 : 4)}</span><span><strong>${value.label}</strong><small>${value.description}</small></span><span class="choice-dot" aria-hidden="true"></span></label>`).join('')}</fieldset><div class="print-selects"><label class="field"><span class="field-label">用紙・貼り付けサイズ</span><select id="printPaper">${Object.entries(PAPERS).map(([key, paper]) => `<option value="${key}">${paper.label}</option>`).join('')}</select></label><label class="field"><span class="field-label">画像の形式</span><select id="printFormat"><option value="jpeg">JPEG · 写真プリント向け</option><option value="png">PNG · 文字をくっきり</option></select></label></div><label class="check-row"><input id="printSamples" type="checkbox" ${includeSamples ? 'checked' : ''}>サンプルも含めて試す</label><p class="studio-note">1日1枚でまとめます。同じ日の記録は自分の記録を優先し、更新が新しいものを使います。</p></div><div class="print-result"><div class="preview-toolbar"><span>できあがり</span><span id="printDimensions"></span></div><div id="sheetPreview" class="sheet-preview" aria-live="polite"></div><div class="preview-pagination"><button class="icon-button" id="printPrevious" aria-label="前のページ">‹</button><span id="printPageStatus" role="status"></span><button class="icon-button" id="printNext" aria-label="次のページ">›</button></div><p id="printError" class="form-error" role="alert" hidden></p><button id="printDownload" class="primary full-width" disabled>このページを保存</button><button id="printZip" class="secondary full-width" hidden>全ページをまとめて保存（ZIP）</button><button id="printShare" class="secondary full-width" hidden>共有・写真に保存</button><p id="printStatus" class="studio-note" role="status"></p><p id="printTruncated" class="studio-note" hidden>長いメモは、収まるところまで「…」で省略しています。元の日記は変わりません。</p><details class="print-help"><summary>きれいに印刷するには</summary><p>写真用紙は選んだサイズで印刷してください。手帳向けサイズは、印刷設定で「実際のサイズ／100%」を選びます。画像は300dpiです。</p><p>フチなし印刷は周囲が切れることがあります。まず1枚お試しください。長いメモの読みやすさは、2L判以上がおすすめです。手帳向けは貼り付け用の目安サイズです。</p></details></div></div>`;
  const $ = selector => root.querySelector(selector);
  const selected = () => [...entries, ...($('#printSamples').checked ? sampleEntries : [])];
  const setWorking = value => { setBusy(value); root.querySelectorAll('select,input,button').forEach(element => element.disabled = value); };
  const name = page => `hitokoma-${options.month}-${options.layout}-${options.paper}-${String(page + 1).padStart(2, '0')}.${options.format === 'jpeg' ? 'jpg' : 'png'}`;
  async function update() {
    output = null; setWorking(true); $('#printError').hidden = true; $('#printStatus').textContent = '';
    $('#printZip').hidden = true; $('#printShare').hidden = true; $('#printTruncated').hidden = true;
    const all = selected(), records = dailyRecords(all, options.month);
    const { width, height } = dimensions(options.paper);
    $('#printDimensions').textContent = `${width} × ${height} px`;
    if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = null; }
    if (!records.length) {
      $('#sheetPreview').innerHTML = '<div class="print-empty"><span>まだ、白紙の一枚。</span><p>この月の記録を追加するか、<br>「サンプルも含めて試す」を選んでください。</p></div>';
      $('#printPageStatus').textContent = '0日分'; setWorking(false);
      $('#printDownload').disabled = $('#printPrevious').disabled = $('#printNext').disabled = true;
      return;
    }
    $('#sheetPreview').innerHTML = '<p class="preview-loading"><span class="spinner"></span>思い出を並べています…</p>';
    try {
      output = await renderSheet({ ...options, entries: all, photoURL });
      if (destroyed) return;
      previewURL = URL.createObjectURL(output.blob);
      $('#sheetPreview').innerHTML = `<a href="${previewURL}" target="_blank" rel="noopener" aria-label="印刷用画像を拡大して確認"><img src="${previewURL}" alt="${esc(formatMonth(options.month))}の${LAYOUTS[options.layout].label}、${options.page + 1}ページ目"><span>タップして拡大</span></a>`;
      $('#printPageStatus').textContent = `${output.count}日分 · ${options.page + 1} / ${output.pages}枚`;
      $('#printZip').hidden = output.pages < 2;
      $('#printTruncated').hidden = output.truncated === 0;
      try { $('#printShare').hidden = !navigator.canShare?.({ files: [new File([output.blob], name(options.page), { type: output.blob.type })] }); } catch { $('#printShare').hidden = true; }
    } catch (error) { $('#printError').hidden = false; $('#printError').textContent = readableError(error); $('#sheetPreview').innerHTML = '<p class="print-empty">画像を準備できませんでした。<br>設定を選び直すと、もう一度試せます。</p>'; }
    finally {
      if (!destroyed) { setWorking(false); $('#printDownload').disabled = !output; $('#printPrevious').disabled = !output || options.page === 0; $('#printNext').disabled = !output || options.page + 1 >= output.pages; }
    }
  }
  root.addEventListener('change', event => {
    if (event.target.id === 'printMonth') options.month = event.target.value;
    if (event.target.id === 'printPaper') options.paper = event.target.value;
    if (event.target.id === 'printFormat') options.format = event.target.value;
    if (event.target.name === 'printLayout') options.layout = event.target.value;
    options.page = 0; update();
  });
  $('#printPrevious').onclick = () => { if (options.page > 0) { options.page--; update(); } };
  $('#printNext').onclick = () => { if (output && options.page + 1 < output.pages) { options.page++; update(); } };
  $('#printDownload').onclick = () => { if (!output) return; saveFile(output.blob, name(options.page)); $('#printStatus').textContent = '画像を書き出しました。ダウンロード先をご確認ください。'; notify('手帳用の画像を書き出しました'); };
  $('#printShare').onclick = async () => {
    if (!output) return;
    try { await navigator.share({ files: [new File([output.blob], name(options.page), { type: output.blob.type })] }); }
    catch (error) { if (error.name !== 'AbortError') $('#printStatus').textContent = '共有できませんでした。「このページを保存」をお使いください。'; }
  };
  $('#printZip').onclick = async () => {
    if (!output) return; setWorking(true); $('#printError').hidden = true;
    try {
      const files = [], pages = output.pages;
      for (let page = 0; page < pages; page++) {
        $('#printStatus').textContent = `${page + 1} / ${pages}枚を準備しています…`;
        const result = page === options.page ? output : await renderSheet({ ...options, page, entries: selected(), photoURL });
        files.push({ name: name(page), blob: result.blob });
      }
      saveFile(await makeZip(files), `hitokoma-${options.month}-${options.layout}-${options.paper}.zip`);
      $('#printStatus').textContent = `${pages}枚をZIPにまとめました。解凍すると画像を使えます。`; notify('ひと月分の画像を書き出しました');
    } catch (error) { $('#printError').hidden = false; $('#printError').textContent = readableError(error); }
    finally { setWorking(false); $('#printPrevious').disabled = options.page === 0; $('#printNext').disabled = options.page + 1 >= output.pages; }
  };
  update();
  return { destroy: () => { destroyed = true; if (previewURL) URL.revokeObjectURL(previewURL); }, isDirty: () => false };
}

export function mountBatch(root, { setBusy, save, notify, initialDate = dateKey() }) {
  let photos = [], working = false, destroyed = false;
  root.innerHTML = `<div class="batch-studio"><p class="studio-eyebrow">ONE PHOTO, ONE DAY</p><p class="studio-intro">何日分か、まとめて。</p><p class="modal-subtitle">選んだ写真の撮影日を読み取り、1日1枚を選びます。<br>日付がわからない写真は、あとから直せます。</p><label class="secondary full-width file-button batch-picker">写真をまとめて選ぶ<input id="batchFiles" type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif" aria-label="写真をまとめて選ぶ"></label><p class="studio-note">1回60枚まで。写真はこの端末内だけで処理します。</p><p id="batchProgress" role="status" class="batch-progress"></p><p id="batchError" class="form-error" role="alert" hidden></p><div id="batchReview" hidden><label class="field"><span class="field-label">撮影日で絞り込む</span><select id="batchFilter"><option value="all">すべての日</option></select></label><div id="batchCards" class="batch-cards"></div><div class="batch-bottom"><span id="batchCount"></span><button id="batchSave" class="primary">選んだ写真を記録する</button></div></div></div>`;
  const $ = selector => root.querySelector(selector);
  const setWorking = value => { working = value; setBusy(value); root.querySelectorAll('input,select,button').forEach(element => element.disabled = value); };
  const count = () => { const total = photos.filter(p => p.selected).length; $('#batchCount').textContent = `${total}日分を選択`; $('#batchSave').disabled = total === 0 || working; };
  function refreshFilter() {
    const current = $('#batchFilter').value;
    const dates = [...new Set(photos.map(p => p.date))].sort().reverse();
    $('#batchFilter').innerHTML = '<option value="all">すべての日</option>' + dates.map(date => `<option value="${date}">${date.replaceAll('-', ' / ')}</option>`).join('');
    $('#batchFilter').value = dates.includes(current) ? current : 'all';
  }
  function filter() { const date = $('#batchFilter').value; root.querySelectorAll('.batch-card').forEach(card => card.hidden = date !== 'all' && photos[Number(card.dataset.index)].date !== date); }
  function syncSelections() { root.querySelectorAll('[data-batch="select"]').forEach(input => { input.checked = photos[Number(input.dataset.index)].selected; input.closest('.batch-card').classList.toggle('is-selected', input.checked); }); count(); }
  function showCards() {
    $('#batchReview').hidden = photos.length === 0;
    $('#batchCards').innerHTML = photos.map((photo, index) => `<article class="batch-card ${photo.selected ? 'is-selected' : ''}" data-index="${index}"><div class="batch-photo"><img src="${photo.url}" alt="選んだ写真 ${index + 1}" loading="lazy"><label class="batch-choice"><input type="checkbox" data-batch="select" data-index="${index}" ${photo.selected ? 'checked' : ''}><span>この写真を使う</span></label></div><div class="batch-fields"><p class="batch-origin">${photo.captured ? '撮影日を読み取りました' : '撮影日不明 · 日付を指定してください'}</p><label><span>日付</span><input type="date" data-batch="date" data-index="${index}" value="${photo.date}" min="1900-01-01" max="2100-12-31" required></label><label><span>ひとこと</span><textarea data-batch="memo" data-index="${index}" maxlength="${MAX_MEMO}" rows="2" placeholder="今日どんな一日だった？">${esc(photo.memo)}</textarea></label></div></article>`).join('');
    refreshFilter(); filter(); count();
  }
  $('#batchFiles').onchange = async event => {
    const files = [...event.target.files]; event.target.value = ''; if (!files.length || working) return;
    $('#batchError').hidden = true;
    if (files.length + photos.length > 60) { $('#batchError').hidden = false; $('#batchError').textContent = '一度に選べる写真は合計60枚までです。枚数を減らして選んでください。'; return; }
    setWorking(true); const failures = [];
    try {
      for (const [i, file] of files.entries()) {
        $('#batchProgress').textContent = `写真を準備しています… ${i + 1} / ${files.length}`;
        try {
          const captured = await captureDate(file), blob = await normalizePhoto(file), date = captured || initialDate;
          photos.push({ blob, url: URL.createObjectURL(blob), date, captured, memo: '', selected: !photos.some(p => p.selected && p.date === date) });
        } catch { failures.push(file.name); }
      }
      if (destroyed) return;
      showCards(); $('#batchProgress').textContent = photos.length ? '同じ日の写真は、使いたい1枚にチェック。日付とメモもここで編集できます。' : '';
      if (failures.length) { $('#batchError').hidden = false; $('#batchError').textContent = `${failures.length}枚を読み込めませんでした。JPEG・PNGなどの写真を選んでください。読み込めた写真は残しています。`; }
    } finally { if (!destroyed) { setWorking(false); count(); } }
  };
  $('#batchFilter').onchange = filter;
  $('#batchCards').addEventListener('input', event => { if (event.target.dataset.batch === 'memo') photos[Number(event.target.dataset.index)].memo = event.target.value; });
  $('#batchCards').addEventListener('change', event => {
    const { batch, index } = event.target.dataset; if (index === undefined) return;
    const photo = photos[Number(index)];
    if (batch === 'select') { photo.selected = event.target.checked; if (photo.selected) photos.forEach((p, i) => { if (i !== +index && p.date === photo.date) p.selected = false; }); }
    if (batch === 'date') {
      if (!validDate(event.target.value)) { event.target.value = photo.date; return; }
      photo.date = event.target.value;
      if (photo.selected) photos.forEach((p, i) => { if (i !== +index && p.date === photo.date) p.selected = false; });
      refreshFilter(); filter();
    }
    syncSelections();
  });
  $('#batchSave').onclick = async () => {
    const selected = photos.filter(p => p.selected); if (!selected.length || working) return;
    setWorking(true); $('#batchError').hidden = true; $('#batchProgress').textContent = '選んだひとこまを保存しています…';
    try {
      const result = await save(selected.map(photo => ({ date: photo.date, memo: photo.memo.trim(), blob: photo.blob })));
      if (result) { photos.forEach(photo => URL.revokeObjectURL(photo.url)); photos = []; notify(`${selected.length}日分を保存しました`); }
      else $('#batchProgress').textContent = '保存をキャンセルしました。写真を選び直せます。';
    } catch (error) { $('#batchError').hidden = false; $('#batchError').textContent = readableError(error); $('#batchProgress').textContent = ''; }
    finally { if (!destroyed) { setWorking(false); count(); } }
  };
  return { destroy: () => { destroyed = true; photos.forEach(photo => URL.revokeObjectURL(photo.url)); }, isDirty: () => photos.length > 0 };
}
