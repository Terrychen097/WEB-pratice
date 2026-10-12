(function () {
  'use strict';

  const STORAGE_KEY = 'expenses.v1';
  const CATEGORIES = [
    { name: '餐饮', color: '#f59e0b' },
    { name: '交通', color: '#3b82f6' },
    { name: '购物', color: '#ec4899' },
    { name: '住房', color: '#8b5cf6' },
    { name: '娱乐', color: '#10b981' },
    { name: '医疗', color: '#ef4444' },
    { name: '教育', color: '#06b6d4' },
    { name: '其他', color: '#9ca3af' },
  ];
  const colorOf = (cat) => (CATEGORIES.find((c) => c.name === cat) || CATEGORIES[CATEGORIES.length - 1]).color;

  const $ = (id) => document.getElementById(id);
  const money = (n) => '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pad = (n) => String(n).padStart(2, '0');
  const ymOf = (date) => date.slice(0, 7);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const shiftMonth = (ym, delta) => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  const daysInMonth = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  };

  // ---------- storage ----------
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    } catch (e) {
      /* storage unavailable: keep working in memory */
    }
  }

  let expenses = load();
  let month = ymOf(today());

  // ---------- aggregation ----------
  function summarize(ym) {
    const items = expenses.filter((e) => ymOf(e.date) === ym);
    const byCat = new Map();
    let total = 0;
    for (const e of items) {
      total += e.amount;
      const s = byCat.get(e.category) || { amount: 0, count: 0 };
      s.amount += e.amount;
      s.count += 1;
      byCat.set(e.category, s);
    }
    return { items, byCat, total };
  }

  // ---------- render ----------
  function render() {
    $('monthPicker').value = month;
    const cur = summarize(month);
    const prev = summarize(shiftMonth(month, -1));

    renderStats(cur, prev);
    renderBreakdown(cur, prev);
    renderDaily(cur);
    renderList(cur);
  }

  function deltaHtml(now, before) {
    if (!before) return now ? '<span class="up">新增</span>' : '—';
    const pct = ((now - before) / before) * 100;
    const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : '';
    const sign = pct > 0 ? '+' : '';
    return `<span class="${cls}">${sign}${pct.toFixed(1)}%</span>`;
  }

  function renderStats(cur, prev) {
    $('statTotal').textContent = money(cur.total);
    $('statCount').textContent = cur.items.length;
    // For the current month, average over days elapsed so far.
    const isThisMonth = month === ymOf(today());
    const days = isThisMonth ? Number(today().slice(8)) : daysInMonth(month);
    $('statDaily').textContent = money(cur.total / days);
    $('statDelta').innerHTML = deltaHtml(cur.total, prev.total);
  }

  function renderBreakdown(cur, prev) {
    const rows = [...cur.byCat.entries()].sort((a, b) => b[1].amount - a[1].amount);
    $('emptyHint').hidden = rows.length > 0;
    document.querySelector('.breakdown').hidden = rows.length === 0;

    // Donut
    const r = 45, c = 2 * Math.PI * r;
    let offset = 0;
    let svg = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--border)" stroke-width="18"/>`;
    for (const [cat, s] of rows) {
      const len = (s.amount / cur.total) * c;
      svg += `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${colorOf(cat)}" stroke-width="18"
        stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)">
        <title>${escapeHtml(cat)} ${money(s.amount)}</title></circle>`;
      offset += len;
    }
    svg += `<text x="60" y="57" text-anchor="middle" font-size="9" fill="var(--muted)">合计</text>
      <text x="60" y="71" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text)">${money(cur.total)}</text>`;
    $('donut').innerHTML = svg;

    // Table
    $('catBody').innerHTML = rows.map(([cat, s]) => {
      const pct = (s.amount / cur.total) * 100;
      const before = prev.byCat.get(cat);
      return `<tr>
        <td><span class="swatch" style="background:${colorOf(cat)}"></span>${escapeHtml(cat)}
          <div class="bar"><span style="width:${pct}%;background:${colorOf(cat)}"></span></div></td>
        <td class="num">${money(s.amount)}</td>
        <td class="num">${pct.toFixed(1)}%</td>
        <td class="num">${s.count}</td>
        <td class="num">${deltaHtml(s.amount, before ? before.amount : 0)}</td>
      </tr>`;
    }).join('');
  }

  function renderDaily(cur) {
    const n = daysInMonth(month);
    const perDay = new Array(n).fill(0);
    for (const e of cur.items) perDay[Number(e.date.slice(8)) - 1] += e.amount;
    const max = Math.max(...perDay, 1);
    $('dailyChart').innerHTML = perDay.map((v, i) => `
      <div class="col" title="${month}-${pad(i + 1)}  ${money(v)}">
        <div class="b" style="height:${(v / max) * 100}%"></div>
        <span class="d">${i + 1}</span>
      </div>`).join('');
  }

  function renderList(cur) {
    const filter = $('filterCat').value;
    const items = cur.items
      .filter((e) => !filter || e.category === filter)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!items.length) {
      $('listBody').innerHTML = '<tr><td colspan="5" class="empty">暂无记录</td></tr>';
      return;
    }
    $('listBody').innerHTML = items.map((e) => `<tr>
      <td>${e.date.slice(5)}</td>
      <td><span class="swatch" style="background:${colorOf(e.category)}"></span>${escapeHtml(e.category)}</td>
      <td>${escapeHtml(e.note || '')}</td>
      <td class="num">${money(e.amount)}</td>
      <td class="num"><button class="del" data-id="${e.id}" title="删除">✕</button></td>
    </tr>`).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  // ---------- CSV ----------
  function csvField(s) {
    s = String(s);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCsv() {
    const rows = [['日期', '分类', '金额', '备注']];
    for (const e of [...expenses].sort((a, b) => a.date.localeCompare(b.date))) {
      rows.push([e.date, e.category, e.amount.toFixed(2), e.note || '']);
    }
    const blob = new Blob(['﻿' + rows.map((r) => r.map(csvField).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'expenses.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function importCsv(text) {
    const rows = parseCsv(text.replace(/^﻿/, ''));
    let added = 0;
    for (const [date, category, amount, note] of rows) {
      const amt = Number(amount);
      if (!/^\d{4}-\d{2}-\d{2}$/.test((date || '').trim()) || !(amt > 0)) continue; // skips header / bad rows
      expenses.push({ id: uid(), date: date.trim(), category: (category || '其他').trim() || '其他', amount: amt, note: (note || '').trim() });
      added++;
    }
    save();
    render();
    alert(`已导入 ${added} 条记录`);
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ---------- events ----------
  function init() {
    const opts = CATEGORIES.map((c) => `<option value="${c.name}">${c.name}</option>`).join('');
    $('fCat').innerHTML = opts;
    $('filterCat').innerHTML += opts;
    $('fDate').value = today();

    $('prevMonth').onclick = () => { month = shiftMonth(month, -1); render(); };
    $('nextMonth').onclick = () => { month = shiftMonth(month, 1); render(); };
    $('monthPicker').onchange = (e) => { if (e.target.value) { month = e.target.value; render(); } };
    $('filterCat').onchange = () => renderList(summarize(month));

    $('form').onsubmit = (ev) => {
      ev.preventDefault();
      const amount = Math.round(Number($('fAmount').value) * 100) / 100;
      if (!(amount > 0)) return;
      const date = $('fDate').value;
      expenses.push({ id: uid(), date, category: $('fCat').value, amount, note: $('fNote').value.trim() });
      save();
      month = ymOf(date);
      $('fAmount').value = '';
      $('fNote').value = '';
      render();
      $('fAmount').focus();
    };

    $('listBody').onclick = (ev) => {
      const btn = ev.target.closest('.del');
      if (!btn || !confirm('删除这条记录？')) return;
      expenses = expenses.filter((e) => e.id !== btn.dataset.id);
      save();
      render();
    };

    $('exportBtn').onclick = exportCsv;
    $('importInput').onchange = (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      file.text().then(importCsv);
      ev.target.value = '';
    };

    render();
  }

  init();
})();
