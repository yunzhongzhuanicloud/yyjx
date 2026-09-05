/* ===========================================================================
   音乐播放器 + MV 播放器
   依赖: script.js 中的 $, esc, fmtTime, hideAllPanels
   暴露全局: MusicPlayer, MVPlayer, songActionButtons, batchActionBar
   =========================================================================== */

const IC_PLAY  = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const IC_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
const IC_NEXT  = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 6l8.5 6L6 18z"/></svg>';
const IC_DEL   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
const IC_PLUS  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const IC_UP    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
const IC_DOWN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

/* ---- Toast 轻浮提示 ---- */
let _toastTimer = null;
function toast(msg, type) {
  let el = document.getElementById('_toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '_toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' toast-' + type : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = 'toast'; }, 2000);
}

/* ---- Tab 徽章 (准备播放中) ---- */
function showTabBadge(id, text) { const el = $('#' + id); if (el) { el.textContent = text; el.classList.add('show'); } }
function hideTabBadge(id) { const el = $('#' + id); if (el) el.classList.remove('show'); }

/* ---- 播放模式图标 & 弹窗 ---- */
const MODE_LABELS = ['顺序播放', '单曲循环', '随机播放'];
function setModeIcon(svg, m) {
  if (m === 0) {
    svg.innerHTML = '<polyline points="17 1 21 5 17 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 11V9a4 4 0 0 1 4-4h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="7 23 3 19 7 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 13v2a4 4 0 0 1-4 4H3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  } else if (m === 1) {
    svg.innerHTML = '<path d="M17 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 11V9a4 4 0 0 1 4-4h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 5l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 13v2a4 4 0 0 1-4 4H3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  } else {
    svg.innerHTML = '<polyline points="16 3 21 3 21 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="4" y1="20" x2="21" y2="3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 16v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="15" y1="15" x2="3" y2="3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3 8V3h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  }
}
let _modePopupTimer = null;
function showModePopup(btn, m) {
  let el = document.getElementById('_modePopup');
  if (!el) {
    el = document.createElement('div');
    el.id = '_modePopup';
    el.className = 'mode-popup';
    document.body.appendChild(el);
  }
  el.textContent = MODE_LABELS[m];
  el.className = 'mode-popup show';
  const r = btn.getBoundingClientRect();
  el.style.left = (r.left + r.width / 2) + 'px';
  el.style.top = (r.top - 8) + 'px';
  clearTimeout(_modePopupTimer);
  _modePopupTimer = setTimeout(() => { el.className = 'mode-popup'; }, 1500);
}

/* ---- 播放列表拖拽排序通用工具 ---- */
function bindDragReorder(container, onReorder) {
  let dragSrc = null;
  container.addEventListener('dragstart', e => {
    const item = e.target.closest('.pl-item');
    if (!item) return;
    dragSrc = item;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', ''); } catch (_) {}
  });
  container.addEventListener('dragend', () => {
    if (dragSrc) dragSrc.classList.remove('dragging');
    container.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
    dragSrc = null;
  });
  container.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const tgt = e.target.closest('.pl-item');
    container.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
    if (tgt && tgt !== dragSrc) tgt.classList.add('drag-over');
  });
  container.addEventListener('drop', e => {
    e.preventDefault();
    const tgt = e.target.closest('.pl-item');
    if (!dragSrc || !tgt || tgt === dragSrc) return;
    const from = +dragSrc.dataset.idx, to = +tgt.dataset.idx;
    onReorder(from, to);
  });
}

/* ---- FLIP 动画: 列表位置变换动画 ---- */
function flipReorder(container) {
  // record first positions
  const items = Array.from(container.querySelectorAll('.pl-item'));
  const firstRects = new Map();
  items.forEach(el => firstRects.set(el, el.getBoundingClientRect()));
  // return a function to call after DOM update
  return function play() {
    const lastItems = Array.from(container.querySelectorAll('.pl-item'));
    lastItems.forEach(el => {
      const first = firstRects.get(el);
      if (!first) return;
      const last = el.getBoundingClientRect();
      const dy = first.top - last.top;
      if (dy === 0) return;
      el.style.transition = 'none';
      el.style.transform = 'translateY(' + dy + 'px)';
      el.offsetHeight; // reflow
      el.style.transition = 'transform .35s cubic-bezier(.4,0,.2,1)';
      el.style.transform = '';
      // clean up after animation
      setTimeout(() => { el.style.transition = ''; el.style.transform = ''; }, 400);
    });
  };
}

/* ---- 歌曲操作按钮组（立即播放 / 加入列表 / 下一首） ---- */
function songActionButtons(song) {
  const id = song.id;
  const data = `data-id="${esc(id)}" data-name="${esc(song.n||'')}" data-ar="${esc(song.ar||'')}" data-pic="${esc(song.pu||'')}" data-dt="${esc(song.dt||'')}"`;
  return `<div class="song-acts" ${data}>
    <button class="act-play" data-act="play">${IC_PLAY}播放</button>
    <button data-act="add">${IC_PLUS}加入列表</button>
    <button data-act="next">${IC_NEXT}下一首</button>
  </div>`;
}

function bindSongActions(container) {
  (container || document).querySelectorAll('.song-acts').forEach(grp => {
    const id = grp.dataset.id;
    const song = { id, n: grp.dataset.name, ar: grp.dataset.ar, pu: grp.dataset.pic, dt: grp.dataset.dt ? parseInt(grp.dataset.dt) : 0 };
    grp.querySelectorAll('button').forEach(b => b.onclick = () => {
      const act = b.dataset.act;
      const name = song.n || song.id;
      if (act === 'play') { MusicPlayer.playNow(song); toast('正在播放：' + name); }
      else if (act === 'add') { MusicPlayer.addToList(song); toast('已加入播放列表：' + name); }
      else if (act === 'next') { MusicPlayer.playNext(song); toast('下一首将播放：' + name); }
    });
  });
}

