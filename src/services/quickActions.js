// src/services/quickActions.js
import { nowIso } from '../utils/date.js';
import { modal } from '../ui/modal.js';
import { db, refreshAll } from '../core/db.js';
import { setDbBeacon, afterChange } from '../utils/logger.js';
import { toast } from '../ui/toast.js';
import { esc } from '../utils/dom.js';
import { openTaskForm } from '../pages/forms/TaskForm.js';
import { openChangeForm } from '../pages/forms/ChangeForm.js';
import { renderColorOptions, setupColorSelects } from '../utils/colorSelect.js';

export async function duplicateRecord(S, ent, id, autoSave) {
  const item = (S[ent] || []).find(x => x.id === id);
  if (!item) {
    toast('Запись не найдена', 'err');
    return null;
  }

  const copy = JSON.parse(JSON.stringify(item));
  delete copy.id;
  copy.name = `${copy.name} (копия)`;
  copy.createdAt = nowIso();
  copy.updatedAt = nowIso();

  if (ent === 'projects') {
    S.counters.p++;
    copy.num = 'P-' + String(S.counters.p).padStart(3, '0');
  } else if (ent === 'tasks') {
    S.counters.t++;
    copy.num = 'T-' + String(S.counters.t).padStart(3, '0');
  } else if (ent === 'changes') {
    S.counters.c++;
    copy.num = 'C-' + String(S.counters.c).padStart(3, '0');
  }

  try {
    const newId = await db[ent].add(copy);
    await db.meta.put({ key: 'counters', value: S.counters });
    await refreshAll(S);
    await afterChange(S, autoSave);
    toast(`Запись «${copy.name}» продублирована`, 'ok');
    return newId;
  } catch (err) {
    setDbBeacon('error', '🔴 Ошибка базы данных');
    toast('Ошибка при дублировании: ' + err.message, 'err');
    return null;
  }
}

export function openQuickChangeModal(S, ent, id, callbacks = {}) {
  const list = S[ent] || [];
  const r = list.find(x => x.id === id);
  if (!r) return;

  const isMain = ['projects', 'tasks', 'changes'].includes(ent);
  const isEmp = ent === 'employees';
  const isStatus = ent === 'projectStatuses' || ent === 'taskStatuses';
  const isPriority = ent === 'priorities';
  const isStage = ent === 'stages';

  const statuses = ent === 'projects' ? S.projectStatuses : S.taskStatuses;
  const devsList = S.employees.filter(e => e.role === 'dev') || [];
  const agentsList = S.employees.filter(e => e.role === 'agent') || [];

  let body = '<form id="quickForm" class="fgrid">';

  if (isMain) {
    const hasStage = ent === 'projects';
    body += `
      <div><label class="fl">Статус</label><select name="statusId">${renderColorOptions(statuses, r.statusId)}</select></div>
      <div><label class="fl">Приоритет</label><select name="priorityId">${renderColorOptions(S.priorities, r.priorityId)}</select></div>
      ${hasStage ? `<div><label class="fl">Текущий этап</label><select name="stageId">${renderColorOptions(S.stages, r.stageId, '— Не выбран —')}</select></div>` : ''}
      <div><label class="fl">Ответственный разработчик</label><select name="devId">${renderColorOptions(devsList, r.devId, '— Не назначен —')}</select></div>
      <div><label class="fl">Ответственный агент</label><select name="agentId">${renderColorOptions(agentsList, r.agentId, '— Не назначен —')}</select></div>
      ${hasStage ? `<div class="full"><label class="fl">Прогресс по этапам (%)</label>
        <div class="stageed">${S.stages.map(st => {
          const val = r.stageProgress ? (r.stageProgress[st.id] || 0) : 0;
          return `<div class="sr"><span>${esc(st.name)}</span><input type="range" min="0" max="100" data-sp="${st.id}" value="${val}"><span class="pv" id="qspv-${st.id}">${val}%</span></div>`;
        }).join('') || '<div>Этапы не заведены</div>'}</div>
      </div>` : ''}
    `;
  } else if (isEmp) {
    body += `
      <div><label class="fl">Роль</label><select name="role">
        <option value="dev" ${r.role === 'dev' ? 'selected' : ''}>Разработчик</option>
        <option value="agent" ${r.role === 'agent' ? 'selected' : ''}>Агент AI</option>
        <option value="pm" ${r.role === 'pm' ? 'selected' : ''}>Менеджер проекта</option>
      </select></div>
      <div><label class="fl">Цвет плашки</label><input type="color" name="color" value="${r.color || '#2B6CB0'}" style="height:38px;padding:2px;cursor:pointer;width:100%"></div>
      <div class="full"><label class="fl">Должность / Специализация</label><input type="text" name="position" value="${esc(r.position || '')}"></div>
    `;
  } else if (isStatus || isPriority || isStage) {
    body += `
      <div class="full"><label class="fl">Название</label><input type="text" name="name" value="${esc(r.name || '')}"></div>
      <div><label class="fl">Цвет</label><input type="color" name="color" value="${r.color || '#2B6CB0'}" style="height:38px;padding:2px;cursor:pointer;width:100%"></div>
      ${isPriority ? `<div><label class="fl">Вес (приоритет)</label><input type="number" name="weight" value="${r.weight || 0}"></div>` : ''}
    `;
  } else {
    body += `<div class="full"><label class="fl">Название</label><input type="text" name="name" value="${esc(r.name || '')}"></div>`;
  }

  body += '</form>';

  modal({
    title: `Быстрая смена параметров`,
    sub: r.num ? `${r.num} · ${r.name}` : r.name,
    wide: false,
    body,
    foot: `<button class="btn" data-x>Отмена</button><button class="btn pri" data-save>Сохранить</button>`,
    mount(box) {
      setupColorSelects(box.el);
      const stageSel = box.el.querySelector('select[name="stageId"]');
      box.el.querySelectorAll('input[data-sp]').forEach(rng => rng.oninput = () => {
        const pv = box.el.querySelector('#qspv-' + rng.dataset.sp);
        if (pv) pv.textContent = rng.value + '%';

        if (+rng.value === 100 && stageSel && S.stages && S.stages.length) {
          const spId = +rng.dataset.sp;
          if (!stageSel.value || +stageSel.value === spId) {
            const idx = S.stages.findIndex(st => st.id === spId);
            if (idx !== -1 && idx < S.stages.length - 1) {
              const nextSt = S.stages[idx + 1];
              stageSel.value = nextSt.id;
              toast(`Этап «${S.stages[idx].name}» выполнен на 100%. Проект переведен на следующий этап «${nextSt.name}»`, 'ok');
            }
          }
        }
      });

      box.el.querySelector('[data-x]').onclick = () => box.close();
      box.el.querySelector('[data-save]').onclick = async () => {
        const form = box.el.querySelector('#quickForm');
        const fd = new FormData(form);

        if (isMain) {
          if (fd.get('statusId')) r.statusId = +fd.get('statusId');
          if (fd.get('priorityId')) r.priorityId = +fd.get('priorityId');
          if (ent === 'projects') r.stageId = +fd.get('stageId') || null;
          r.devId = +fd.get('devId') || null;
          r.agentId = +fd.get('agentId') || null;

          if (ent === 'projects') {
            r.stageProgress = r.stageProgress || {};
            box.el.querySelectorAll('input[data-sp]').forEach(rng => {
              r.stageProgress[rng.dataset.sp] = +rng.value;
            });
          }
        } else if (isEmp) {
          r.role = fd.get('role');
          r.color = fd.get('color');
          r.position = fd.get('position');
        } else if (isStatus || isPriority || isStage) {
          if (fd.get('name')) r.name = fd.get('name');
          if (fd.get('color')) r.color = fd.get('color');
          if (isPriority && fd.get('weight') !== null) r.weight = +fd.get('weight');
        } else {
          if (fd.get('name')) r.name = fd.get('name');
        }

        r.updatedAt = nowIso();

        try {
          await db[ent].put(r);
          await refreshAll(S);
          await afterChange(S, callbacks.autoSave);
          toast(`Параметры «${r.name}» обновлены`, 'ok');
          box.close();
          if (callbacks.onSuccess) callbacks.onSuccess();
        } catch (err) {
          setDbBeacon('error', '🔴 Ошибка базы данных');
          toast('Ошибка записи: ' + err.message, 'err');
        }
      };
    }
  });
}

