/* 网易云音乐解析 — 前端脚本 */

const $ = s => document.querySelector(s);
const ALL_PANELS = ['panel-resolve','panel-search','panel-mv','panel-artist','panel-album','panel-playlist','panel-mplayer','panel-vplayer'];
const hideAllPanels = () => ALL_PANELS.forEach(id => { const el = $('#' + id); if (el) el.classList.add('hidden'); });

/* 主题切换 */
$('#themeToggle').onclick = () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
};

const fmtSize = b => { if (!b && b !== 0) return '-'; const u = ['B','KB','MB','GB']; let i = 0, v = b; while (v >= 1024 && i < 3) { v /= 1024; i++; } return v.toFixed(v < 10 && i ? 2 : 1) + ' ' + u[i]; };
const fmtTime = ms => { if (!ms) return '-'; const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* 封面缩略图：给图片 URL 加 param=130y130 限制尺寸省流 */
const thumbPic = url => {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('param=')) return url;
  return url + (url.includes('?') ? '&' : '?') + 'param=130y130';
};

/* 前端智能提取歌曲 ID */
function extractSongId(input) {
  const t = input.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return t;
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    const qId = u.searchParams.get('id');
    if (qId && /^\d+$/.test(qId)) return qId;
    const frag = u.hash;
    if (frag) {
      const fragQ = frag.split('?')[1];
      if (fragQ) {
        const fId = new URLSearchParams(fragQ).get('id');
        if (fId && /^\d+$/.test(fId)) return fId;
      }
    }
    const segs = u.pathname.split('/').filter(Boolean);
    for (let i = 0; i < segs.length; i++) {
      if (segs[i] === 'song' && i + 1 < segs.length && /^\d+$/.test(segs[i + 1])) return segs[i + 1];
    }
  } catch (_) {}
  return null;
}

/* Tab 切换 — 只切换主面板（resolve/search/mv），不影响详情面板 */
document.querySelectorAll('.tab').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const m = t.dataset.mode;
    // 切换 tab 时隐藏所有其他面板
    hideAllPanels();
    $('#panel-' + m).classList.remove('hidden');
    if (m === 'search' && searchState.view === 'waterfall') requestAnimationFrame(layoutMasonry);
  };
});

/* ---- 解析 ---- */
const form = $('#form'), btn = $('#btn'), result = $('#result'), errbox = $('#errbox'), songBox = $('#songBox'), reloadHint = $('#reloadHint');