/* ---- 批量操作栏（播放全部 / 加入全部） ---- */
function batchActionBar(songs) {
  return `<div class="batch-acts" data-songs='${esc(JSON.stringify(songs.map(s => ({id:s.id,n:s.n,ar:s.ar,pu:s.pu,dt:s.dt}))))}'>
    <button data-act="playall">${IC_PLAY}立即播放全部</button>
    <button data-act="addall">${IC_PLUS}加入播放列表</button>
  </div>`;
}

function bindBatchActions(container) {
  (container || document).querySelectorAll('.batch-acts').forEach(bar => {
    let songs = [];
    try { songs = JSON.parse(bar.dataset.songs); } catch (_) {}
    bar.querySelectorAll('button').forEach(b => b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'playall') { MusicPlayer.playAll(songs); toast('已开始播放 ' + songs.length + ' 首'); }
      else if (act === 'addall') { MusicPlayer.addAll(songs); toast('已加入 ' + songs.length + ' 首到播放列表'); }
    });
  });
}

/* ===========================================================================
   音乐播放器
   =========================================================================== */
const MusicPlayer = (() => {
  const audio = $('#mpAudio');
  const elCover = $('#mpCover'), elTitle = $('#mpTitle'), elArtist = $('#mpArtist');
  const elPlay = $('#mpPlay'), elPrev = $('#mpPrev'), elNext = $('#mpNext'), elMode = $('#mpMode');
  const elFill = $('#mpFill'), elThumb = $('#mpThumb'), elBar = $('#mpBar');
  const elCur = $('#mpCur'), elDur = $('#mpDur');
  const elQuality = $('#mpQuality'), elList = $('#mpList'), elCount = $('#mpCount'), elClear = $('#mpClear');
  const elCard = document.querySelector('.player-card');

  let list = [];          // [{id,n,ar,pu,dt}]
  let curIdx = -1;
  let mode = 0;           // 0=顺序, 1=单曲循环, 2=随机
  let resolving = false;

  const QUALITY_LABEL = { '128000':'普通128k','192000':'标准192k','320000':'高品320k','3200000':'无损FLAC' };
  const QUALITY_ORDER = ['3200000','320000','192000','128000']; // 高 → 低

  // 恢复保存的音质偏好，首次默认 128k
  try { const sq = localStorage.getItem('_mp_quality'); if (sq && QUALITY_LABEL[sq]) elQuality.value = sq; else elQuality.value = '128000'; } catch (_) {}

  function fmt(s) { s = Math.floor(s||0); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }

  function save() {
    try { localStorage.setItem('_mp_list', JSON.stringify(list)); localStorage.setItem('_mp_curIdx', String(curIdx)); localStorage.setItem('_mp_mode', String(mode)); } catch (_) {}
  }
  function restore() {
    try {
      const raw = localStorage.getItem('_mp_list');
      if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) list = a; }
      const c = parseInt(localStorage.getItem('_mp_curIdx'));
      if (!isNaN(c)) curIdx = c;
      const m = parseInt(localStorage.getItem('_mp_mode'));
      if (!isNaN(m) && m >= 0 && m < 3) { mode = m; elMode.title = MODE_LABELS[mode]; elMode.style.color = mode ? 'var(--accent)' : ''; setModeIcon(elMode.querySelector('svg'), mode); }
    } catch (_) {}
  }
  restore();

  function render() {
    elCount.textContent = list.length + ' 首';
    if (!list.length) { elList.innerHTML = '<div style="color:var(--text-3);text-align:center;padding:20px">播放列表为空</div>'; return; }
    elList.innerHTML = list.map((s, i) => {
      const playing = i === curIdx;
      const upBtn = i > 0 ? '<button class="up" title="上移">' + IC_UP + '</button>' : '';
      const downBtn = i < list.length - 1 ? '<button class="down" title="下移">' + IC_DOWN + '</button>' : '';
      return `<div class="pl-item${playing?' playing':''}" data-idx="${i}" draggable="true">
        <div class="pli-num">${playing?'▶':(i+1)}</div>
        <img src="${esc(thumbPic(s.pu||''))}" onerror="this.style.visibility='hidden'">
        <div class="pli-body"><div class="pli-title">${esc(s.n||'(未知)')}</div><div class="pli-meta">${esc(s.ar||'')}${s.dt?' · '+fmtTime(s.dt):''}</div></div>
        <div class="pli-acts">
          ${upBtn}${downBtn}<button class="del" title="删除">${IC_DEL}</button>
        </div>
      </div>`;
    }).join('');
    elList.querySelectorAll('.pl-item').forEach(item => {
      const idx = +item.dataset.idx;
      item.onclick = e => { if (e.target.closest('button')) return; playByIndex(idx); };
      const del = item.querySelector('.del');
      if (del) del.onclick = e => { e.stopPropagation(); removeAt(idx); };
      const up = item.querySelector('.up');
      if (up) up.onclick = e => { e.stopPropagation(); if (idx > 0) reorder(idx, idx - 1); };
      const down = item.querySelector('.down');
      if (down) down.onclick = e => { e.stopPropagation(); if (idx < list.length - 1) reorder(idx, idx + 1); };
    });
    save();
  }
  function reorder(from, to) {
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return;
    const moved = curIdx === from;
    const play = flipReorder(elList);
    const item = list.splice(from, 1)[0];
    list.splice(to, 0, item);
    if (moved) curIdx = to;
    else if (from < curIdx && to >= curIdx) curIdx--;
    else if (from > curIdx && to <= curIdx) curIdx++;
    render();
    play();
  }
  bindDragReorder(elList, reorder);

  function updateUI(song) {
    if (!song) { elTitle.textContent = '未播放'; elArtist.textContent = '-'; elCover.src = ''; elCard.classList.remove('playing'); return; }
    elTitle.textContent = song.n || '(未知)';
    elArtist.textContent = song.ar || '-';
    if (song.pu) elCover.src = thumbPic(song.pu);
  }

  function setPlaying(isPlay) {
    elPlay.querySelector('.ic-play').style.display = isPlay ? 'none' : '';
    elPlay.querySelector('.ic-pause').style.display = isPlay ? '' : 'none';
    if (isPlay) elCard.classList.add('playing'); else elCard.classList.remove('playing');
    const tp = $('#mpTabPlaying');
    if (tp) tp.classList.toggle('show', isPlay);
  }

  /* 静音按钮 */
  const elMute = $('#mpMute');
  let lastVol = 1;
  function updateMuteIcon() {
    const on = audio.volume > 0 && !audio.muted;
    const volOn = elMute.querySelector('.ic-vol-on');
    if (volOn) volOn.style.display = on ? '' : 'none';
  }
  elMute.onclick = () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      audio.volume = lastVol || 1;
    } else {
      lastVol = audio.volume;
      audio.muted = true;
    }
    updateMuteIcon();
  };
  audio.addEventListener('volumechange', updateMuteIcon);
  updateMuteIcon();

  /* 解析歌曲并播放 — 根据 quality 选择音质 */
  async function resolveAndPlay(song) {
    if (resolving) return;
    resolving = true;
    elTitle.textContent = (song.n || '解析中…') + ' — 解析中…';
    elCard.classList.add('loading');
    showTabBadge('mpTabBadge', '准备播放中');
    try {
      const br = elQuality.value;
      const resp = await fetch('/api/resolve', { method:'POST', headers:{'content-type':'application/json' }, body: JSON.stringify({ input: song.id }) });
      const data = await resp.json();
      if (!data.ok || !data.ds) { elTitle.textContent = song.n || '(未知)'; elArtist.textContent = '解析失败'; return; }
      // 找到可用音质
      const okDs = data.ds.filter(x => x.ok && x.d && x.d.u);
      if (!okDs.length) { elTitle.textContent = song.n || '(未知)'; elArtist.textContent = '无可用音源'; return; }
      // 更新音质下拉框 — 只显示可用音质
      const availBrs = okDs.map(x => x.br).sort((a,b) => QUALITY_ORDER.indexOf(a) - QUALITY_ORDER.indexOf(b));
      elQuality.innerHTML = availBrs.map(b => '<option value="' + b + '">' + (QUALITY_LABEL[b] || b) + '</option>').join('');
      // 尝试用用户偏好，不可用则降级到最高可用
      let chosen = okDs.find(x => x.br === br);
      if (!chosen) {
        // 降级到最低可用音质
        for (const b of [...QUALITY_ORDER].reverse()) { chosen = okDs.find(x => x.br === b); if (chosen) break; }
      }
      elQuality.value = chosen.br;
      try { localStorage.setItem('_mp_quality', chosen.br); } catch (_) {}
      const url = String(chosen.d.u).replace(/^http:\/\//i, 'https://');
      const info = data.info || {};
      updateUI({ n: info.n || song.n, ar: info.ar || song.ar, pu: info.pu || song.pu });
      audio.src = url;
      await audio.play();
      setPlaying(true);
      hideTabBadge('mpTabBadge');
      MVPlayer.pause();   // 暂停 MV
      MusicLyric.load(song.id);   // 加载歌词
    } catch (e) {
      elTitle.textContent = song.n || '(未知)';
      elArtist.textContent = '播放失败';
    } finally {
      resolving = false;
      hideTabBadge('mpTabBadge');
      elCard.classList.remove('loading');
    }
  }

  function playByIndex(idx) {
    if (idx < 0 || idx >= list.length) return;
    curIdx = idx;
    render();
    resolveAndPlay(list[idx]);
  }

  function playNow(song) {
    // 若已存在则直接播放，否则加入并播放
    const exist = list.findIndex(s => s.id === song.id);
    if (exist >= 0) { playByIndex(exist); return; }
    list.push(song);
    curIdx = list.length - 1;
    render();
    resolveAndPlay(song);
  }

  function addToList(song) {
    if (list.some(s => s.id === song.id)) return;
    list.push(song);
    render();
  }

  function addAll(songs) {
    for (const s of songs) { if (s && s.id && !list.some(x => x.id === s.id)) list.push(s); }
    render();
  }

  function playAll(songs) {
    list = songs.filter(s => s && s.id).slice();
    curIdx = -1;
    render();
    if (list.length) playByIndex(0);
  }

  function playNext(song) {
    if (curIdx < 0) { playNow(song); return; }
    if (list.some(s => s.id === song.id)) return;
    list.splice(curIdx + 1, 0, song);
    render();
  }

  function removeAt(idx) {
    list.splice(idx, 1);
    if (idx === curIdx) { curIdx = -1; audio.pause(); audio.src = ''; setPlaying(false); updateUI(null); }
    else if (idx < curIdx) curIdx--;
    render();
  }

  function next(auto) {
    if (!list.length) return;
    if (mode === 1) { playByIndex(curIdx); return; }       // 单曲循环
    if (mode === 2) {                                      // 随机播放
      if (list.length === 1) { playByIndex(0); return; }
      let r;
      do { r = Math.floor(Math.random() * list.length); } while (r === curIdx);
      playByIndex(r);
      return;
    }
    // 顺序播放
    let n = curIdx + 1;
    if (n >= list.length) {
      if (auto) { setPlaying(false); return; }   // 自动播放到末尾则停止
      n = 0;                                       // 手动点击下一首则循环
    }
    playByIndex(n);
  }

  function prev() {
    if (!list.length) return;
    let p = curIdx - 1;
    if (p < 0) p = list.length - 1;
    playByIndex(p);
  }

  function toggle() {
    if (!audio.src) { if (list.length) playByIndex(curIdx >= 0 ? curIdx : 0); return; }
    if (audio.paused) { audio.play(); setPlaying(true); MVPlayer.pause(); }
    else { audio.pause(); setPlaying(false); }
  }

  function pause() { if (!audio.paused) { audio.pause(); setPlaying(false); } }

  /* ---- 事件绑定 ---- */
  elPlay.onclick = toggle;
  elNext.onclick = next;
  elPrev.onclick = prev;
  elMode.onclick = () => {
    mode = (mode + 1) % 3;
    elMode.title = MODE_LABELS[mode];
    elMode.style.color = mode ? 'var(--accent)' : '';
    setModeIcon(elMode.querySelector('svg'), mode);
    showModePopup(elMode, mode);
  };
  elClear.onclick = () => { list = []; curIdx = -1; audio.pause(); audio.src = ''; setPlaying(false); updateUI(null); render(); };
  const elCollapse = $('#mpCollapse');
  elCollapse.onclick = () => {
    const collapsed = elList.classList.toggle('collapsed');
    elCollapse.textContent = collapsed ? '展开' : '收起';
  };
  elQuality.onchange = () => { if (curIdx >= 0) resolveAndPlay(list[curIdx]); };

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const p = audio.currentTime / audio.duration;
    elFill.style.width = (p*100)+'%';
    elThumb.style.left = (p*100)+'%';
    elCur.textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('loadedmetadata', () => { elDur.textContent = fmt(audio.duration); });
  audio.addEventListener('ended', () => { if (mode === 1) playByIndex(curIdx); else next(true); });
  audio.addEventListener('play', () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));

  // 进度条点击/拖动
  let dragging = false;
  function seek(e) {
    const rect = elBar.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audio.duration) audio.currentTime = p * audio.duration;
  }
  elBar.addEventListener('mousedown', e => { dragging = true; seek(e); });
  window.addEventListener('mousemove', e => { if (dragging) seek(e); });
  window.addEventListener('mouseup', () => { dragging = false; });

  render();
  return { playNow, addToList, addAll, playAll, playNext, pause, list: () => list };
})();

