'use strict';

// ===== 定数 =====
const COLORS = [
  '#5b8dee', '#4caf88', '#e07b54', '#a06be0',
  '#e0b44a', '#e06090', '#6bbce0', '#888',
];
const STORAGE_KEY = 'lifelog_v1';

// ===== 状態 =====
let records = [];      // { id, date, start, end, label, color }
let editingId = null;
let selectedColor = COLORS[0];
let ctxTargetId = null;

// ===== LocalStorage =====
function load() {
  try { records = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { records = []; }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// ===== ユーティリティ =====
function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function dateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ===== カラーピッカー =====
function renderColorPicker() {
  const wrap = document.getElementById('color-picker');
  wrap.innerHTML = '';
  COLORS.forEach(c => {
    const s = document.createElement('div');
    s.className = 'color-swatch' + (c === selectedColor ? ' selected' : '');
    s.style.background = c;
    s.setAttribute('role', 'radio');
    s.setAttribute('aria-label', c);
    s.setAttribute('tabindex', '0');
    s.addEventListener('click', () => { selectedColor = c; renderColorPicker(); });
    s.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { selectedColor = c; renderColorPicker(); }
    });
    wrap.appendChild(s);
  });
}

// ===== タイムライン描画 =====
function renderTimeline() {
  const grid = document.getElementById('tl-grid');
  grid.innerHTML = '';

  // 表示する日付を収集（記録がある日 + 今日の前後±2日）
  const today = todayStr();
  const dateSet = new Set(records.map(r => r.date));
  for (let i = -2; i <= 2; i++) {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() + i);
    dateSet.add(d.toISOString().slice(0, 10));
  }
  const dates = [...dateSet].sort();

  // ── 時刻ヘッダー ──
  const spacer = document.createElement('div');
  spacer.className = 'tl-header-spacer';
  grid.appendChild(spacer);

  const hourHeader = document.createElement('div');
  hourHeader.className = 'tl-hour-header';
  for (let h = 0; h <= 24; h += 3) {
    const lbl = document.createElement('div');
    lbl.className = 'tl-hour-label';
    lbl.style.left = (h / 24 * 100) + '%';
    lbl.textContent = `${h}:00`;
    hourHeader.appendChild(lbl);
  }
  grid.appendChild(hourHeader);

  // ── 日付ごとの行 ──
  dates.forEach(date => {
    const dayRecords = records.filter(r => r.date === date);

    // 日付ラベル
    const lbl = document.createElement('div');
    lbl.className = 'tl-date-label' + (date === today ? ' today' : '');
    lbl.textContent = dateLabel(date);
    grid.appendChild(lbl);

    // タイムライン行
    const row = document.createElement('div');
    row.className = 'tl-row';

    // グリッド線
    for (let h = 0; h <= 24; h++) {
      const line = document.createElement('div');
      line.className = 'tl-gridline' + (h % 6 === 0 ? ' hour6' : '');
      line.style.left = (h / 24 * 100) + '%';
      row.appendChild(line);
    }

    // 行動ブロック
    dayRecords.forEach(rec => {
      const startMin = toMinutes(rec.start);
      const endMin   = toMinutes(rec.end);
      if (startMin >= endMin) return;

      const block = document.createElement('div');
      block.className = 'activity-block';
      block.style.left       = (startMin / 1440 * 100).toFixed(4) + '%';
      block.style.width      = ((endMin - startMin) / 1440 * 100).toFixed(4) + '%';
      block.style.background = rec.color;
      block.dataset.id = rec.id;
      block.setAttribute('tabindex', '0');
      block.setAttribute('role', 'button');
      block.setAttribute('aria-label', `${rec.label} ${rec.start}〜${rec.end}`);

      const span = document.createElement('span');
      span.className = 'block-label';
      span.textContent = rec.label;
      block.appendChild(span);

      // ── ツールチップ（マウス） ──
      block.addEventListener('mouseenter', e => showTooltip(e, rec));
      block.addEventListener('mousemove',  moveTooltip);
      block.addEventListener('mouseleave', hideTooltip);

      // ── 長押しでコンテキストメニュー（タッチ） ──
      let longPressTimer = null;
      block.addEventListener('touchstart', e => {
        longPressTimer = setTimeout(() => {
          const t = e.touches[0];
          e.preventDefault();
          showCtxMenu(t.clientX, t.clientY, rec.id);
        }, 500);
      }, { passive: true });
      block.addEventListener('touchend',   () => clearTimeout(longPressTimer));
      block.addEventListener('touchmove',  () => clearTimeout(longPressTimer));

      // ── 右クリック（デスクトップ） ──
      block.addEventListener('contextmenu', e => {
        e.preventDefault();
        showCtxMenu(e.clientX, e.clientY, rec.id);
      });

      row.appendChild(block);
    });

    grid.appendChild(row);
  });
}

