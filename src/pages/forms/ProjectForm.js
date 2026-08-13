// src/pages/forms/ProjectForm.js
import { $, esc } from '../../utils/dom.js';
import { nowIso } from '../../utils/date.js';
import { modal } from '../../ui/modal.js';
import { db, refreshAll } from '../../core/db.js';
import { afterChange, setDbBeacon } from '../../utils/logger.js';
import { toast } from '../../ui/toast.js';
import { renderColorOptions, setupColorSelects } from '../../utils/colorSelect.js';

export function openProjectForm(S, id, onSave) {
  const p = S.projects.find(x => x.id === id) || {
    num: 'P-' + String(S.counters.p + 1).padStart(3, '0'),
    name: '', desc: '', note: '',
    statusId: S.projectStatuses[0]?.id || null,
    priorityId: S.priorities[0]?.id || null,
    stageId: S.stages[0]?.id || null,
    devId: null, agentId: null, customerId: null,
    start: '', end: '',
    stageProgress: {}, agents: [], devs: []
  };

  const isEdit = !!p.id;
  const devsList = S.employees.filter(e => e.role === 'dev') || [];
  const agentsList = S.employees.filter(e => e.role === 'agent') || [];
  const custsList = S.customers || [];

  const mcheck = (role, sel) => (S.employees.filter(e => e.role === role) || []).map(e => `
    <label><input type="checkbox" name="${role}s" value="${e.id}" ${(sel || []).includes(e.id) ? 'checked' : ''}>${esc(e.name)}</label>
  `).join('') || '<div style="color:var(--mut2)">нет записи</div>';

  const body = `<form id="pf" class="fgrid">
    <div><label class="fl">Код / Номер</label><input type="text" name="num" value="${esc(p.num)}" required></div>
    <div><label class="fl">Статус</label><select name="statusId">${renderColorOptions(S.projectStatuses, p.statusId)}</select></div>
    <div class="full"><label class="fl">Название проекта</label><input type="text" name="name" value="${esc(p.name)}" required></div>
    <div><label class="fl">Заказчик</label><select name="customerId"><option value="">— Выбрать заказчика —</option>${custsList.map(c => `<option value="${c.id}" ${c.id === p.customerId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div><label class="fl">Приоритет</label><select name="priorityId">${renderColorOptions(S.priorities, p.priorityId)}</select></div>
    <div><label class="fl">Текущий этап</label><select name="stageId">${renderColorOptions(S.stages, p.stageId, '— Не выбран —')}</select></div>
    <div><label class="fl">Разработчик (гл.)</label><select name="devId">${renderColorOptions(devsList, p.devId, '— Не назначен —')}</select></div>
    <div class="full"><label class="fl">Ответственный агент (ПМ / Аналитик)</label><select name="agentId">${renderColorOptions(agentsList, p.agentId, '— Не назначен —')}</select></div>
    <div><label class="fl">Дата начала</label><input type="date" name="start" value="${p.start || ''}"></div>
    <div><label class="fl">Дата окончания</label><input type="date" name="end" value="${p.end || ''}"></div>
    <div class="full"><label class="fl">Агенты проекта (ПМ / Аналитики)</label><div class="mcheck">${mcheck('agent', p.agents)}</div></div>
    <div class="full"><label class="fl">Разработчики проекта (команда)</label><div class="mcheck">${mcheck('dev', p.devs)}</div></div>
    <div class="full"><label class="fl">Прогресс по этапам (%)</label>
      <div class="stageed">${S.stages.map(st => {
        const val = p.stageProgress ? (p.stageProgress[st.id] || 0) : 0;
        return `<div class="sr"><span>${esc(st.name)}</span><input type="range" min="0" max="100" data-sp="${st.id}" value="${val}"><span class="pv" id="spv-${st.id}">${val}%</span></div>`;
      }).join('') || '<div>Этапы не заведены</div>'}</div>
    </div>
    <div class="full"><label class="fl">Описание</label><textarea name="desc">${esc(p.desc || '')}</textarea></div>
    <div class="full"><label class="fl">Примечание</label><input type="text" name="note" value="${esc(p.note || '')}"></div>
  </form>`;

  modal({
    title: isEdit ? 'Редактировать проект' : 'Новый проект',
    sub: 'ПРОЕКТЫ',
    wide: true,
    body,
    foot: `<button class="btn" data-x>Отмена</button><button class="btn pri" data-save>Сохранить</button>`,
    mount(box) {
      setupColorSelects(box.el);
      const stageSel = box.el.querySelector('select[name="stageId"]');
      box.el.querySelectorAll('input[data-sp]').forEach(r => r.oninput = () => {
        const pv = box.el.querySelector('#spv-' + r.dataset.sp);
        if (pv) pv.textContent = r.value + '%';

        if (+r.value === 100 && stageSel && S.stages && S.stages.length) {
          const spId = +r.dataset.sp;
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
        const form = box.el.querySelector('#pf');
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const fd = new FormData(form);

        p.num = fd.get('num');
        p.name = fd.get('name');
        p.desc = fd.get('desc');
        p.note = fd.get('note');
        p.statusId = +fd.get('statusId') || null;
        p.priorityId = +fd.get('priorityId') || null;
        p.stageId = +fd.get('stageId') || null;
        p.devId = +fd.get('devId') || null;
        p.agentId = +fd.get('agentId') || null;
        p.customerId = +fd.get('customerId') || null;
        p.start = fd.get('start') || '';
        p.end = fd.get('end') || '';
        p.agents = [...form.querySelectorAll('input[name="agents"]:checked')].map(i => +i.value);
        p.devs = [...form.querySelectorAll('input[name="devs"]:checked')].map(i => +i.value);

        p.stageProgress = {};
        box.el.querySelectorAll('input[data-sp]').forEach(r => p.stageProgress[r.dataset.sp] = +r.value);

        p.updatedAt = nowIso();
        if (!isEdit) {
          p.createdAt = nowIso();
          S.counters.p++;
          p.id = await db.projects.add(p);
          await db.meta.put({ key: 'counters', value: S.counters });
        } else {
          await db.projects.put(p);
        }

        try {
          await refreshAll(S);
          await afterChange(S, onSave);
          toast(`Проект «${p.name}» сохранен`, 'ok');
          box.close();
        } catch (e) {
          setDbBeacon('error', '🔴 Ошибка базы данных');
          toast('Ошибка записи', 'err');
        }
      };
    }
  });
}
