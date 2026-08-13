// src/pages/forms/TaskForm.js
import { esc } from '../../utils/dom.js';
import { nowIso } from '../../utils/date.js';
import { modal } from '../../ui/modal.js';
import { db, refreshAll } from '../../core/db.js';
import { afterChange, setDbBeacon } from '../../utils/logger.js';
import { toast } from '../../ui/toast.js';
import { openViewModal } from './ViewForm.js';
import { openProjectForm } from './ProjectForm.js';

export function openTaskForm(S, id, preset = {}, onSave) {
  const t = S.tasks.find(x => x.id === id) || {
    num: 'T-' + String(S.counters.t + 1).padStart(3, '0'),
    projectId: preset.projectId || S.projects[0]?.id || null,
    name: '', desc: '', note: '',
    statusId: S.taskStatuses[0]?.id || null,
    priorityId: S.priorities[0]?.id || null,
    devId: S.employees.find(e => e.role === 'dev')?.id || null,
    agentId: null, customerId: null,
    extNum: '', extLink: '',
    start: '', end: '',
    agents: [], devs: []
  };

  const isEdit = !!t.id;
  const custsList = S.customers || [];
  const mcheck = (role, sel) => (S.employees.filter(e => e.role === role) || []).map(e => `
    <label><input type="checkbox" name="${role}s" value="${e.id}" ${(sel || []).includes(e.id) ? 'checked' : ''}>${esc(e.name)}</label>
  `).join('') || '<div style="color:var(--mut2)">нет записи</div>';

  const body = `<form id="tf" class="fgrid">
    <div><label class="fl">Код / Номер</label><input type="text" name="num" value="${esc(t.num)}" required></div>
    <div>
      <label class="fl">Проект</label>
      <div style="display:flex;gap:6px;align-items:center">
        <select name="projectId" style="flex:1">${S.projects.map(p => `<option value="${p.id}" ${p.id === t.projectId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <button type="button" class="btn sm" id="btnPreviewProject" title="Просмотреть выбранный проект" style="padding:6px 10px;white-space:nowrap">👁 Просмотр</button>
      </div>
    </div>
    <div class="full"><label class="fl">Название задачи</label><input type="text" name="name" value="${esc(t.name)}" required></div>
    <div><label class="fl">Заказчик</label><select name="customerId"><option value="">— Выбрать заказчика —</option>${custsList.map(c => `<option value="${c.id}" ${c.id === t.customerId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div><label class="fl">Статус</label><select name="statusId">${S.taskStatuses.map(s => `<option value="${s.id}" ${s.id === t.statusId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div><label class="fl">Приоритет</label><select name="priorityId">${S.priorities.map(s => `<option value="${s.id}" ${s.id === t.priorityId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div><label class="fl">Ответственный разработчик</label><select name="devId"><option value="">— Не назначен —</option>${S.employees.filter(e => e.role === 'dev').map(e => `<option value="${e.id}" ${e.id === t.devId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></div>
    <div><label class="fl">Ответственный агент (ПМ / Аналитик)</label><select name="agentId"><option value="">— Не назначен —</option>${S.employees.filter(e => e.role === 'agent').map(e => `<option value="${e.id}" ${e.id === t.agentId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></div>
    <div><label class="fl">№ в смежной системе</label><input type="text" name="extNum" value="${esc(t.extNum || '')}"></div>
    <div><label class="fl">Ссылка на задачу</label><input type="url" name="extLink" value="${esc(t.extLink || '')}"></div>
    <div><label class="fl">Дата начала</label><input type="date" name="start" value="${t.start || ''}"></div>
    <div><label class="fl">Дата окончания</label><input type="date" name="end" value="${t.end || ''}"></div>
    <div class="full"><label class="fl">Дополнительные агенты (ПМ / Аналитики)</label><div class="mcheck">${mcheck('agent', t.agents)}</div></div>
    <div class="full"><label class="fl">Участники разработки</label><div class="mcheck">${mcheck('dev', t.devs)}</div></div>
    <div class="full"><label class="fl">Описание</label><textarea name="desc">${esc(t.desc || '')}</textarea></div>
    <div class="full"><label class="fl">Примечание</label><input type="text" name="note" value="${esc(t.note || '')}"></div>
  </form>`;

  modal({
    title: isEdit ? 'Редактировать задачу' : 'Новая задача',
    sub: 'ЗАДАЧИ',
    wide: true,
    body,
    foot: `<button class="btn" data-x>Отмена</button><button class="btn pri" data-save>Сохранить</button>`,
    mount(box) {
      const btnPrevPj = box.el.querySelector('#btnPreviewProject');
      if (btnPrevPj) {
        btnPrevPj.onclick = () => {
          const selPjId = +box.el.querySelector('select[name="projectId"]').value;
          if (selPjId) {
            openViewModal(S, 'projects', selPjId, {
              onEdit: (e, eid) => openProjectForm(S, eid, onSave),
              autoSave: onSave
            });
          } else {
            toast('Проект не выбран', 'err');
          }
        };
      }

      box.el.querySelector('[data-x]').onclick = () => box.close();
      box.el.querySelector('[data-save]').onclick = async () => {
        const form = box.el.querySelector('#tf');
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const fd = new FormData(form);

        t.num = fd.get('num');
        t.projectId = +fd.get('projectId');
        t.name = fd.get('name');
        t.statusId = +fd.get('statusId') || null;
        t.priorityId = +fd.get('priorityId') || null;
        t.devId = +fd.get('devId') || null;
        t.agentId = +fd.get('agentId') || null;
        t.customerId = +fd.get('customerId') || null;
        t.extNum = fd.get('extNum');
        t.extLink = fd.get('extLink');
        t.start = fd.get('start') || '';
        t.end = fd.get('end') || '';
        t.desc = fd.get('desc');
        t.note = fd.get('note');
        t.agents = [...form.querySelectorAll('input[name="agents"]:checked')].map(i => +i.value);
        t.devs = [...form.querySelectorAll('input[name="devs"]:checked')].map(i => +i.value);

        t.updatedAt = nowIso();
        if (!isEdit) {
          t.createdAt = nowIso();
          S.counters.t++;
          t.id = await db.tasks.add(t);
          await db.meta.put({ key: 'counters', value: S.counters });
        } else {
          await db.tasks.put(t);
        }

        try {
          await refreshAll(S);
          await afterChange(S, onSave);
          toast(`Задача «${t.name}» сохранена`, 'ok');
          box.close();
        } catch (e) {
          setDbBeacon('error', '🔴 Ошибка базы данных');
          toast('Ошибка записи', 'err');
        }
      };
    }
  });
}
