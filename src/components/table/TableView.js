// src/components/table/TableView.js
import { esc } from '../../utils/dom.js';
import { tblState, savePrefs } from '../../core/prefs.js';
import { EXP, ROWCAP } from '../../core/state.js';
import { getColDefs, DEFAULT_HIDDEN } from './colDefs.js';
import { cellHtml } from './renderers.js';
import { matchSearch, applyFilters, sortRows, openColFilter } from './filters.js';
import { subRowHtml } from './subRows.js';
import { popover } from '../../ui/popover.js';
import { showContextMenu } from '../../ui/contextMenu.js';
import { toast } from '../../ui/toast.js';
import { getCommonContextMenuItems } from '../../services/quickActions.js';

const FUNNEL = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18l-7 8v5l-4 2v-7L3 5z"/></svg>';
const ROWCAP_ALL = {};

export function renderTableView(S, ent, mount, callbacks = {}) {
  const coldefs = getColDefs(S);
  const tid = ent;
  const allKeys = (coldefs[ent] || []).map(c => c.k);
  const st = tblState(S, tid, allKeys);
  st.widths = st.widths || {};

  if (!st.hidden.length && !st.order.length && DEFAULT_HIDDEN[ent]) {
    st.hidden = [...DEFAULT_HIDDEN[ent]];
  }
  const visKeys = st.order.filter(k => !st.hidden.includes(k));

  let rows = (S[ent] || []).filter(r => matchSearch(S, coldefs, ent, r));
  rows = applyFilters(S, coldefs, ent, rows, st);
  rows = sortRows(S, coldefs, ent, rows, st);

  const canExp = ent === 'projects' || ent === 'tasks';
  const head = visKeys.map(k => {
    const c = coldefs[ent].find(c => c.k === k) || { label: k };
    const f = st.filters[k];
    const arrow = st.sort && st.sort.k === k ? (st.sort.d > 0 ? '<span class="sarr">▲</span>' : '<span class="sarr">▼</span>') : '';
    const w = st.widths[k] || c.w;
    const wStyle = w ? `width:${w}px;min-width:${w}px` : '';

    return `<th class="th" data-k="${k}" draggable="true" style="${wStyle}">
      <div class="thc">
        <span class="lbl">${esc(c.label)}</span>${arrow}
        <button class="fbtn ${f ? 'on' : ''}" data-f="${k}" title="Фильтр">${FUNNEL}</button>
      </div>
      <div class="col-resizer" data-k="${k}"></div>
    </th>`;
  }).join('');

  const isCapAll = ROWCAP_ALL[ent];
  const limited = !isCapAll && rows.length > ROWCAP;
  const shown = limited ? rows.slice(0, ROWCAP) : rows;

  const body = shown.map(r => {
    const expBtn = canExp ? `<button class="exp ${EXP[ent].has(r.id) ? 'open' : ''}" data-exp="${r.id}">▶</button>` : '';
    const cells = visKeys.map(k => {
      const cdef = coldefs[ent].find(c => c.k === k) || { k };
      const w = st.widths[k] || cdef.w;
      const wStyle = w ? `width:${w}px;max-width:${w}px` : '';
      return `<td style="${wStyle}">${cellHtml(S, ent, cdef, r)}</td>`;
    }).join('');
    let extra = '';
    if (canExp && EXP[ent].has(r.id)) extra = subRowHtml(S, coldefs, ent, r);

    return `<tr class="rw" data-id="${r.id}">${canExp ? `<td>${expBtn}</td>` : ''}${cells}<td style="white-space:nowrap;width:88px;text-align:right">
      <button class="ibtn" data-act="view" title="Просмотр"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>
      <button class="ibtn" data-act="edit" title="Редактировать"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
      <button class="ibtn" data-act="del" title="Удалить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg></button>
    </td></tr>${extra}`;
  }).join('');

  mount.innerHTML = `<div class="panel">
    <div class="toolbar">
      <span style="font-size:12.5px;color:var(--mut)">Показано <b class="mono" style="color:var(--ink)">${shown.length}</b> из <b class="mono" style="color:var(--ink)">${rows.length}</b>${Object.keys(st.filters).length ? ` · фильтров: ${Object.keys(st.filters).length} <button class="btn sm" data-clrf>сбросить</button>` : ''}</span>
      <div class="sp"></div>
      <button class="btn sm" data-cols>⚙ Столбцы</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr>${canExp ? '<th style="width:30px"></th>' : ''}${head}<th style="width:88px"></th></tr></thead>
      <tbody>${body || `<tr><td colspan="${visKeys.length + (canExp ? 2 : 1)}" style="padding:34px;text-align:center;color:var(--mut2)">Нет записей${S.search ? ' по запросу «' + esc(S.search) + '»' : ''}</td></tr>`}</tbody>
    </table></div>
    ${limited ? `<div style="padding:10px 14px;border-top:1px solid var(--line2)"><button class="btn sm" data-all>Показать все (${rows.length})</button></div>` : ''}
  </div>`;

  const reRender = () => renderTableView(S, ent, mount, callbacks);

  const colsBtn = mount.querySelector('[data-cols]');
  if (colsBtn) {
    colsBtn.onclick = e => {
      const allChecked = allKeys.every(k => !st.hidden.includes(k));
      popover(e.currentTarget, `<div class="pt">Видимость и порядок столбцов</div>
        <div style="padding:6px 0;border-bottom:1px solid var(--line2);margin-bottom:6px">
          <label class="pi" style="font-weight:700;color:var(--acc)"><input type="checkbox" id="chkAllCols" ${allChecked ? 'checked' : ''}> <b>Показать / скрыть все поля</b></label>
        </div>
        <div style="max-height:300px;overflow:auto">${allKeys.map(k => {
          const c = coldefs[ent].find(c => c.k === k) || { label: k };
          return `<label class="pi"><input type="checkbox" data-col="${k}" ${st.hidden.includes(k) ? '' : 'checked'}> ${esc(c.label)}</label>`;
        }).join('')}</div>
        <div style="font-size:11px;color:var(--mut);margin-top:8px">Перетаскивайте заголовки для смены порядка или тяните края для изменения ширины.</div>`,
        p => {
          const chkAll = p.querySelector('#chkAllCols');
          if (chkAll) {
            chkAll.onchange = async () => {
              const isChecked = chkAll.checked;
              st.hidden = isChecked ? [] : [...allKeys];
              p.querySelectorAll('input[data-col]').forEach(input => {
                input.checked = isChecked;
              });
              await savePrefs(S);
              reRender();
            };
          }
          p.querySelectorAll('input[data-col]').forEach(i => i.onchange = async () => {
            const k = i.dataset.col;
            st.hidden = i.checked ? st.hidden.filter(x => x !== k) : [...st.hidden, k];
            if (chkAll) {
              chkAll.checked = allKeys.every(key => !st.hidden.includes(key));
            }
            await savePrefs(S);
            reRender();
          });
        });
    };
  }

  const clrf = mount.querySelector('[data-clrf]');
  if (clrf) clrf.onclick = async () => { st.filters = {}; await savePrefs(S); reRender(); };

  const allBtn = mount.querySelector('[data-all]');
  if (allBtn) allBtn.onclick = () => { ROWCAP_ALL[ent] = true; reRender(); };

  mount.querySelectorAll('.fbtn').forEach(b => b.onclick = e => {
    e.stopPropagation();
    openColFilter(S, coldefs, ent, st, b.dataset.f, b, reRender);
  });

  // Column Resizing logic (Mouse & Touch)
  mount.querySelectorAll('.col-resizer').forEach(resizer => {
    const startResize = (clientX) => {
      const colKey = resizer.dataset.k;
      const th = resizer.closest('th');
      const startX = clientX;
      const startWidth = th.offsetWidth;
      resizer.classList.add('resizing');

      const onMove = ev => {
        const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const diff = cx - startX;
        const newW = Math.max(45, startWidth + diff);
        th.style.width = `${newW}px`;
        th.style.minWidth = `${newW}px`;
        st.widths[colKey] = newW;
      };

      const onEnd = async () => {
        resizer.classList.remove('resizing');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        await savePrefs(S);
        reRender();
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    };

    resizer.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();
      startResize(e.clientX);
    });

    resizer.addEventListener('touchstart', e => {
      e.stopPropagation();
      if (e.touches.length === 1) {
        startResize(e.touches[0].clientX);
      }
    }, { passive: false });
  });

  // Sort & Drag logic
  mount.querySelectorAll('.th').forEach(th => {
    th.addEventListener('click', e => {
      if (e.target.closest('.fbtn') || e.target.closest('.col-resizer')) return;
      const k = th.dataset.k;
      if (st.sort && st.sort.k === k) {
        st.sort.d = -st.sort.d;
      } else {
        st.sort = { k, d: 1 };
      }
      savePrefs(S);
      reRender();
    });
    th.addEventListener('dragstart', e => {
      if (e.target.classList.contains('col-resizer')) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData('text/col', th.dataset.k);
    });
    th.addEventListener('dragover', e => e.preventDefault());
    th.addEventListener('drop', async e => {
      e.preventDefault();
      const from = e.dataTransfer.getData('text/col');
      const to = th.dataset.k;
      if (!from || from === to) return;
      st.order = st.order.filter(k => k !== from);
      st.order.splice(st.order.indexOf(to), 0, from);
      await savePrefs(S);
      reRender();
    });
  });

  mount.querySelectorAll('[data-exp]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const id = +b.dataset.exp;
    EXP[ent].has(id) ? EXP[ent].delete(id) : EXP[ent].add(id);
    reRender();
  });

  // Row Click & Right-click Context Menu
  mount.querySelectorAll('tr.rw').forEach(tr => {
    const id = +tr.dataset.id;
    const rowItem = (S[ent] || []).find(x => x.id === id);

    // Left click
    tr.onclick = e => {
      const act = e.target.closest('[data-act]');
      if (act) {
        e.stopPropagation();
        const action = act.dataset.act;
        if (action === 'view' && callbacks.onView) callbacks.onView(ent, id);
        if (action === 'edit' && callbacks.onEdit) callbacks.onEdit(ent, id);
        if (action === 'del' && callbacks.onDelete) callbacks.onDelete(ent, id);
        return;
      }
      if (callbacks.onView) callbacks.onView(ent, id);
    };

    // Right click Context Menu (ПКМ) & Touch Long Press
    const triggerCtx = (eClientX, eClientY) => {
      if (!rowItem) return;
      const items = getCommonContextMenuItems(S, ent, id, callbacks, reRender);
      showContextMenu({
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX: eClientX,
        clientY: eClientY
      }, items);
    };

    tr.oncontextmenu = e => {
      e.preventDefault();
      triggerCtx(e.clientX, e.clientY);
    };

    let touchTimer = null;
    tr.ontouchstart = e => {
      if (e.touches.length > 1) return;
      const touch = e.touches[0];
      touchTimer = setTimeout(() => {
        triggerCtx(touch.clientX, touch.clientY);
      }, 500);
    };
    tr.ontouchend = () => { if (touchTimer) clearTimeout(touchTimer); };
    tr.ontouchmove = () => { if (touchTimer) clearTimeout(touchTimer); };
  });
}

