// src/pages/forms/ChangeForm.js
import { esc } from '../../utils/dom.js';
import { nowIso } from '../../utils/date.js';
import { modal } from '../../ui/modal.js';
import { db, refreshAll } from '../../core/db.js';
import { afterChange, setDbBeacon } from '../../utils/logger.js';
import { toast } from '../../ui/toast.js';
import { openViewModal } from './ViewForm.js';
import { openTaskForm } from './TaskForm.js';
import { renderColorOptions, setupColorSelects } from '../../utils/colorSelect.js';

export function openChangeForm(S, id, preset = {}, onSave) {
  const c = S.changes.find(x => x.id === id) || {
    num: 'C-' + String(S.counters.c + 1).padStart(3, '0'),
    taskId: preset.taskId || S.tasks[0]?.id || null,
    name: '', desc: '', note: '',
    statusId: S.taskStatuses[0]?.id || null,
    priorityId: S.priorities[0]?.id || null,
    devId: null, agentId: null, customerId: null,
    extNum: '', extLink: '',
    start: '', end: ''
  };

  const isEdit = !!c.id;
  const custsList = S.customers || [];
  const devsList = S.employees.filter(e => e.role === 'dev') || [];
  const agentsList = S.employees.filter(e => e.role === 'agent') || [];

  const body = `<form id="cf" class="fgrid">
    <div><label class="fl">Код / Номер</label><input type="text" name="num" value="${esc(c.num)}" required></div>
    <div class="full">
      <label class="fl">Родительская задача</label>
      <div style="display:flex;gap:6px;align-items:center">
        <select name="taskId" style="flex:1">${S.tasks.map(t => `<option value="${t.id}" ${t.id === c.taskId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
        <button type="button" class="btn sm" id="btnPreviewTask" title="Просмотреть выбранную задачу" style="padding:6px 10px;white-space:nowrap">👁 Просмотр</button>
      </div>
    </div>
    <div class="full"><label class="fl">Название изменения</label><input type="text" name="name" value="${esc(c.name)}" required></div>
    <div><label class="fl">Заказчик</label><select name="customerId"><option value="">— Выбрать заказчика —</option>${custsList.map(cust => `<option value="${cust.id}" ${cust.id === c.customerId ? 'selected' : ''}>${esc(cust.name)}</option>`).join('')}</select></div>
    <div><label class="fl">Статус</label><select name="statusId">${renderColorOptions(S.taskStatuses, c.statusId)}</select></div>
    <div><label class="fl">Приоритет</label><select name="priorityId">${renderColorOptions(S.priorities, c.priorityId)}</select></div>
    <div><label class="fl">Ответственный разработчик</label><select name="devId">${renderColorOptions(devsList, c.devId, '— Не назначен —')}</select></div>
    <div><label class="fl">Ответственный агент (ПМ / Аналитик)</label><select name="agentId">${renderColorOptions(agentsList, c.agentId, '— Не назначен —')}</select></div>
    <div><label class="fl">№ в системе</label><input type="text" name="extNum" value="${esc(c.extNum || '')}"></div>
    <div><label class="fl">Ссылка</label><input type="url" name="extLink" value="${esc(c.extLink || '')}"></div>
    <div><label class="fl">Дата начала</label><input type="date" name="start" value="${c.start || ''}"></div>
    <div><label class="fl">Дата окончания</label><input type="date" name="end" value="${c.end || ''}"></div>
    <div class="full"><label class="fl">Описание</label><textarea name="desc">${esc(c.desc || '')}</textarea></div>
    <div class="full"><label class="fl">Примечание</label><input type="text" name="note" value="${esc(c.note || '')}"></div>
  </form>`;

  modal({
    title: isEdit ? 'Редактировать изменение' : 'Новое изменение',
    sub: 'ИЗМЕНЕНИЯ',
    wide: true,
    body,
    foot: `<button class="btn" data-x>Отмена</button><button class="btn pri" data-save>Сохранить</button>`,
    mount(box) {
      setupColorSelects(box.el);
      const btnPrevTk = box.el.querySelector('#btnPreviewTask');
      if (btnPrevTk) {
        btnPrevTk.onclick = () => {
          const selTkId = +box.el.querySelector('select[name="taskId"]').value;
          if (selTkId) {
            openViewModal(S, 'tasks', selTkId, {
              onEdit: (e, eid) => openTaskForm(S, eid, onSave),
              autoSave: onSave
            });
          } else {
            toast('Задача не выбрана', 'err');
          }
        };
      }

      box.el.querySelector('[data-x]').onclick = () => box.close();
      box.el.querySelector('[data-save]').onclick = async () => {
        const form = box.el.querySelector('#cf');
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const fd = new FormData(form);

        c.num = fd.get('num');
        c.taskId = +fd.get('taskId');
        c.name = fd.get('name');
        c.statusId = +fd.get('statusId') || null;
        c.priorityId = +fd.get('priorityId') || null;
        c.devId = +fd.get('devId') || null;
        c.agentId = +fd.get('agentId') || null;
        c.customerId = +fd.get('customerId') || null;
        c.extNum = fd.get('extNum');
        c.extLink = fd.get('extLink');
        c.start = fd.get('start') || '';
        c.end = fd.get('end') || '';
        c.desc = fd.get('desc');
        c.note = fd.get('note');

        c.updatedAt = nowIso();
        if (!isEdit) {
          c.createdAt = nowIso();
          S.counters.c++;
          c.id = await db.changes.add(c);
          await db.meta.put({ key: 'counters', value: S.counters });
        } else {
          await db.changes.put(c);
        }

        try {
          await refreshAll(S);
          await afterChange(S, onSave);
          toast(`Изменение «${c.name}» сохранено`, 'ok');
          box.close();
        } catch (e) {
          setDbBeacon('error', '🔴 Ошибка базы данных');
          toast('Ошибка записи', 'err');
        }
      };
    }
  });
}
