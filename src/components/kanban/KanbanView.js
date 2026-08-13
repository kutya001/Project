// src/components/kanban/KanbanView.js
import { esc } from '../../utils/dom.js';
import { colorOf } from '../../utils/color.js';
import { fmtD, nowIso } from '../../utils/date.js';
import { cardFields, savePrefs } from '../../core/prefs.js';
import { ENT } from '../../core/state.js';
import { statFor, pri, emp, prj, stg } from '../../services/refs.js';
import { chipHtml } from '../table/renderers.js';
import { matchSearch } from '../table/filters.js';
import { getColDefs } from '../table/colDefs.js';
import { modal } from '../../ui/modal.js';
import { db, refreshAll } from '../../core/db.js';
import { setDbBeacon, afterChange } from '../../utils/logger.js';
import { toast } from '../../ui/toast.js';
import { showContextMenu } from '../../ui/contextMenu.js';
import { getCommonContextMenuItems } from '../../services/quickActions.js';
import { popover, closePop } from '../../ui/popover.js';

function kbGroups(S, ent, by) {
  const unb = { id: null, name: 'Не назначено', color: '#98A2B3' };
  if (by === 'devId') return [...S.employees.filter(e => e.role === 'dev'), unb];
  if (by === 'agentId') return [...S.employees.filter(e => e.role === 'agent'), unb];
  if (by === 'priorityId') return [...S.priorities, unb];
  if (by === 'stageId') return [...S.stages, unb];
  return [...(ent === 'projects' ? S.projectStatuses : S.taskStatuses), unb];
}

export function openCardSettings(S, reRender) {
  const ents = ['projects', 'tasks', 'changes'];
  const NAMES = { num: 'Номер', name: 'Название', dates: 'Даты', status: 'Статус', priority: 'Приоритет', owner: 'Разработчик/Агент', project: 'Проект', stage: 'Этап' };

  modal({
    title: 'Поля карточек',
    sub: 'КАНБАН И ВРЕМЕННАЯ ШКАЛА',
    wide: true,
    body: `<div class="setgrid">${ents.map(ent => {
      const cf = cardFields(S, ent);
      const isAll = cf.list.length === cf.all.length;
      return `<div class="setcard">
        <h3>${ENT[ent].ru}</h3>
        <label class="cb" style="font-weight:700;color:var(--acc);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--line2)"><input type="checkbox" data-all-ent="${ent}" ${isAll ? 'checked' : ''}> <b>Показать / скрыть все</b></label>
        ${cf.all.map(f => `<label class="cb"><input type="checkbox" data-ent="${ent}" data-f="${f}" ${cf.list.includes(f) ? 'checked' : ''}> ${NAMES[f]}</label>`).join('')}
      </div>`;
    }).join('')}</div>`,
    foot: '<button class="btn pri" data-ok>Готово</button>',
    mount(box) {
      box.el.querySelectorAll('input[data-all-ent]').forEach(i => i.onchange = async () => {
        const targetEnt = i.dataset.allEnt;
        const cf = cardFields(S, targetEnt);
        S.prefs.cards[targetEnt] = i.checked ? [...cf.all] : [];
        await savePrefs(S);
        box.el.querySelectorAll(`input[data-ent="${targetEnt}"]`).forEach(cb => cb.checked = i.checked);
      });

      box.el.querySelectorAll('input[data-f]').forEach(i => i.onchange = async () => {
        const targetEnt = i.dataset.ent;
        const l = S.prefs.cards[targetEnt];
        const f = i.dataset.f;
        const newList = i.checked ? [...new Set([...l, f])] : l.filter(x => x !== f);
        S.prefs.cards[targetEnt] = newList;
        await savePrefs(S);
        const cf = cardFields(S, targetEnt);
        const allChk = box.el.querySelector(`input[data-all-ent="${targetEnt}"]`);
        if (allChk) {
          allChk.checked = newList.length === cf.all.length;
        }
      });
      box.el.querySelector('[data-ok]').onclick = () => {
        box.close();
        if (reRender) reRender();
      };
    }
  });
}