export function createSubItem(S, parentEnt, parentId, targetEnt, callbacks = {}) {
  if (parentEnt === 'projects' && targetEnt === 'tasks') {
    openTaskForm(S, null, { projectId: parentId }, callbacks.autoSave);
  } else if (parentEnt === 'tasks' && targetEnt === 'changes') {
    openChangeForm(S, null, { taskId: parentId }, callbacks.autoSave);
  }
}

export function getCommonContextMenuItems(S, ent, id, callbacks = {}, reRender) {
  const item = (S[ent] || []).find(x => x.id === id);
  if (!item) return [];

  const items = [
    {
      id: 'view',
      label: 'Просмотреть запись',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
      action: () => { if (callbacks.onView) callbacks.onView(ent, id); }
    },
    {
      id: 'edit',
      label: 'Редактировать',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
      action: () => {
        if (['projects', 'tasks', 'changes'].includes(ent)) {
          if (callbacks.onEdit) callbacks.onEdit(ent, id);
        } else {
          if (callbacks.onEditDir) callbacks.onEditDir(ent, id);
        }
      }
    },
    {
      id: 'quickChange',
      label: 'Параметры',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
      action: () => {
        openQuickChangeModal(S, ent, id, {
          autoSave: callbacks.autoSave,
          onSuccess: () => { if (reRender) reRender(); }
        });
      }
    },
    {
      id: 'duplicate',
      label: 'Дублировать',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      action: async () => {
        await duplicateRecord(S, ent, id, callbacks.autoSave);
        if (reRender) reRender();
      }
    }
  ];

  if (ent === 'projects') {
    items.push({
      id: 'addTask',
      label: 'Создать задачу к проекту',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
      action: () => createSubItem(S, 'projects', id, 'tasks', callbacks)
    });
  } else if (ent === 'tasks') {
    items.push({
      id: 'addChange',
      label: 'Создать изменение к задаче',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
      action: () => createSubItem(S, 'tasks', id, 'changes', callbacks)
    });
  }

  items.push(
    { type: 'divider' },
    {
      id: 'copyName',
      label: 'Скопировать название/код',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      action: () => {
        const codeOrName = item.num ? `${item.num} · ${item.name}` : item.name;
        navigator.clipboard.writeText(codeOrName);
        toast(`Скопировано: ${codeOrName}`, 'ok');
      }
    },
    {
      id: 'delete',
      label: 'Удалить',
      danger: true,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>',
      action: () => {
        if (callbacks.onDelete) {
          callbacks.onDelete(ent, id);
        }
      }
    }
  );

  return items;
}
