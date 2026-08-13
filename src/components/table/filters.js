// src/components/table/filters.js
import { esc } from '../../utils/dom.js';
import { colorOf } from '../../utils/color.js';
import { popover, closePop } from '../../ui/popover.js';
import { savePrefs } from '../../core/prefs.js';
import { colVal, dirItem } from './renderers.js';

export function matchSearch(S, coldefs, ent, r) {
  if (!S.search) return true;
  const q = S.search.toLowerCase();
  return coldefs[ent].some(c => String(colVal(S, ent, r, c.k) ?? '').toLowerCase().includes(q));
}

export function applyFilters(S, coldefs, ent, rows, st) {
  return rows.filter(r => {
    for (const k in st.filters) {
      const f = st.filters[k];
      const cdef = coldefs[ent].find(c => c.k === k);
      if (!cdef || !f) continue;

      if (f.type === 'sel') {
        const raw = r[k];
        if (Array.isArray(raw)) {
          if (!raw.some(v => f.sel.includes(v))) return false;
        } else if (!f.sel.includes(raw ?? null)) return false;
      } else if (f.type === 'date') {
        const v = r[k];
        if (!v) return false;
        if (f.from && v < f.from) return false;
        if (f.to && v > f.to) return false;
      } else if (f.type === 'txt') {
        if (!String(colVal(S, ent, r, k) ?? '').toLowerCase().includes(f.q.toLowerCase())) return false;
      }
    }
    return true;
  });
}

export function sortRows(S, coldefs, ent, rows, st) {
  if (!st.sort || !st.sort.k) return rows;
  const cdef = coldefs[ent].find(c => c.k === st.sort.k);
  const dir = st.sort.d || 1;

  return [...rows].sort((a, b) => {
    let va, vb;
    if (cdef && cdef.type === 'select') {
      va = (dirItem(cdef, a[st.sort.k]) || {}).name || '';
      vb = (dirItem(cdef, b[st.sort.k]) || {}).name || '';
    } else {
      va = colVal(S, ent, a, st.sort.k);
      vb = colVal(S, ent, b, st.sort.k);
    }
    if (va == null || va === '') return 1;
    if (vb == null || vb === '') return -1;
    if (cdef && (cdef.type === 'date' || cdef.type === 'number')) return (va > vb ? 1 : va < vb ? -1 : 0) * dir;
    return String(va).localeCompare(String(vb), 'ru') * dir;
  });
}

export function openColFilter(S, coldefs, ent, st, k, anchor, onRender) {
  const cdef = coldefs[ent].find(c => c.k === k);
  const cur = st.filters[k];
  let html = '';

  if (cdef.type === 'select' || cdef.type === 'multi') {
    const opts = cdef.type === 'multi'
      ? S.employees.filter(e => e.role === cdef.role)
      : (cdef.dir ? cdef.dir() : []);
    const sel = cur && cur.type === 'sel' ? cur.sel : [];
    html = `<div class="pt">Фильтр: ${esc(cdef.label)}</div>
      <div style="max-height:260px;overflow:auto;min-width:210px">
      ${opts.map(o => `<label class="pi"><input type="checkbox" value="${o.id}" ${sel.includes(o.id) ? 'checked' : ''}><span class="dot" style="background:${colorOf(o)}"></span>${esc(o.name)}</label>`).join('') || '<div style="color:var(--mut2);font-size:12px">нет значений</div>'}
      </div>
      <div class="pact"><button class="btn sm" data-ap>Применить</button><button class="btn sm" data-rs>Сбросить</button></div>`;
  } else if (cdef.type === 'date') {
    html = `<div class="pt">Фильтр по дате: ${esc(cdef.label)}</div>
      <label class="fl">С</label><input type="date" id="ffrom" value="${cur?.from || ''}">
      <label class="fl" style="margin-top:8px">По</label><input type="date" id="fto" value="${cur?.to || ''}">
      <div class="pact"><button class="btn sm" data-ap>Применить</button><button class="btn sm" data-rs>Сбросить</button></div>`;
  } else {
    html = `<div class="pt">Фильтр: ${esc(cdef.label)}</div>
      <input type="text" id="ftxt" placeholder="содержит…" value="${esc(cur?.q || '')}">
      <div class="pact"><button class="btn sm" data-ap>Применить</button><button class="btn sm" data-rs>Сбросить</button></div>`;
  }

  popover(anchor, html, async p => {
    p.querySelector('[data-rs]').onclick = async () => {
      delete st.filters[k];
      await savePrefs(S);
      closePop();
      if (onRender) onRender();
    };

    const apply = async () => {
      if (cdef.type === 'select' || cdef.type === 'multi') {
        const sel = [...p.querySelectorAll('input:checked')].map(i => +i.value);
        if (sel.length) st.filters[k] = { type: 'sel', sel };
        else delete st.filters[k];
      } else if (cdef.type === 'date') {
        const from = p.querySelector('#ffrom').value, to = p.querySelector('#fto').value;
        if (from || to) st.filters[k] = { type: 'date', from, to };
        else delete st.filters[k];
      } else {
        const q = p.querySelector('#ftxt').value.trim();
        if (q) st.filters[k] = { type: 'txt', q };
        else delete st.filters[k];
      }
      await savePrefs(S);
      closePop();
      if (onRender) onRender();
    };

    p.querySelector('[data-ap]').onclick = apply;
    const tx = p.querySelector('#ftxt');
    if (tx) tx.onkeydown = e => { if (e.key === 'Enter') apply(); };
  });
}