const SORT_OPTIONS = [
  { k: '', label: 'По умолчанию' },
  { k: 'name', label: 'По названию' },
  { k: 'num', label: 'По коду / номеру' },
  { k: 'start', label: 'По дате начала' },
  { k: 'end', label: 'По дате окончания' },
  { k: 'priorityId', label: 'По приоритету' },
  { k: 'statusId', label: 'По статусу' },
  { k: 'createdAt', label: 'По дате создания' }
];

export function renderKanbanView(S, ent, mount, callbacks = {}) {
  const coldefs = getColDefs(S);
  const opts = ent === 'projects'
    ? [['statusId', 'Статус'], ['priorityId', 'Приоритет'], ['stageId', 'Этап'], ['devId', 'Разработчик (гл.)'], ['agentId', 'Агент (гл.)']]
    : [['statusId', 'Статус'], ['priorityId', 'Приоритет'], ['devId', 'Разработчик (гл.)'], ['agentId', 'Агент (гл.)']];

  const by = S.prefs.kanbanGroup[ent] || 'statusId';
  let groups = kbGroups(S, ent, by);

  // Apply custom column order if saved
  S.prefs.kanbanColOrder = S.prefs.kanbanColOrder || {};
  const colOrderKey = `${ent}_${by}`;
  const savedColOrder = S.prefs.kanbanColOrder[colOrderKey];
  if (Array.isArray(savedColOrder) && savedColOrder.length) {
    groups.sort((a, b) => {
      const ia = savedColOrder.indexOf(String(a.id ?? '__null'));
      const ib = savedColOrder.indexOf(String(b.id ?? '__null'));
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return 0;
    });
  }

  S.prefs.kanbanColSort = S.prefs.kanbanColSort || {};
  S.prefs.kanbanCardOrder = S.prefs.kanbanCardOrder || {};

  let rows = S[ent].filter(r => matchSearch(S, coldefs, ent, r));
  const cf = cardFields(S, ent);

  const colsHtml = groups.map(g => {
    const gidStr = String(g.id ?? '__null');
    const colKey = `${ent}_${by}_${gidStr}`;
    const colSort = S.prefs.kanbanColSort[colKey] || { field: '', dir: 'asc' };
    const savedCardOrder = S.prefs.kanbanCardOrder[colKey] || [];

    let items = rows.filter(r => (r[by] ?? null) === (g.id ?? null));

    if (colSort.field) {
      const f = colSort.field;
      const mult = colSort.dir === 'desc' ? -1 : 1;
      items.sort((a, b) => {
        let va = a[f] ?? '';
        let vb = b[f] ?? '';
        if (typeof va === 'string') return va.localeCompare(vb, 'ru', { numeric: true }) * mult;
        return (va < vb ? -1 : va > vb ? 1 : 0) * mult;
      });
    } else if (savedCardOrder.length) {
      items.sort((a, b) => {
        const ia = savedCardOrder.indexOf(a.id);
        const ib = savedCardOrder.indexOf(b.id);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return 0;
      });
    }

    const cards = items.slice(0, 200).map(r => {
      const st = statFor(S, ent, r.statusId);
      const pr = pri(S, r.priorityId);
      const dv = emp(S, r.devId);
      const ag = emp(S, r.agentId);
      const pj = prj(S, r.projectId);
      const sg = stg(S, r.stageId);
      const own = by === 'devId' || by === 'agentId' ? emp(S, r[by]) : (dv || ag);

      let parts = '';
      if (cf.list.includes('num')) parts += `<div class="kn">${esc(r.num)}</div>`;
      if (cf.list.includes('name')) parts += `<div class="kt">${esc(r.name)}</div>`;
      let chips = '';
      if (cf.list.includes('status') && st) chips += chipHtml(st.name, colorOf(st));
      if (cf.list.includes('priority') && pr) chips += chipHtml(pr.name, colorOf(pr));
      if (cf.list.includes('stage') && sg) chips += chipHtml(sg.name, colorOf(sg));
      if (chips) parts += `<div class="krow">${chips}</div>`;
      if (cf.list.includes('dates') && (r.start || r.createdAt)) {
        const sDate = r.start || r.createdAt?.slice(0, 10);
        const eDate = r.end || sDate;
        parts += `<div class="krow"><span class="kdate">📅 ${fmtD(sDate)} → ${fmtD(eDate)}</span></div>`;
      }
      if (cf.list.includes('owner') && own && by !== 'devId' && by !== 'agentId') parts += `<div class="krow">${chipHtml(own.name, colorOf(own))}</div>`;
      if (cf.list.includes('project') && pj && ent !== 'projects') parts += `<div class="kprj">▤ ${esc(pj.name)}</div>`;

      return `<div class="kcard" draggable="true" data-id="${r.id}" data-colgid="${gidStr}" style="border-left:3px solid ${colorOf(st || pr || '#999')}">${parts}</div>`;
    }).join('');

    const sortIcon = colSort.field ? (colSort.dir === 'desc' ? '⬇' : '⬆') : '⇅';
    const sortFieldLabel = SORT_OPTIONS.find(o => o.k === colSort.field)?.label || '';

    return `<div class="kb-col" data-gid="${gidStr}" style="--kc:${colorOf(g)}">
      <div class="kb-h" draggable="true" data-colgid="${gidStr}">
        <span class="col-drag-handle" title="Зажмите и тяните для перемещения колонки" style="cursor:grab;color:var(--mut2);font-weight:700;margin-right:2px">⋮⋮</span>
        <span class="dot" style="background:${colorOf(g)}"></span>
        <b>${esc(g.name)}</b>
        <span class="n">${items.length}</span>
        <button class="btn sm col-sort-btn ${colSort.field ? 'active-sort' : ''}" data-colsortgid="${gidStr}" title="Сортировка карточек в колонке: ${esc(sortFieldLabel || 'По умолчанию')}" style="padding:2px 6px;margin-left:auto;font-size:11px;background:var(--bg);border:1px solid var(--line2)">
          ${sortIcon}
        </button>
      </div>
      <div class="kb-body" data-colgid="${gidStr}">${cards || '<div style="color:var(--mut2);font-size:12px;text-align:center;padding:16px">пусто</div>'}</div>
    </div>`;
  }).join('');

  mount.innerHTML = `<div class="panel" style="padding:14px;background:transparent;border:none;box-shadow:none">
    <div class="toolbar panel" style="margin-bottom:12px">
      <span style="font-size:12px;color:var(--mut);font-weight:700;letter-spacing:.06em;text-transform:uppercase">Группировка</span>
      <div class="seg" id="kbSeg">${opts.map(o => `<button data-by="${o[0]}" class="${o[0] === by ? 'on' : ''}">${o[1]}</button>`).join('')}</div>
      <div class="sp"></div>
      <button class="btn sm" data-cards>⚙ Поля карточек</button>
    </div>
    <div class="kb">${colsHtml}</div></div>`;

  const reRender = () => renderKanbanView(S, ent, mount, callbacks);

  mount.querySelector('[data-cards]').onclick = () => openCardSettings(S, reRender);
  mount.querySelectorAll('#kbSeg button').forEach(b => b.onclick = async () => {
    S.prefs.kanbanGroup[ent] = b.dataset.by;
    await savePrefs(S);
    reRender();
  });

  // Per-column sort popover
  mount.querySelectorAll('.col-sort-btn').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const colGid = btn.dataset.colsortgid;
      const colKey = `${ent}_${by}_${colGid}`;
      const colSort = S.prefs.kanbanColSort[colKey] || { field: '', dir: 'asc' };

      popover(btn, `
        <div class="pt">Сортировка колонки</div>
        <div style="display:flex;flex-direction:column;gap:4px;max-height:260px;overflow:auto;margin-bottom:8px">
          ${SORT_OPTIONS.map(o => `<label class="pi" style="cursor:pointer;display:flex;align-items:center;gap:8px">
            <input type="radio" name="colkbsort" value="${o.k}" ${colSort.field === o.k ? 'checked' : ''}>
            <span>${o.label}</span>
          </label>`).join('')}
        </div>
        <div style="border-top:1px solid var(--line2);padding-top:8px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11px;color:var(--mut)">Порядок:</span>
          <button class="btn sm" id="btnToggleColDir" style="padding:3px 8px">${colSort.dir === 'desc' ? '⬇ По убыванию' : '⬆ По возрастанию'}</button>
        </div>
      `, p => {
        let currentDir = colSort.dir;
        const dirBtn = p.querySelector('#btnToggleColDir');
        if (dirBtn) {
          dirBtn.onclick = async () => {
            currentDir = currentDir === 'asc' ? 'desc' : 'asc';
            dirBtn.textContent = currentDir === 'desc' ? '⬇ По убыванию' : '⬆ По возрастанию';
            S.prefs.kanbanColSort[colKey] = { field: colSort.field, dir: currentDir };
            await savePrefs(S);
            closePop();
            reRender();
          };
        }
        p.querySelectorAll('input[name="colkbsort"]').forEach(input => {
          input.onchange = async () => {
            S.prefs.kanbanColSort[colKey] = { field: input.value, dir: currentDir };
            await savePrefs(S);
            closePop();
            reRender();
          };
        });
      });
    };
  });

  // Cards interaction & Drag/Drop
  mount.querySelectorAll('.kcard').forEach(c => {
    const id = +c.dataset.id;
    c.onclick = () => { if (callbacks.onView) callbacks.onView(ent, id); };
    c.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/kid', id);
      e.dataTransfer.setData('text/fromcolgid', c.dataset.colgid);
      c.classList.add('drag');
    });
    c.addEventListener('dragend', () => {
      c.classList.remove('drag');
      mount.querySelectorAll('.kcard').forEach(card => card.classList.remove('over-card-top', 'over-card-bottom'));
    });

    c.addEventListener('dragover', e => {
      if (e.dataTransfer.types.includes('text/kid')) {
        e.preventDefault();
        e.stopPropagation();
        const rect = c.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          c.classList.add('over-card-top');
          c.classList.remove('over-card-bottom');
        } else {
          c.classList.add('over-card-bottom');
          c.classList.remove('over-card-top');
        }
      }
    });

    c.addEventListener('dragleave', () => {
      c.classList.remove('over-card-top', 'over-card-bottom');
    });

    c.addEventListener('drop', async e => {
      if (e.dataTransfer.types.includes('text/kid')) {
        e.preventDefault();
        e.stopPropagation();
        c.classList.remove('over-card-top', 'over-card-bottom');

        const draggedId = +e.dataTransfer.getData('text/kid');
        const targetId = +c.dataset.id;
        const targetColGid = c.dataset.colgid;
        if (!draggedId || draggedId === targetId) return;

        const draggedItem = S[ent].find(x => x.id === draggedId);
        if (!draggedItem) return;

        // If card was moved to a different column group
        const targetGidVal = targetColGid !== '__null' ? +targetColGid : null;
        if ((draggedItem[by] ?? null) !== targetGidVal) {
          draggedItem[by] = targetGidVal;
          draggedItem.updatedAt = nowIso();
          try {
            await db[ent].put(draggedItem);
          } catch (err) {
            console.error('Error updating item group', err);
          }
        }

        // Reorder cards in target column
        const targetColKey = `${ent}_${by}_${targetColGid}`;
        let colCards = (S.prefs.kanbanCardOrder[targetColKey] || []).filter(x => x !== draggedId);

        // If no custom order stored yet, initialize from current DOM/items order
        if (!colCards.length) {
          const colItems = S[ent].filter(r => matchSearch(S, coldefs, ent, r) && (r[by] ?? null) === targetGidVal);
          colCards = colItems.map(x => x.id).filter(x => x !== draggedId);
        }

        const rect = c.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const targetIdx = colCards.indexOf(targetId);
        const insertIdx = e.clientY < midY ? Math.max(0, targetIdx) : targetIdx + 1;

        if (targetIdx !== -1) {
          colCards.splice(insertIdx, 0, draggedId);
        } else {
          colCards.push(draggedId);
        }

        S.prefs.kanbanCardOrder[targetColKey] = colCards;
        await savePrefs(S);
        await refreshAll(S);
        await afterChange(S, callbacks.autoSave);
        toast('Порядок карточек обновлен', 'ok');
        reRender();
      }
    });

    const triggerCtx = (clientX, clientY) => {
      const items = getCommonContextMenuItems(S, ent, id, callbacks, reRender);
      showContextMenu({
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX,
        clientY
      }, items);
    };

    c.oncontextmenu = e => {
      e.preventDefault();
      e.stopPropagation();
      triggerCtx(e.clientX, e.clientY);
    };

    let touchTimer = null;
    c.ontouchstart = e => {
      if (e.touches.length > 1) return;
      const touch = e.touches[0];
      touchTimer = setTimeout(() => {
        triggerCtx(touch.clientX, touch.clientY);
      }, 500);
    };
    c.ontouchend = () => { if (touchTimer) clearTimeout(touchTimer); };
    c.ontouchmove = () => { if (touchTimer) clearTimeout(touchTimer); };
  });

  // Columns Drag & Drop + Column level drop target
  mount.querySelectorAll('.kb-col').forEach(colEl => {
    const colHeader = colEl.querySelector('.kb-h');
    if (colHeader) {
      colHeader.addEventListener('dragstart', e => {
        const colGid = colHeader.dataset.colgid;
        e.dataTransfer.setData('text/colgid', colGid);
        colEl.classList.add('dragging-col');
      });
      colHeader.addEventListener('dragend', () => {
        colEl.classList.remove('dragging-col');
      });
    }

    colEl.addEventListener('dragover', e => {
      if (e.dataTransfer.types.includes('text/colgid')) {
        e.preventDefault();
        colEl.classList.add('over-col');
      } else if (e.dataTransfer.types.includes('text/kid')) {
        e.preventDefault();
        colEl.classList.add('over');
      }
    });

    colEl.addEventListener('dragleave', () => {
      colEl.classList.remove('over-col');
      colEl.classList.remove('over');
    });

    colEl.addEventListener('drop', async e => {
      e.preventDefault();
      colEl.classList.remove('over-col');
      colEl.classList.remove('over');

      const fromColGid = e.dataTransfer.getData('text/colgid');
      if (fromColGid) {
        const toColGid = colEl.dataset.gid;
        if (fromColGid !== toColGid) {
          let curOrder = groups.map(grp => String(grp.id ?? '__null'));
          const fromIdx = curOrder.indexOf(fromColGid);
          const toIdx = curOrder.indexOf(toColGid);
          if (fromIdx !== -1 && toIdx !== -1) {
            curOrder.splice(fromIdx, 1);
            curOrder.splice(toIdx, 0, fromColGid);
            S.prefs.kanbanColOrder = S.prefs.kanbanColOrder || {};
            S.prefs.kanbanColOrder[colOrderKey] = curOrder;
            await savePrefs(S);
            toast('Порядок колонок обновлен', 'ok');
            reRender();
          }
        }
        return;
      }

      const id = +e.dataTransfer.getData('text/kid');
      if (!id) return;
      const r = S[ent].find(x => x.id === id);
      if (!r) return;
      const targetGid = colEl.dataset.gid;
      const gidVal = targetGid !== '__null' ? +targetGid : null;

      r[by] = gidVal;
      r.updatedAt = nowIso();

      const targetColKey = `${ent}_${by}_${targetGid}`;
      let colCards = (S.prefs.kanbanCardOrder[targetColKey] || []).filter(x => x !== id);
      colCards.push(id);
      S.prefs.kanbanCardOrder[targetColKey] = colCards;

      try {
        await db[ent].put(r);
        await savePrefs(S);
        await refreshAll(S);
        await afterChange(S, callbacks.autoSave);
        toast(`«${r.name}» перемещен(а)`, 'ok');
        reRender();
      } catch (err) {
        setDbBeacon('error', '🔴 Ошибка базы данных');
        toast('Ошибка записи: ' + err.message, 'err');
      }
    });
  });
}