/* ===========================================================================
   MV 播放器
   =========================================================================== */
const MVPlayer = (() => {
  const video = $('#vpVideo');
  const elOverlay = $('#vpOverlay');
  const elTitle = $('#vpTitle'), elArtist = $('#vpArtist');
  const elQuality = $('#vpQuality');
  const elList = $('#vpList'), elCount = $('#vpCount'), elClear = $('#vpClear');
  const elPlay = $('#vpPlay'), elPrev = $('#vpPrev'), elNext = $('#vpNext'), elMode = $('#vpMode');
  const elCard = document.querySelector('.vplayer-card');

  let list = [];          // [{id,n,ar,cover,duration,brs:{br:url}}]
  let curIdx = -1;
  let currentBrs = {};    // 当前播放 MV 的各画质 url
  let currentMv = null;
  let mode = 0;           // 0=顺序, 1=单曲循环, 2=随机

  function fmt(s) { s = Math.floor(s||0); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }

  function setPlaying(p) {
    const icP = elPlay.querySelector('.ic-play'), icPa = elPlay.querySelector('.ic-pause');
    if (icP) icP.style.display = p ? 'none' : '';
    if (icPa) icPa.style.display = p ? '' : 'none';
    const tp = $('#vpTabPlaying');
    if (tp) tp.classList.toggle('show', p);
  }

  /* 静音按钮 */
  const elMute = $('#vpMute');
  let lastVol = 1;
  function updateMuteIcon() {
    const on = video.volume > 0 && !video.muted;
    const volOn = elMute.querySelector('.ic-vol-on');
    if (volOn) volOn.style.display = on ? '' : 'none';
  }
  elMute.onclick = () => {
    if (video.muted || video.volume === 0) {
      video.muted = false;
      video.volume = lastVol || 1;
    } else {
      lastVol = video.volume;
      video.muted = true;
    }
    updateMuteIcon();
  };
  video.addEventListener('volumechange', updateMuteIcon);
  updateMuteIcon();

  function save() {
    try { localStorage.setItem('_vp_list', JSON.stringify(list)); localStorage.setItem('_vp_curIdx', String(curIdx)); localStorage.setItem('_vp_mode', String(mode)); } catch (_) {}
  }
  function restore() {
    try {
      const raw = localStorage.getItem('_vp_list');
      if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) list = a; }
      const c = parseInt(localStorage.getItem('_vp_curIdx'));
      if (!isNaN(c)) curIdx = c;
      const m = parseInt(localStorage.getItem('_vp_mode'));
      if (!isNaN(m) && m >= 0 && m < 3) { mode = m; elMode.title = MODE_LABELS[mode]; elMode.style.color = mode ? 'var(--accent)' : ''; setModeIcon(elMode.querySelector('svg'), mode); }
    } catch (_) {}
  }
  restore();

  function render() {
    elCount.textContent = list.length + ' 个';
    if (!list.length) { elList.innerHTML = '<div style="color:var(--text-3);text-align:center;padding:20px">MV 播放列表为空</div>'; return; }
    elList.innerHTML = list.map((m, i) => {
      const playing = i === curIdx;
      const upBtn = i > 0 ? '<button class="up" title="上移">' + IC_UP + '</button>' : '';
      const downBtn = i < list.length - 1 ? '<button class="down" title="下移">' + IC_DOWN + '</button>' : '';
      return `<div class="pl-item${playing?' playing':''}" data-idx="${i}" draggable="true">
        <div class="pli-num">${playing?'▶':(i+1)}</div>
        <img src="${esc(thumbPic(m.cover||''))}" onerror="this.style.visibility='hidden'">
        <div class="pli-body"><div class="pli-title">${esc(m.n||'(未知)')}</div><div class="pli-meta">${esc(m.ar||'')}${m.duration?' · '+fmt(m.duration/1000):''}</div></div>
        <div class="pli-acts">${upBtn}${downBtn}<button class="del" title="删除">${IC_DEL}</button></div>
      </div>`;
    }).join('');
    elList.querySelectorAll('.pl-item').forEach(item => {
      const idx = +item.dataset.idx;
      item.onclick = e => { if (e.target.closest('button')) return; playByIndex(idx); };
      const del = item.querySelector('.del');
      if (del) del.onclick = e => { e.stopPropagation(); removeAt(idx); };
      const up = item.querySelector('.up');
      if (up) up.onclick = e => { e.stopPropagation(); if (idx > 0) reorder(idx, idx - 1); };
      const down = item.querySelector('.down');
      if (down) down.onclick = e => { e.stopPropagation(); if (idx < list.length - 1) reorder(idx, idx + 1); };
    });
    save();
  }

  // 拖拽排序
  function reorder(from, to) {
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return;
    const moved = curIdx === from;
    const play = flipReorder(elList);
    const item = list.splice(from, 1)[0];
    list.splice(to, 0, item);
    if (moved) curIdx = to;
    else if (from < curIdx && to >= curIdx) curIdx--;
    else if (from > curIdx && to <= curIdx) curIdx++;
    render();
    play();
  }
  bindDragReorder(elList, reorder);

  const MV_QUALITY_LABEL = { '240':'流畅240P','480':'流畅480P','720':'清晰720P','1080':'高清1080P' };

  function updateQualitySelect(brs) {
    const keys = Object.keys(brs||{}).sort((a,b) => parseInt(b)-parseInt(a));
    if (!keys.length) { elQuality.innerHTML = ''; return; }
    elQuality.innerHTML = keys.map(k => '<option value="' + k + '">' + (MV_QUALITY_LABEL[k] || k + 'P') + '</option>').join('');
    // 恢复用户偏好，不可用则选最低画质
    let pref = null;
    try { pref = localStorage.getItem('_vp_quality'); } catch (_) {}
    if (pref && keys.includes(pref)) elQuality.value = pref;
    else elQuality.value = keys[keys.length - 1];
  }

  function playByIndex(idx) {
    if (idx < 0 || idx >= list.length) return;
    curIdx = idx;
    const m = list[idx];
    currentMv = m;
    render();
    // 每次都重新解析，防止 URL 失效
    resolveMv(m);
  }

  function next(auto) {
    if (!list.length) return;
    if (mode === 1) { playByIndex(curIdx); return; }
    if (mode === 2) {
      if (list.length === 1) { playByIndex(0); return; }
      let r;
      do { r = Math.floor(Math.random() * list.length); } while (r === curIdx);
      playByIndex(r);
      return;
    }
    let n = curIdx + 1;
    if (n >= list.length) {
      if (auto) { video.pause(); setPlaying(false); return; }
      n = 0;
    }
    playByIndex(n);
  }

  function prev() {
    if (!list.length) return;
    let p = curIdx - 1;
    if (p < 0) p = list.length - 1;
    playByIndex(p);
  }

  function toggle() {
    if (!video.src) { if (list.length) playByIndex(curIdx >= 0 ? curIdx : 0); return; }
    if (video.paused) { video.play(); setPlaying(true); MusicPlayer.pause(); }
    else { video.pause(); setPlaying(false); }
  }

  async function resolveMv(m) {
    elTitle.textContent = (m.n || '') + ' — 解析中…';
    elCard.classList.add('loading');
    showTabBadge('vpTabBadge', 'MV准备播放中');
    try {
      const resp = await fetch('/api/mv', { method:'POST', headers:{'content-type':'application/json' }, body: JSON.stringify({ id: m.id }) });
      const data = await resp.json();
      if (!data.ok || !data.brs) { elTitle.textContent = m.n || '(未知)'; elArtist.textContent = '解析失败'; hideTabBadge('vpTabBadge'); elCard.classList.remove('loading'); return; }
      m.brs = data.brs;
      const mv = data.mv || {};
      m.n = mv.n || m.n; m.ar = mv.ar || m.ar; m.cover = mv.cover || m.cover; m.duration = mv.duration || m.duration; m.songId = mv.songId || m.songId;
      doPlay(m, data.brs);
    } catch (e) {
      elTitle.textContent = m.n || '(未知)';
      elArtist.textContent = '解析失败';
    } finally {
      hideTabBadge('vpTabBadge');
      elCard.classList.remove('loading');
    }
  }

  function doPlay(m, brs) {
    currentBrs = brs;
    updateQualitySelect(brs);
    const keys = Object.keys(brs).sort((a,b) => parseInt(b)-parseInt(a));
    const best = elQuality.value || keys[0];
    const url = String(brs[best] || brs[keys[0]]).replace(/^http:\/\//i, 'https://');
    elTitle.textContent = m.n || '(未知)';
    elArtist.textContent = m.ar || '-';
    video.src = url;
    elOverlay.classList.add('hide');
    video.play();
    setPlaying(true);
    MusicPlayer.pause();   // 暂停音乐
    // 加载歌词：若有 songId 直接用，否则按歌名+歌手搜索获取 songId
    if (m.songId) {
      MVLyric.load(m.songId);
    } else if (m.n) {
      (async () => {
        try {
          const kw = m.ar ? (m.n + ' ' + m.ar) : m.n;
          const resp = await fetch('/api/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keyword: kw, type: 1, limit: 5 }) });
          const data = await resp.json();
          const songs = data.list || [];
          if (songs.length) { MVLyric.load(songs[0].id); }
          else { MVLyric.load(null); }
        } catch (_) { MVLyric.load(null); }
      })();
    } else {
      MVLyric.load(null);
    }
    render();
  }

  function playNow(mv) {
    const exist = list.findIndex(x => x.id === mv.id);
    if (exist >= 0) { playByIndex(exist); return; }
    list.push(mv);
    curIdx = list.length - 1;
    render();
    playByIndex(curIdx);
  }

  function addToList(mv) {
    if (list.some(x => x.id === mv.id)) return;
    list.push(mv);
    render();
  }

  function playNext(mv) {
    // 插队到当前播放的下一个位置
    if (list.some(x => x.id === mv.id)) return;
    const insertAt = curIdx >= 0 ? curIdx + 1 : list.length;
    list.splice(insertAt, 0, mv);
    if (curIdx < 0) curIdx = 0;
    render();
  }

  function removeAt(idx) {
    list.splice(idx, 1);
    if (idx === curIdx) { curIdx = -1; video.pause(); video.src = ''; elOverlay.classList.remove('hide'); elTitle.textContent = '未播放'; elArtist.textContent = '-'; elQuality.innerHTML = ''; }
    else if (idx < curIdx) curIdx--;
    render();
  }

  function pause() { if (!video.paused) video.pause(); }

  /* ---- 事件绑定 ---- */
  elPlay.onclick = toggle;
  elNext.onclick = () => next(false);
  elPrev.onclick = prev;
  elMode.onclick = () => {
    mode = (mode + 1) % 3;
    elMode.title = MODE_LABELS[mode];
    elMode.style.color = mode ? 'var(--accent)' : '';
    setModeIcon(elMode.querySelector('svg'), mode);
    showModePopup(elMode, mode);
  };
  elClear.onclick = () => { list = []; curIdx = -1; video.pause(); video.src = ''; elOverlay.classList.remove('hide'); elTitle.textContent = '未播放'; elArtist.textContent = '-'; elQuality.innerHTML = ''; setPlaying(false); render(); };
  const elCollapse = $('#vpCollapse');
  elCollapse.onclick = () => {
    const collapsed = elList.classList.toggle('collapsed');
    elCollapse.textContent = collapsed ? '展开' : '收起';
  };
  elQuality.onchange = () => {
    if (!currentBrs || !elQuality.value) return;
    try { localStorage.setItem('_vp_quality', elQuality.value); } catch (_) {}
    const url = String(currentBrs[elQuality.value]).replace(/^http:\/\//i, 'https://');
    const t = video.currentTime;
    const wasPlaying = !video.paused;
    video.src = url;
    video.addEventListener('loadedmetadata', () => { video.currentTime = t; if (wasPlaying) video.play(); }, { once: true });
  };

  video.addEventListener('play', () => { elOverlay.classList.add('hide'); setPlaying(true); MusicPlayer.pause(); });
  video.addEventListener('pause', () => { setPlaying(false); });
  video.addEventListener('ended', () => { if (mode === 1) playByIndex(curIdx); else next(true); });

  render();
  return { playNow, addToList, playNext, pause, list: () => list };
})();

/* ---- MV 操作按钮组（用于搜索结果/MV解析面板） ---- */
function mvActionButtons(mv) {
  return `<div class="song-acts" data-mvid="${esc(mv.id)}" data-name="${esc(mv.n||'')}" data-ar="${esc(mv.ar||'')}" data-cover="${esc(mv.pu||'')}" data-dt="${esc(mv.dt||'')}">
    <button class="act-play" data-act="play">${IC_PLAY}播放</button>
    <button data-act="add">${IC_PLUS}加入列表</button>
    <button data-act="next">${IC_NEXT}下一首</button>
  </div>`;
}

function bindMvActions(container) {
  (container || document).querySelectorAll('.song-acts[data-mvid]').forEach(grp => {
    const mv = { id: grp.dataset.mvid, n: grp.dataset.name, ar: grp.dataset.ar, cover: grp.dataset.cover, duration: grp.dataset.dt ? parseInt(grp.dataset.dt) : 0 };
    grp.querySelectorAll('button').forEach(b => b.onclick = () => {
      const act = b.dataset.act;
      const name = mv.n || mv.id;
      if (act === 'play') { MVPlayer.playNow(mv); toast('正在播放 MV：' + name); }
      else if (act === 'add') { MVPlayer.addToList(mv); toast('已加入 MV 列表：' + name); }
      else if (act === 'next') { MVPlayer.playNext(mv); toast('下一首将播放 MV：' + name); }
    });
  });
}

/* ---- 右侧悬浮工具按钮 ---- */
(function () {
  const ftTop = $('#ftTop'), ftBottom = $('#ftBottom'), ftPlay = $('#ftPlay');
  ftTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  ftBottom.onclick = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  function updatePlayIcon() {
    const audio = $('#mpAudio'), video = $('#vpVideo');
    const playing = (!audio.paused && audio.src) || (!video.paused && video.src);
    const icP = ftPlay.querySelector('.ic-play'), icPa = ftPlay.querySelector('.ic-pause');
    if (icP) icP.style.display = playing ? 'none' : '';
    if (icPa) icPa.style.display = playing ? '' : 'none';
  }
  let lastMedia = 'mp';   // 'mp' or 'vp' — which was played last
  $('#mpAudio').addEventListener('play', () => { lastMedia = 'mp'; updatePlayIcon(); });
  $('#vpVideo').addEventListener('play', () => { lastMedia = 'vp'; updatePlayIcon(); });
  ftPlay.onclick = () => {
    const audio = $('#mpAudio'), video = $('#vpVideo');
    // if something is currently playing, pause it
    if (audio.src && !audio.paused) { audio.pause(); return; }
    if (video.src && !video.paused) { video.pause(); return; }
    // resume whichever was last played (or has src)
    if (lastMedia === 'vp' && video.src) { video.play(); return; }
    if (lastMedia === 'mp' && audio.src) { audio.play(); return; }
    // fallback: whichever has src
    if (audio.src) { audio.play(); return; }
    if (video.src) { video.play(); return; }
    // nothing loaded — start last-played type's playlist
    if (lastMedia === 'vp' && MVPlayer.list().length) { document.getElementById('vpPlay').click(); }
    else if (MusicPlayer.list().length) { document.getElementById('mpPlay').click(); }
    else if (MVPlayer.list().length) { document.getElementById('vpPlay').click(); }
  };
  $('#mpAudio').addEventListener('pause', updatePlayIcon);
  $('#vpVideo').addEventListener('pause', updatePlayIcon);
})();

/* ---- 歌词控制器（音乐 & MV 共用） ---- */
function createLyricController(prefix, mediaEl) {
  const elCard = $('#' + prefix + 'LyricCard');
  const elBody = $('#' + prefix + 'LyricBody');
  const elLines = $('#' + prefix + 'LyricLines');
  const elMinus = $('#' + prefix + 'LyricMinus');
  const elPlus = $('#' + prefix + 'LyricPlus');
  const elToggle = $('#' + prefix + 'LyricToggle');
  const elFontMinus = $('#' + prefix + 'LyricFontMinus');
  const elFontPlus = $('#' + prefix + 'LyricFontPlus');

  let lines = [];      // [{t: seconds, text: string}]
  let curLine = -1;
  let maxLines = 6;
  let visible = true;
  let songId = null;
  let fullscreen = false;
  let fontSize = 36;   // px, current line font size

  // fullscreen overlay element
  const elFs = document.createElement('div');
  elFs.className = 'lyric-fs';
  elFs.innerHTML = '<div class="lyric-fs-close" title="退出全屏">✕</div><div class="lyric-fs-body"></div>';
  document.body.appendChild(elFs);
  const elFsBody = elFs.querySelector('.lyric-fs-body');
  elFs.querySelector('.lyric-fs-close').onclick = () => {
    fullscreen = false;
    elFs.classList.remove('show');
    document.body.style.overflow = '';
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  // restore settings
  try {
    const s = parseInt(localStorage.getItem(prefix + '_lyric_lines'));
    if (!isNaN(s) && s >= 4 && s <= 20 && s % 2 === 0) { maxLines = s; elLines.textContent = s; }
    const v = localStorage.getItem(prefix + '_lyric_visible');
    if (v === '0') { visible = false; elBody.classList.add('hide'); elToggle.textContent = '显示歌词'; }
    const f = parseInt(localStorage.getItem(prefix + '_lyric_font'));
    if (!isNaN(f) && f >= 20 && f <= 50) fontSize = f;
  } catch (_) {}

  function parseLrc(lrcStr) {
    if (!lrcStr) return [];
    const result = [];
    const re = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
    lrcStr.split('\n').forEach(line => {
      const matches = [];
      let m;
      while ((m = re.exec(line)) !== null) {
        matches.push(parseInt(m[1]) * 60 + parseFloat(m[2]));
      }
      const text = line.replace(re, '').trim();
      if (matches.length && text) {
        matches.forEach(t => result.push({ t, text }));
      }
    });
    result.sort((a, b) => a.t - b.t);
    return result;
  }

  async function load(id) {
    songId = id;
    lines = [];
    curLine = -1;
    clearContainer(elBody);
    clearContainer(elFsBody);
    if (!id) return;
    try {
      const resp = await fetch('/api/lyric', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await resp.json();
      if (!data.ok || !data.lrc) { lines = []; showEmpty(); return; }
      lines = parseLrc(data.lrc);
      buildAllLines(elBody);
      buildAllLines(elFsBody);
      render(false);
    } catch (_) { lines = []; showEmpty(); }
  }

  function clearContainer(body) {
    body.innerHTML = '';
    const scroll = document.createElement('div');
    scroll.className = 'lyric-scroll';
    body.appendChild(scroll);
  }

  function showEmpty() {
    if (visible) { elBody.innerHTML = '<div class="lyric-empty">暂无歌词</div>'; }
    if (fullscreen) { elFsBody.innerHTML = '<div class="lyric-empty">暂无歌词</div>'; }
  }

  /* Build ALL lyric lines once into the scroll container. Persistent DOM. */
  function buildAllLines(body) {
    const scroll = body.querySelector('.lyric-scroll');
    if (!scroll) { clearContainer(body); }
    const sc = body.querySelector('.lyric-scroll');
    sc.innerHTML = '';
    const frag = document.createDocumentFragment();
    lines.forEach((l, i) => {
      const div = document.createElement('div');
      div.className = 'lyric-line l-other';
      div.dataset.idx = i;
      div.textContent = l.text;
      div.style.fontSize = Math.round(fontSize * 0.85) + 'px';
      frag.appendChild(div);
    });
    sc.appendChild(frag);
  }

  function findCurLine(time) {
    if (!lines.length) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].t <= time) idx = i; else break;
    }
    return idx;
  }

  function update(time) {
    if (!lines.length) return;
    const idx = findCurLine(time);
    if (idx !== curLine) { curLine = idx; render(false); }
  }

  /* Update classes on persistent nodes + animate scroll position.
     No text content is ever changed after initial build — only classes,
     so CSS transitions handle color/font-size smoothly. */
  function render(reset) {
    if (!lines.length) { showEmpty(); return; }
    if (visible) updateView(elBody, reset);
    if (fullscreen) updateView(elFsBody, reset);
  }

  function updateView(body, reset) {
    const scroll = body.querySelector('.lyric-scroll');
    if (!scroll) return;
    const els = scroll.querySelectorAll('.lyric-line');

    // Set body height to show maxLines lines (based on current font size)
    const lineH = fontSize * 1.6 + 8; // approx line height with padding
    const isFs = body === elFsBody;
    const visibleCount = isFs ? 7 : maxLines;
    body.style.height = (lineH * visibleCount) + 'px';

    // Update classes in place — CSS transitions animate color/font-size
    els.forEach(el => {
      const i = +el.dataset.idx;
      let cls = 'lyric-line';
      const diff = i - curLine;
      if (diff === 0) cls += ' l-cur';
      else if (diff === -1) cls += ' l-prev1';
      else if (diff === -2) cls += ' l-prev2';
      else if (diff === 1) cls += ' l-next1';
      else if (diff === 2) cls += ' l-next2';
      else cls += ' l-other';
      el.className = cls;
      // font-size: current line full size, others 85%
      const fs = diff === 0 ? fontSize : Math.round(fontSize * 0.85);
      el.style.fontSize = fs + 'px';
    });

    // Position scroll so current line is centered in the body viewport
    if (curLine < 0 || curLine >= els.length) return;
    const curEl = els[curLine];
    const curRect = curEl.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    // offset needed: move scroll so curEl center aligns with body center
    const curCenter = curRect.top + curRect.height / 2;
    const bodyCenter = bodyRect.top + bodyRect.height / 2;
    // current transform of scroll
    const currentTransform = scroll.style.transform;
    const currentY = currentTransform ? parseFloat(currentTransform.replace(/[^-\d.]/g, '')) || 0 : 0;
    // delta to apply
    const delta = bodyCenter - curCenter;
    const newY = currentY + delta;

    if (reset) {
      scroll.style.transition = 'none';
    } else {
      scroll.style.transition = 'transform .5s cubic-bezier(.4,0,.2,1)';
    }
    scroll.style.transform = 'translateY(' + newY + 'px)';
  }

  elMinus.onclick = () => { if (maxLines > 4) { maxLines -= 2; elLines.textContent = maxLines; localStorage.setItem(prefix + '_lyric_lines', String(maxLines)); render(true); } };
  elPlus.onclick = () => { if (maxLines < 20) { maxLines += 2; elLines.textContent = maxLines; localStorage.setItem(prefix + '_lyric_lines', String(maxLines)); render(true); } };
  elFontMinus.onclick = () => { if (fontSize > 20) { fontSize -= 2; localStorage.setItem(prefix + '_lyric_font', String(fontSize)); render(true); } };
  elFontPlus.onclick = () => { if (fontSize < 50) { fontSize += 2; localStorage.setItem(prefix + '_lyric_font', String(fontSize)); render(true); } };
  const elCopy = $('#' + prefix + 'LyricCopy');
  if (elCopy) elCopy.onclick = () => {
    if (!lines.length) { toast('暂无歌词', 'warn'); return; }
    const text = lines.map(l => l.text).join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast('歌词已复制', 'ok')).catch(() => fallbackCopy(text));
    } else { fallbackCopy(text); }
  };
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('歌词已复制', 'ok'); } catch (_) { toast('复制失败', 'warn'); }
    ta.remove();
  }
  elToggle.onclick = () => {
    visible = !visible;
    elBody.classList.toggle('hide', !visible);
    elToggle.textContent = visible ? '关闭歌词' : '显示歌词';
    localStorage.setItem(prefix + '_lyric_visible', visible ? '1' : '0');
    if (visible) render(true);
  };

  // fullscreen button
  const elFsBtn = document.createElement('button');
  elFsBtn.className = 'lyric-fs-btn';
  elFsBtn.title = '全屏歌词';
  elFsBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  elFsBtn.onclick = () => {
    fullscreen = true;
    elFs.classList.add('show');
    document.body.style.overflow = 'hidden';
    if (elFs.requestFullscreen) elFs.requestFullscreen().catch(() => {});
    else if (elFs.webkitRequestFullscreen) elFs.webkitRequestFullscreen();
    render(true);
  };
  elCard.querySelector('.lyric-ctrl').appendChild(elFsBtn);

  mediaEl.addEventListener('timeupdate', () => update(mediaEl.currentTime + 0.4));

  /* ---- 鼠标拖动歌词面板改变歌曲进度 ---- */
  function bindDragSeek(body) {
    let dragging = false;
    let startY = 0;
    let startTransformY = 0;
    let moved = false;

    body.addEventListener('mousedown', e => {
      const scroll = body.querySelector('.lyric-scroll');
      if (!scroll || !lines.length) return;
      // don't hijack clicks on buttons/controls
      if (e.target.closest('button')) return;
      dragging = true;
      moved = false;
      startY = e.clientY;
      const t = scroll.style.transform;
      startTransformY = t ? parseFloat(t.replace(/[^-\d.]/g, '')) || 0 : 0;
      scroll.style.transition = 'none';
      body.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const scroll = body.querySelector('.lyric-scroll');
      if (!scroll) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 3) moved = true;
      scroll.style.transform = 'translateY(' + (startTransformY + dy) + 'px)';
    });

    document.addEventListener('mouseup', e => {
      if (!dragging) return;
      dragging = false;
      body.style.cursor = '';
      const scroll = body.querySelector('.lyric-scroll');
      if (!scroll) return;

      if (!moved) {
        // treat as click — re-sync to current line
        render(false);
        return;
      }

      // Find which lyric line is closest to body center
      const bodyRect = body.getBoundingClientRect();
      const bodyCenter = bodyRect.top + bodyRect.height / 2;
      const els = scroll.querySelectorAll('.lyric-line');
      let bestIdx = -1, bestDist = Infinity;
      els.forEach(el => {
        const r = el.getBoundingClientRect();
        const c = r.top + r.height / 2;
        const d = Math.abs(c - bodyCenter);
        if (d < bestDist) { bestDist = d; bestIdx = +el.dataset.idx; }
      });

      // Seek media to that line's time
      if (bestIdx >= 0 && bestIdx < lines.length && mediaEl.duration) {
        const t = lines[bestIdx].t;
        mediaEl.currentTime = Math.max(0, Math.min(mediaEl.duration, t));
      }
      // re-render to snap to the new current line
      curLine = -1; // force update
      render(false);
    });

    // grab cursor hint
    body.addEventListener('mouseenter', () => {
      if (lines.length) body.style.cursor = 'grab';
    });
    body.addEventListener('mouseleave', () => {
      if (!dragging) body.style.cursor = '';
    });
  }

  bindDragSeek(elBody);
  bindDragSeek(elFsBody);

  return { load, update };
}

const MusicLyric = createLyricController('mp', $('#mpAudio'));
const MVLyric = createLyricController('vp', $('#vpVideo'));