form.onsubmit = async e => {
  e.preventDefault();
  const rawInput = $('#song_id').value.trim();
  if (!rawInput) return;
  // 前端智能提取 ID，提取到则直接发 ID，否则发原始 URL 让服务端处理重定向
  const preId = extractSongId(rawInput);
  const input = preId || rawInput;
  // 若已有解析结果，提示用户正在更新到新内容
  const hasPrev = songBox.innerHTML.trim().length > 0;
  if (hasPrev) {
    reloadHint.style.display = '';
    reloadHint.innerHTML = '<span class="spinner"></span><span><div class="rh-text">正在解析新歌曲，即将更新结果…</div><div class="rh-sub">当前显示的是上一次解析内容，请稍候</div></span>';
  }
  btn.disabled = true;
  const orig = btn.textContent;
  btn.innerHTML = '<span class="spinner"></span> 解析中…';
  errbox.style.display = 'none';
  result.classList.add('show');
  try {
    const resp = await fetch('/api/resolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input }) });
    const data = await resp.json();
    reloadHint.style.display = 'none';
    if (!data.ok) { errbox.style.display = ''; errbox.textContent = '解析失败，请检查链接或 ID 是否正确后重试。'; songBox.innerHTML = ''; return; }
    const sid = data.sid, info = data.info || {}, ds = data.ds || [];
    const name = info.n || '(未知)', ar = info.ar || '未知艺人', al = info.al || '', pic = info.pu || '', dt = info.dt;
    // 头部信息
    let h = `<div class="song"><img src="${esc(thumbPic(pic))}" onerror="this.style.visibility='hidden'"><div class="meta"><div class="title">${esc(name)}</div><div class="artist">${esc(ar)}${al ? ' · ' + esc(al) : ''}${dt ? ' · ' + fmtTime(dt) : ''}</div></div></div>`;
    // 播放按钮（不再显示下载地址）
    const okDs = ds.filter(x => x.ok && x.d && x.d.u);
    if (okDs.length) {
      h += `<div class="dl-section">${songActionButtons({ id: sid, n: name, ar, pu: pic, dt })}</div>`;
    } else {
      h += '<div class="alert">未获取到可用音源。</div>';
    }
    // 详细信息
    const firstD = (okDs[0] && okDs[0].d) || {};
    const rows = [[ '歌曲 ID', sid],['歌曲名', info.n],['艺人', ar],['专辑', al],['时长', dt ? fmtTime(dt) : null],['音质数', ds.length + ' 种'],['可用音质', okDs.length + ' 种'],['类型', firstD.t],['MV ID', info.mv || null]];
    h += '<div class="detail-section-title">详细信息</div>';
    h += '<div class="detail">';
    for (const [k, v] of rows) if (v != null && v !== '') h += `<div class="detail-row"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
    h += '</div>';
    // MV 解析按钮
    if (info.mv && info.mv !== 0) {
      h += `<div class="dl-section"><button class="dl-link mv-resolve-btn" data-mvid="${esc(info.mv)}" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>解析 MV 视频</button></div>`;
    }
    songBox.innerHTML = h;
    // 绑定播放按钮
    bindSongActions(songBox);
    // 绑定 MV 解析按钮
    const mvBtn2 = songBox.querySelector('.mv-resolve-btn');
    if (mvBtn2) mvBtn2.onclick = () => goToMvResolve(mvBtn2.dataset.mvid);
  } catch { errbox.style.display = ''; errbox.textContent = '请求失败，请稍后重试。'; songBox.innerHTML = ''; reloadHint.style.display = 'none'; }
  finally { btn.disabled = false; btn.textContent = orig; }
};

/* ---- 搜索 ---- */
const sForm = $('#searchForm'), sBtn = $('#searchBtn'), sResult = $('#searchResult'), sErr = $('#searchErrbox'), sSum = $('#searchSummary'), sList = $('#searchList'), pTop = $('#pagerTop'), pBot = $('#pagerBottom'), sReloadHint = $('#searchReloadHint');
const searchState = { kw: '', type: '1', limit: 30, offset: 0, count: 0, view: 'waterfall' };
const totalPages = () => Math.max(1, Math.ceil(searchState.count / searchState.limit));
const curPage = () => Math.floor(searchState.offset / searchState.limit) + 1;

function renderPager() {
  const total = totalPages(), cur = curPage();
  const build = id => {
    let p = [`<button data-p="${cur - 1}" ${cur <= 1 ? 'disabled' : ''}>‹</button>`];
    const ps = new Set([1, total, cur, cur - 1, cur + 1, cur - 2, cur + 2]);
    const sorted = [...ps].filter(x => x >= 1 && x <= total).sort((a, b) => a - b);
    let prev = 0;
    for (const x of sorted) { if (x - prev > 1) p.push('<span class="ellipsis">…</span>'); p.push(`<button data-p="${x}" class="${x === cur ? 'active' : ''}">${x}</button>`); prev = x; }
    p.push(`<button data-p="${cur + 1}" ${cur >= total ? 'disabled' : ''}>›</button>`);
    const opts = []; for (let i = 1; i <= total; i++) opts.push(`<option value="${i}" ${i === cur ? 'selected' : ''}>第 ${i} 页</option>`);
    p.push(`<span class="jump"><select id="${id}">${opts.join('')}</select></span>`);
    return p.join('');
  };
  pTop.innerHTML = build('jt'); pBot.innerHTML = build('jb');
  const bind = c => {
    c.querySelectorAll('button[data-p]').forEach(b => b.onclick = () => { const p = +b.dataset.p; if (p >= 1 && p <= total && p !== cur) { searchState.offset = (p - 1) * searchState.limit; doSearch(); } });
    const s = c.querySelector('select'); if (s) s.onchange = () => { const v = +s.value; if (v >= 1 && v <= total && v !== cur) { searchState.offset = (v - 1) * searchState.limit; doSearch(); } };
  };
  bind(pTop); bind(pBot);
}

function renderItem(song, i) {
  const id = song.id, name = song.n || '(未知)', ar = song.ar || '未知', al = song.al || '', pic = song.pu || '', dt = song.dt ? fmtTime(song.dt) : '', pop = song.pop != null ? song.pop.toFixed(0) : '';
  const tags = [];
  if (song.h) tags.push('<span class="pill">320k</span>');
  if (song.m) tags.push('<span class="pill">192k</span>');
  if (song.l) tags.push('<span class="pill">128k</span>');
  if (song.sq) tags.push('<span class="pill warn">SQ</span>');
  if (song.hr) tags.push('<span class="pill warn">Hi-Res</span>');
  if (song.fee === 1) tags.push('<span class="pill err">VIP</span>');
  const seq = searchState.offset + i + 1;
  return `<div class="s-item" data-id="${esc(id)}"><img src="${esc(thumbPic(pic))}" onerror="this.style.visibility='hidden'"><div class="si-body"><div class="si-title">${seq}. ${esc(name)}</div><div class="si-meta">${esc(ar)}${al ? ' · ' + esc(al) : ''}${dt ? ' · ' + dt : ''}${pop ? ' · 热度 ' + esc(pop) : ''}</div><div class="si-tags">${tags.join('')}</div></div><div class="si-actions">${songActionButtons({ id, n: name, ar, pu: pic, dt: song.dt })}</div></div>`;
}

function renderArtist(a, i) {
  const id = a.id, name = a.n || '(未知)', pic = a.pu || '', alias = a.alias || '';
  const albumSize = a.albumSize != null ? a.albumSize + ' 专辑' : '', musicSize = a.musicSize != null ? a.musicSize + ' 单曲' : '', mvSize = a.mvSize != null ? a.mvSize + ' MV' : '';
  const seq = searchState.offset + i + 1;
  return `<div class="s-item" data-id="${esc(id)}"><img src="${esc(thumbPic(pic))}" onerror="this.style.visibility='hidden'"><div class="si-body"><div class="si-title">${seq}. ${esc(name)}</div><div class="si-meta">${esc(alias)}${alias ? ' · ' : ''}${esc(musicSize)}${albumSize ? ' · ' + esc(albumSize) : ''}${mvSize ? ' · ' + esc(mvSize) : ''}</div></div><div class="si-actions"><button class="pm" data-act="artist" data-id="${esc(id)}">查看</button></div></div>`;
}

function renderAlbum(al, i) {
  const id = al.id, name = al.n || '(未知)', pic = al.pu || '', ar = al.ar || '', size = al.size != null ? al.size + ' 首' : '';
  const pub = al.pubTime ? new Date(al.pubTime).getFullYear() : '';
  const seq = searchState.offset + i + 1;
  return `<div class="s-item" data-id="${esc(id)}"><img src="${esc(thumbPic(pic))}" onerror="this.style.visibility='hidden'"><div class="si-body"><div class="si-title">${seq}. ${esc(name)}</div><div class="si-meta">${esc(ar)}${size ? ' · ' + esc(size) : ''}${pub ? ' · ' + esc(pub) : ''}</div></div><div class="si-actions"><button class="pm" data-act="album" data-id="${esc(id)}">查看</button></div></div>`;
}

function renderPlaylist(p, i) {
  const id = p.id, name = p.n || '(未知)', pic = p.pu || '', by = p.by || '', count = p.count != null ? p.count + ' 首' : '';
  const playCount = p.playCount != null ? (p.playCount >= 10000 ? (p.playCount / 10000).toFixed(1) + ' 万播放' : p.playCount + ' 播放') : '';
  const seq = searchState.offset + i + 1;
  return `<div class="s-item" data-id="${esc(id)}"><img src="${esc(thumbPic(pic))}" onerror="this.style.visibility='hidden'"><div class="si-body"><div class="si-title">${seq}. ${esc(name)}</div><div class="si-meta">${esc(by)}${count ? ' · ' + esc(count) : ''}${playCount ? ' · ' + esc(playCount) : ''}</div></div><div class="si-actions"><button class="pm" data-act="playlist" data-id="${esc(id)}">查看</button></div></div>`;
}

function renderMv(m, i) {
  const id = m.id, name = m.n || '(未知)', pic = m.pu || '', ar = m.ar || '', dt = m.dt ? fmtTime(m.dt) : '';
  const playCount = m.playCount != null ? (m.playCount >= 10000 ? (m.playCount / 10000).toFixed(1) + ' 万播放' : m.playCount + ' 播放') : '';
  const seq = searchState.offset + i + 1;
  return `<div class="s-item" data-id="${esc(id)}"><img src="${esc(thumbPic(pic))}" onerror="this.style.visibility='hidden'"><div class="si-body"><div class="si-title">${seq}. ${esc(name)}</div><div class="si-meta">${esc(ar)}${dt ? ' · ' + dt : ''}${playCount ? ' · ' + esc(playCount) : ''}</div></div><div class="si-actions">${mvActionButtons({ id, n: name, ar, pu: pic, dt: m.dt })}</div></div>`;
}

function layoutMasonry() {
  if (searchState.view !== 'waterfall') return;
  const items = sList.querySelectorAll('.s-item');
  if (!items.length) return;
  const w = sList.clientWidth, gap = 12;
  let cols = 5; if (w < 400) cols = 2; else if (w < 600) cols = 3;
  const cw = (w - gap * (cols - 1)) / cols, ch = new Array(cols).fill(0);
  items.forEach(it => {
    it.style.width = cw + 'px'; it.style.left = ''; it.style.top = '';
    const h = it.offsetHeight; let mc = 0;
    for (let c = 1; c < cols; c++) if (ch[c] < ch[mc]) mc = c;
    it.style.left = mc * (cw + gap) + 'px'; it.style.top = ch[mc] + 'px';
    ch[mc] += h + gap;
  });
  sList.style.height = Math.max(0, Math.max(...ch) - gap) + 'px';
}

let _rt; window.onresize = () => { clearTimeout(_rt); _rt = setTimeout(layoutMasonry, 150); };

async function doSearch() {
  sErr.style.display = 'none'; sResult.classList.add('show');
  // 若已有搜索结果，提示用户正在更新
  const hasPrevSearch = sList.innerHTML.trim().length > 0;
  if (hasPrevSearch) {
    sReloadHint.style.display = '';
    sReloadHint.innerHTML = '<span class="spinner"></span><span><div class="rh-text">正在搜索，结果即将更新…</div><div class="rh-sub">当前显示的是上一次搜索内容，请稍候</div></span>';
  }
  const orig = sBtn.textContent; sBtn.disabled = true; sBtn.innerHTML = '<span class="spinner"></span> 搜索中…';
  try {
    const resp = await fetch('/api/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keyword: searchState.kw, type: searchState.type, offset: searchState.offset, limit: searchState.limit }) });
    const data = await resp.json();
    sReloadHint.style.display = 'none';
    if (!data.ok) { sErr.style.display = ''; sErr.textContent = '搜索失败，请稍后重试。'; sSum.innerHTML = ''; sList.innerHTML = ''; pTop.innerHTML = ''; pBot.innerHTML = ''; return; }
    searchState.count = data.cnt || 0;
    const cur = curPage(), total = totalPages();
    const typeVal = data.type || 1;
    let items, renderFn, typeLabel;
    if (typeVal === 100) { items = data.artists || []; renderFn = renderArtist; typeLabel = '歌手'; }
    else if (typeVal === 10) { items = data.albums || []; renderFn = renderAlbum; typeLabel = '专辑'; }
    else if (typeVal === 1000) { items = data.playlists || []; renderFn = renderPlaylist; typeLabel = '歌单'; }
    else if (typeVal === 1004) { items = data.mvs || []; renderFn = renderMv; typeLabel = 'MV'; }
    else { items = data.list || []; renderFn = renderItem; typeLabel = '歌曲'; }
    sSum.innerHTML = `关键词「<b>${esc(searchState.kw)}</b>」共找到 <b>${searchState.count}</b> 条${typeLabel}结果，当前第 <b>${cur}</b> / ${total} 页，每页 <b>${searchState.limit}</b> 条。`;
    if (!items.length) { sList.className = 'list'; sList.innerHTML = '<div style="color:var(--text-3);text-align:center;padding:30px">未找到相关结果。</div>'; pTop.innerHTML = ''; pBot.innerHTML = ''; return; }
    sList.className = 'list ' + searchState.view; sList.style.height = '';
    sList.innerHTML = items.map((s, i) => renderFn(s, i)).join('');
    renderPager();
    // 绑定所有按钮（歌曲=播放/加入，歌手/专辑/歌单=查看详情，MV=播放/加入）
    sList.querySelectorAll('.s-item').forEach(item => {
      const id = item.dataset.id;
      item.querySelectorAll('button[data-act]').forEach(b => b.onclick = () => {
        const act = b.dataset.act;
        if (act === 'artist') openDetail('artist', id);
        else if (act === 'album') openDetail('album', id);
        else if (act === 'playlist') openDetail('playlist', id);
      });
    });
    bindSongActions(sList);
    bindMvActions(sList);
    if (searchState.view === 'waterfall') {
      layoutMasonry();
      const imgs = sList.querySelectorAll('img'); let pending = imgs.length;
      if (pending) imgs.forEach(img => { const done = () => { if (!--pending) layoutMasonry(); }; if (img.complete) done(); else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); } });
    }
  } catch { sErr.style.display = ''; sErr.textContent = '请求失败，请稍后重试。'; sSum.innerHTML = ''; sList.innerHTML = ''; pTop.innerHTML = ''; pBot.innerHTML = ''; sReloadHint.style.display = 'none'; }
  finally { sBtn.disabled = false; sBtn.textContent = orig; }
}

document.querySelectorAll('.seg-btn').forEach(b => b.onclick = () => {
  document.querySelectorAll('.seg-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); searchState.view = b.dataset.view;
  sList.className = 'list ' + searchState.view;
  if (searchState.view === 'waterfall') layoutMasonry();
  else { sList.style.height = ''; sList.querySelectorAll('.s-item').forEach(i => { i.style.width = ''; i.style.left = ''; i.style.top = ''; }); }
});

sForm.onsubmit = e => { e.preventDefault(); const kw = $('#searchKeyword').value.trim(); if (!kw) return; searchState.kw = kw; searchState.type = $('#searchType').value; searchState.limit = parseInt($('#searchLimit').value, 10) || 20; searchState.offset = 0; localStorage.setItem('_search_type', searchState.type); localStorage.setItem('_search_limit', String(searchState.limit)); doSearch(); };

/* 恢复用户搜索习惯 */
(function restoreSearchPrefs() {
  const t = localStorage.getItem('_search_type');
  const l = localStorage.getItem('_search_limit');
  if (t) { const el = $('#searchType'); if (el && el.querySelector('option[value="' + t + '"]')) el.value = t; }
  if (l) { const el = $('#searchLimit'); if (el && el.querySelector('option[value="' + l + '"]')) el.value = l; }
})();

/* 随机发现 */
function randomDiscover(type, btn) {
  if (btn.disabled) return;
  const orig = btn.textContent; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ' + orig;
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelector('.tab[data-mode="search"]').classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  $('#panel-search').classList.remove('hidden');
  searchState.kw = ''; searchState.type = type; searchState.limit = parseInt(localStorage.getItem('_search_limit'), 10) || 30; searchState.offset = 0;
  $('#searchType').value = type;
  $('#searchLimit').value = String(searchState.limit);
  doSearch().finally(() => { btn.disabled = false; btn.textContent = orig; });
}
$('#randSong').onclick = () => randomDiscover('1', $('#randSong'));
$('#randArtist').onclick = () => randomDiscover('100', $('#randArtist'));
$('#randAlbum').onclick = () => randomDiscover('10', $('#randAlbum'));

/* ---- 详情面板（歌手/专辑/歌单） — 各自独立 tab，互不影响 ---- */
const detailPanels = {
  artist:   { head: $('#artistHead'),   body: $('#artistBody'),   err: $('#artistErrbox'),   reload: $('#artistReloadHint'),   result: $('#artistResult'),   panel: $('#panel-artist') },
  album:    { head: $('#albumHead'),    body: $('#albumBody'),    err: $('#albumErrbox'),    reload: $('#albumReloadHint'),    result: $('#albumResult'),    panel: $('#panel-album') },
  playlist: { head: $('#playlistHead'), body: $('#playlistBody'), err: $('#playlistErrbox'), reload: $('#playlistReloadHint'), result: $('#playlistResult'), panel: $('#panel-playlist') },
};
// 兼容旧引用：dHead/dBody/dErr/dReloadHint/dResult 在 render 函数中按 currentDetailType 动态选取
let currentDetailType = 'artist';
const dHead = { get innerHTML() { return detailPanels[currentDetailType].head.innerHTML; }, set innerHTML(v) { detailPanels[currentDetailType].head.innerHTML = v; } };
const dBody = { get innerHTML() { return detailPanels[currentDetailType].body.innerHTML; }, set innerHTML(v) { detailPanels[currentDetailType].body.innerHTML = v; }, querySelector: s => detailPanels[currentDetailType].body.querySelector(s), querySelectorAll: s => detailPanels[currentDetailType].body.querySelectorAll(s) };
const dErr = { get style() { return detailPanels[currentDetailType].err.style; }, get textContent() { return detailPanels[currentDetailType].err.textContent; }, set textContent(v) { detailPanels[currentDetailType].err.textContent = v; } };
const dReloadHint = { get style() { return detailPanels[currentDetailType].reload.style; }, set innerHTML(v) { detailPanels[currentDetailType].reload.innerHTML = v; } };
const dResult = { classList: { add: c => detailPanels[currentDetailType].result.classList.add(c), remove: c => detailPanels[currentDetailType].result.classList.remove(c), contains: c => detailPanels[currentDetailType].result.classList.contains(c) } };

function goToResolve(id) {
  // 切换到解析 tab，作为独立页面
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelector('.tab[data-mode="resolve"]').classList.add('active');
  hideAllPanels();
  $('#panel-resolve').classList.remove('hidden');
  $('#song_id').value = id;
  $('#song_id').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('#form').dispatchEvent(new Event('submit', { cancelable: true }));
}

function goToMvResolve(mvid) {
  // 切换到 MV 解析 tab，填入 mvid 并自动解析
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelector('.tab[data-mode="mv"]').classList.add('active');
  hideAllPanels();
  $('#panel-mv').classList.remove('hidden');
  $('#mv_id').value = mvid;
  $('#mvForm').dispatchEvent(new Event('submit', { cancelable: true }));
}

function showDetailPanel(type) {
  // 显示指定类型的详情面板，并激活对应 tab（不隐藏其他详情面板，由 tab 切换逻辑处理）
  currentDetailType = type;
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelector('.tab[data-mode="' + type + '"]').classList.add('active');
  hideAllPanels();
  $('#panel-' + type).classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function songTags(s) {
  const t = [];
  if (s.h) t.push('<span class="pill">320k</span>');
  if (s.m) t.push('<span class="pill">192k</span>');
  if (s.l) t.push('<span class="pill">128k</span>');
  if (s.sq) t.push('<span class="pill warn">SQ</span>');
  if (s.hr) t.push('<span class="pill warn">Hi-Res</span>');
  if (s.fee === 1) t.push('<span class="pill err">VIP</span>');
  return t.join('');
}

function renderDetailSongs(songs, startIdx) {
  if (!songs.length && !startIdx) return '<div style="color:var(--text-3);text-align:center;padding:30px">暂无歌曲。</div>';
  return songs.map((s, i) => {
    const idx = (startIdx || 0) + i;
    const id = s.id, name = s.n || '(未知)', ar = s.ar || '', al = s.al || '', dt = s.dt ? fmtTime(s.dt) : '', pic = s.pu || '';
    return `<div class="ds-item" data-id="${esc(id)}"><div class="ds-num">${idx + 1}</div><img class="ds-pic" src="${esc(thumbPic(pic))}" onerror="this.style.visibility='hidden'"><div class="ds-body"><div class="ds-name">${esc(name)}</div><div class="ds-meta">${esc(ar)}${al ? ' · ' + esc(al) : ''}${dt ? ' · ' + dt : ''}</div></div><div class="ds-tags">${songTags(s)}</div><div class="ds-actions">${songActionButtons({ id, n: name, ar, pu: pic, dt: s.dt })}</div></div>`;
  }).join('');
}

function bindDetailSongButtons(container) {
  bindSongActions(container || dBody);
}

// 无限滚动状态
const scrollState = { type: null, id: null, loading: false, hasMore: false, offset: 0, total: 0 };

function setupInfiniteScroll(type, id, initialCount, total, more) {
  scrollState.type = type;
  scrollState.id = id;
  scrollState.offset = initialCount;
  scrollState.total = total;
  scrollState.hasMore = more !== false && initialCount < total;
  scrollState.loading = false;
}

async function loadMoreSongs() {
  if (scrollState.loading || !scrollState.hasMore) return;
  scrollState.loading = true;
  // 显示加载指示器
  const loader = document.createElement('div');
  loader.className = 'detail-loading';
  loader.innerHTML = '<span class="spinner"></span><div>正在加载更多歌曲…</div>';
  dBody.querySelector('.detail-songs').appendChild(loader);

  try {
    let resp, data;
    if (scrollState.type === 'artist') {
      resp = await fetch('/api/artist/songs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: scrollState.id, limit: 50, offset: scrollState.offset }) });
      data = await resp.json();
      if (data.ok && data.songs.length) {
        const html = renderDetailSongs(data.songs, scrollState.offset);
        const container = dBody.querySelector('.detail-songs');
        container.insertAdjacentHTML('beforeend', html);
        bindDetailSongButtons(container);
        scrollState.offset += data.songs.length;
        scrollState.hasMore = data.more && scrollState.offset < scrollState.total;
      } else {
        scrollState.hasMore = false;
      }
    }
    // album 和 playlist 的歌曲已经在初次加载时全部获取，不需要无限滚动
  } catch (e) {
    scrollState.hasMore = false;
  } finally {
    loader.remove();
    scrollState.loading = false;
  }
}

// 滚动监听
window.addEventListener('scroll', () => {
  if (!scrollState.hasMore || scrollState.loading) return;
  if ($('#panel-artist').classList.contains('hidden') && $('#panel-album').classList.contains('hidden') && $('#panel-playlist').classList.contains('hidden')) return;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight;
  const clientHeight = document.documentElement.clientHeight;
  // 距离底部 200px 时触发
  if (scrollTop + clientHeight >= scrollHeight - 200) {
    loadMoreSongs();
  }
});

async function openDetail(type, id) {
  currentDetailType = type;
  showDetailPanel(type);
  dErr.style.display = 'none';
  dReloadHint.style.display = 'none';
  dHead.innerHTML = '';
  dBody.innerHTML = '<div class="detail-loading"><span class="spinner"></span><div>正在加载详情…</div></div>';
  dResult.classList.add('show');
  scrollState.hasMore = false; // 重置滚动状态
  try {
    const resp = await fetch('/api/' + type, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    const data = await resp.json();
    if (!data.ok) { dErr.style.display = ''; dErr.textContent = '获取详情失败，请稍后重试。'; dBody.innerHTML = ''; return; }

    if (type === 'artist') {
      renderArtistDetail(data);
      // 设置无限滚动（歌手有更多歌曲）
      const artist = data.artist || {};
      const total = artist.musicSize || (data.songs || []).length;
      setupInfiniteScroll('artist', id, (data.songs || []).length, total, data.more);
    } else if (type === 'album') {
      renderAlbumDetail(data);
    } else if (type === 'playlist') {
      renderPlaylistDetail(data);
    }
    bindDetailSongButtons();
  } catch { dErr.style.display = ''; dErr.textContent = '请求失败，请稍后重试。'; dBody.innerHTML = ''; }
}

function renderArtistDetail(data) {
  currentDetailType = 'artist';
  const a = data.artist || {};
  const pic = a.pu || '', name = a.n || '(未知)', alias = a.alias || '';
  const stats = [];
  if (a.musicSize != null) stats.push(`<span class="pill">${a.musicSize} 单曲</span>`);
  if (a.albumSize != null) stats.push(`<span class="pill">${a.albumSize} 专辑</span>`);
  if (a.mvSize != null) stats.push(`<span class="pill">${a.mvSize} MV</span>`);
  if (a.followed) stats.push('<span class="pill warn">已关注</span>');

  let h = '<div class="detail-hero">';
  h += `<img src="${esc(thumbPic(pic))}" onerror="this.style.visibility='hidden'">`;
  h += '<div class="dh-info">';
  h += `<div class="dh-title">${esc(name)}</div>`;
  if (alias) h += `<div class="dh-sub">${esc(alias)}</div>`;
  h += `<div class="dh-stats">${stats.join('')}</div>`;
  if (a.brief) h += `<div class="dh-brief">${esc(a.brief)}</div>`;
  h += '</div></div>';

  // 演唱会信息
  const c = data.concert;
  if (c) {
    const times = c.time || [];
    const t0 = times[0] ? new Date(times[0]).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const t1 = times[1] ? new Date(times[1]).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
    h += '<div class="detail-concert">';
    if (c.cover) h += `<img class="dc-cover" src="${esc(thumbPic(c.cover))}" onerror="this.style.display='none'">`;
    h += '<div class="dc-info">';
    h += `<div class="dc-title">${esc(c.title || '近期演唱会')}</div>`;
    h += `<div class="dc-meta">${t0}${t1 ? ' - ' + t1 : ''}${c.address ? ' · ' + esc(c.address) : ''}${c.artists ? ' · ' + esc(c.artists) : ''}${c.serviceName ? ' · 票务：' + esc(c.serviceName) : ''}</div>`;
    h += '</div>';
    // 不显示抢票按钮，只显示演唱会信息
    h += '</div>';
  }

  dHead.innerHTML = h;

  // 热门歌曲
  let bh = `<div class="detail-section-title">热门歌曲${data.more ? '（前 ' + (data.songs || []).length + ' 首，滚动加载更多）' : ''}</div>`;
  bh += batchActionBar(data.songs || []);
  bh += '<div class="detail-songs">' + renderDetailSongs(data.songs || []) + '</div>';

  // 同类型歌手推荐
  const sim = data.similar || [];
  if (sim.length) {
    bh += '<div class="detail-section-title">相似歌手推荐</div>';
    bh += '<div class="similar-grid">' + sim.map(s => {
      const sid = s.id, sn = s.n || '(未知)', sp = s.pu || '';
      const sm = [];
      if (s.musicSize != null) sm.push(s.musicSize + ' 单曲');
      if (s.albumSize != null) sm.push(s.albumSize + ' 专辑');
      return `<div class="sim-item" data-id="${esc(sid)}"><img src="${esc(thumbPic(sp))}" onerror="this.style.visibility='hidden'"><div class="sim-name">${esc(sn)}</div><div class="sim-meta">${esc(sm.join(' · '))}</div></div>`;
    }).join('') + '</div>';
  }
  dBody.innerHTML = bh;
  bindBatchActions(dBody);

  // 绑定相似歌手点击
  dBody.querySelectorAll('.sim-item').forEach(item => {
    const sid = item.dataset.id;
    item.onclick = () => openDetail('artist', sid);
  });
}

function renderAlbumDetail(data) {
  currentDetailType = 'album';
  const al = data.album || {};
  const pic = al.pu || '', name = al.n || '(未知)', ar = al.ar || '';
  const stats = [];
  if (al.size != null) stats.push(`<span class="pill">${al.size} 首</span>`);
  if (al.pubTime) stats.push(`<span class="pill">${new Date(al.pubTime).toLocaleDateString('zh-CN')}</span>`);

  let h = '<div class="detail-hero">';
  h += `<img src="${esc(thumbPic(pic))}" onerror="this.style.visibility='hidden'">`;
  h += '<div class="dh-info">';
  h += `<div class="dh-title">${esc(name)}</div>`;
  if (ar) h += `<div class="dh-sub">歌手：${esc(ar)}</div>`;
  h += `<div class="dh-stats">${stats.join('')}</div>`;
  if (al.desc) h += `<div class="dh-brief">${esc(al.desc)}</div>`;
  h += '</div></div>';
  dHead.innerHTML = h;

  let bh = `<div class="detail-section-title">专辑曲目（${(data.songs || []).length} 首）</div>`;
  bh += batchActionBar(data.songs || []);
  bh += '<div class="detail-songs">' + renderDetailSongs(data.songs || []) + '</div>';
  dBody.innerHTML = bh;
  bindBatchActions(dBody);
}

function renderPlaylistDetail(data) {
  currentDetailType = 'playlist';
  const p = data.playlist || {};
  const pic = p.pu || '', name = p.n || '(未知)', by = p.by || '';
  const stats = [];
  if (p.count != null) stats.push(`<span class="pill">${p.count} 首</span>`);
  if (p.playCount != null) stats.push(`<span class="pill">${p.playCount >= 10000 ? (p.playCount / 10000).toFixed(1) + ' 万播放' : p.playCount + ' 播放'}</span>`);

  let h = '<div class="detail-hero">';
  h += `<img src="${esc(thumbPic(pic))}" onerror="this.style.visibility='hidden'">`;
  h += '<div class="dh-info">';
  h += `<div class="dh-title">${esc(name)}</div>`;
  if (by) h += `<div class="dh-sub">创建者：${esc(by)}</div>`;
  h += `<div class="dh-stats">${stats.join('')}</div>`;
  if (p.desc) h += `<div class="dh-brief">${esc(p.desc)}</div>`;
  h += '</div></div>';
  dHead.innerHTML = h;

  let bh = `<div class="detail-section-title">歌单曲目（${(data.songs || []).length} 首）</div>`;
  bh += batchActionBar(data.songs || []);
  bh += '<div class="detail-songs">' + renderDetailSongs(data.songs || []) + '</div>';
  dBody.innerHTML = bh;
  bindBatchActions(dBody);
}

/* ---- MV 解析 ---- */
const mvForm = $('#mvForm'), mvBtn = $('#mvBtn'), mvResult = $('#mvResult'), mvErrbox = $('#mvErrbox'), mvBox = $('#mvBox');

mvForm.onsubmit = async e => {
  e.preventDefault();
  const mvid = $('#mv_id').value.trim();
  if (!mvid) return;
  mvBtn.disabled = true;
  const orig = mvBtn.textContent;
  mvBtn.innerHTML = '<span class="spinner"></span> 解析中…';
  mvErrbox.style.display = 'none';
  mvResult.classList.add('show');
  try {
    const resp = await fetch('/api/mv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: mvid }) });
    const data = await resp.json();
    if (!data.ok) { mvErrbox.style.display = ''; mvErrbox.textContent = 'MV 解析失败，请检查 MV ID 是否正确后重试。'; mvBox.innerHTML = ''; return; }
    const mv = data.mv || {}, brs = data.brs || {};
    const name = mv.n || '(未知)', ar = mv.ar || '未知', cover = mv.cover || '', dt = mv.duration ? fmtTime(mv.duration) : '';
    const playCount = mv.playCount != null ? (mv.playCount >= 10000 ? (mv.playCount / 10000).toFixed(1) + ' 万' : mv.playCount) : '';
    let h = `<div class="song"><img src="${esc(thumbPic(cover))}" onerror="this.style.visibility='hidden'"><div class="meta"><div class="title">${esc(name)}<span class="badge">MV</span></div><div class="artist">${esc(ar)}${dt ? ' · ' + dt : ''}${playCount ? ' · ' + esc(playCount) + ' 播放' : ''}</div></div></div>`;
    // 播放按钮（不再显示下载地址）
    const brKeys = Object.keys(brs).sort((a, b) => parseInt(b) - parseInt(a));
    if (brKeys.length) {
      h += `<div class="dl-section">${mvActionButtons({ id: mvid, n: name, ar, pu: cover, dt: mv.duration })}</div>`;
      h += `<div class="detail"><div class="detail-row"><div class="k">可用画质</div><div class="v">${brKeys.map(k => k + 'P').join(' / ')}</div></div></div>`;
    } else {
      h += '<div class="alert">未获取到视频地址。</div>';
    }
    // 详细信息
    const rows = [['MV ID', mv.id],['名称', mv.n],['歌手', mv.ar],['时长', mv.duration ? fmtTime(mv.duration) : null],['发布时间', mv.publishTime],['播放数', mv.playCount],['收藏数', mv.subCount],['点赞数', mv.likeCount],['评论数', mv.commentCount],['描述', mv.desc]];
    h += '<div class="detail-section-title">详细信息</div>';
    h += '<div class="detail">';
    for (const [k, v] of rows) if (v != null && v !== '') h += `<div class="detail-row"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
    h += '</div>';
    mvBox.innerHTML = h;
    bindMvActions(mvBox);
  } catch { mvErrbox.style.display = ''; mvErrbox.textContent = '请求失败，请稍后重试。'; mvBox.innerHTML = ''; }
  finally { mvBtn.disabled = false; mvBtn.textContent = orig; }
};