// ===== ツールチップ =====
const tooltip = document.getElementById('tooltip');
function showTooltip(e, rec) {
  tooltip.innerHTML =
    `<strong>${rec.label}</strong><br>${rec.start} 〜 ${rec.end}<br>${dateLabel(rec.date)}`;
  tooltip.style.display = 'block';
  moveTooltip(e);
}
function moveTooltip(e) {
  // 画面端でのはみ出しを防ぐ
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  let x = e.clientX + 14;
  let y = e.clientY - 10;
  if (x + tw > window.innerWidth  - 8) x = e.clientX - tw - 10;
  if (y + th > window.innerHeight - 8) y = window.innerHeight - th - 8;
  tooltip.style.left = x + 'px';
  tooltip.style.top  = y + 'px';
}
function hideTooltip() { tooltip.style.display = 'none'; }

// ===== コンテキストメニュー =====
const ctxMenu = document.getElementById('ctx-menu');

function showCtxMenu(x, y, id) {
  ctxTargetId = id;
  // 画面端補正
  const menuW = 160, menuH = 110;
  if (x + menuW > window.innerWidth)  x = window.innerWidth  - menuW - 8;
  if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
  ctxMenu.style.left = x + 'px';
  ctxMenu.style.top  = y + 'px';
  ctxMenu.classList.add('open');
}
function hideCtxMenu() { ctxMenu.classList.remove('open'); }

document.getElementById('ctx-edit').addEventListener('click', () => {
  const rec = records.find(r => r.id === ctxTargetId);
  if (!rec) return;
  hideCtxMenu();
  openModal(rec);
});

document.getElementById('ctx-delete').addEventListener('click', () => {
  if (!ctxTargetId) return;
  if (confirm('この行動を削除しますか？')) {
    records = records.filter(r => r.id !== ctxTargetId);
    save();
    renderTimeline();
  }
  hideCtxMenu();
});

// メニュー外タップ/クリックで閉じる
document.addEventListener('pointerdown', e => {
  if (!ctxMenu.contains(e.target)) hideCtxMenu();
});

// ===== ショートカットボタン =====
function initShortcutButtons() {
  const buttons = document.querySelectorAll('.shortcut-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.dataset.label;
      const color = btn.dataset.color;

      // テキスト欄に入力
      document.getElementById('f-label').value = label;

      // 対応する色があれば自動選択
      if (color && COLORS.includes(color)) {
        selectedColor = color;
        renderColorPicker();
      }

      // ボタンのハイライトを切り替え
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ===== モーダル =====
function openModal(rec = null) {
  editingId = rec ? rec.id : null;
  document.getElementById('f-date').value  = rec ? rec.date  : todayStr();
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, '0');
  const mm  = String(now.getMinutes()).padStart(2, '0');
  const nowStr = `${hh}:${mm}`;
  document.getElementById('f-start').value = rec ? rec.start : nowStr;
  document.getElementById('f-end').value   = rec ? rec.end   : nowStr;
  document.getElementById('f-label').value = rec ? rec.label : '';
  selectedColor = rec ? rec.color : COLORS[0];
  renderColorPicker();

  // ショートカットボタンのハイライトをリセットし、編集時は対応ボタンを選択状態に
  document.querySelectorAll('.shortcut-btn').forEach(btn => {
    btn.classList.toggle('active', rec ? btn.dataset.label === rec.label : false);
  });

  document.getElementById('modal-overlay').classList.add('open');
  // 少し遅らせてフォーカス（iOS Safari 対策）
  setTimeout(() => document.getElementById('f-label').focus(), 80);
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editingId = null;
}

document.getElementById('btn-open-modal').addEventListener('click', () => openModal());
document.getElementById('btn-cancel').addEventListener('click', closeModal);
// オーバーレイ背景タップで閉じる
document.getElementById('modal-overlay').addEventListener('pointerdown', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

document.getElementById('btn-save').addEventListener('click', () => {
  const date  = document.getElementById('f-date').value;
  const start = document.getElementById('f-start').value;
  const end   = document.getElementById('f-end').value;
  const label = document.getElementById('f-label').value.trim();

  if (!date || !start || !end || !label) {
    alert('すべての項目を入力してください。');
    return;
  }
  if (toMinutes(start) >= toMinutes(end)) {
    alert('終了時間は開始時間より後にしてください。');
    return;
  }

  const entry = { id: editingId || uid(), date, start, end, label, color: selectedColor };
  if (editingId) {
    const idx = records.findIndex(r => r.id === editingId);
    if (idx !== -1) records[idx] = entry;
  } else {
    records.push(entry);
  }

  save();
  renderTimeline();
  closeModal();
});

// ===== 初期化 =====
load();
renderTimeline();
initShortcutButtons();
