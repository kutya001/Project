// src/pages/forms/DirForm.js
import { esc } from '../../utils/dom.js';
import { REFNAME } from '../../core/state.js';
import { modal } from '../../ui/modal.js';
import { db, refreshAll } from '../../core/db.js';
import { afterChange, setDbBeacon } from '../../utils/logger.js';
import { toast } from '../../ui/toast.js';

export function openDirForm(S, type, id, onSave) {
  const table = db[type];
  const list = S[type] || [];
  const item = list.find(x => x.id === id) || {
    name: '', color: '#0B7285', contacts: '', desc: '', note: '',
    order: list.length + 1, weight: list.length + 1, role: 'dev', position: '', active: true
  };
  const isEdit = !!item.id;

  let extra = '';
  if (type === 'customers') {
    extra = `<div class="full"><label class="fl">Контактные данные</label><input type="text" name="contacts" value="${esc(item.contacts || '')}" required placeholder="Телефон, Email, ответственное лицо"></div>`;
  } else if (type === 'employees') {
    extra = `<div><label class="fl">Роль</label><select name="role"><option value="dev" ${item.role === 'dev' ? 'selected' : ''}>Разработчик</option><option value="agent" ${item.role === 'agent' ? 'selected' : ''}>Агент (ПМ / Аналитик)</option></select></div>
      <div><label class="fl">Должность / Специализация</label><input type="text" name="position" value="${esc(item.position || '')}" required></div>`;
  } else if (type === 'priorities') {
    extra = `<div><label class="fl">Вес (1=высший)</label><input type="number" name="weight" value="${item.weight || 1}" required></div>`;
  } else if (type === 'taskStatuses' || type === 'stages') {
    extra = `<div><label class="fl">Порядок сортировки</label><input type="number" name="order" value="${item.order || 1}" required></div>`;
  }

  const showColor = type !== 'customers';

  const body = `<form id="df" class="fgrid">
    <div class="full"><label class="fl">Название</label><input type="text" name="name" value="${esc(item.name || '')}" required></div>
    ${showColor ? `<div><label class="fl">Цвет плашки</label><input type="color" name="color" value="${item.color || '#0B7285'}" style="height:38px;padding:2px;cursor:pointer;width:100%"></div>` : ''}
    ${extra}
    <div class="full"><label class="fl">Описание</label><textarea name="desc" placeholder="Подробное описание элемента..." required style="min-height:56px">${esc(item.desc || '')}</textarea></div>
    <div class="full"><label class="fl">Примечание</label><input type="text" name="note" placeholder="Дополнительное примечание (необязательно)" value="${esc(item.note || '')}"></div>
  </form>`;

  modal({
    title: isEdit ? 'Редактировать запись' : 'Новая запись',
    sub: 'СПРАВОЧНИК: ' + (REFNAME[type] || type).toUpperCase(),
    body,
    foot: `<button class="btn" data-x>Отмена</button><button class="btn pri" data-save>Сохранить</button>`,
    mount(box) {
      box.el.querySelector('[data-x]').onclick = () => box.close();
      box.el.querySelector('[data-save]').onclick = async () => {
        const form = box.el.querySelector('#df');
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const fd = new FormData(form);

        item.name = fd.get('name');
        item.desc = fd.get('desc');
        item.note = fd.get('note');

        if (showColor) item.color = fd.get('color');
        if (type === 'customers') item.contacts = fd.get('contacts');
        if (type === 'employees') { item.role = fd.get('role'); item.position = fd.get('position'); item.active = true; }
        if (type === 'priorities') item.weight = +fd.get('weight');
        if (type === 'taskStatuses' || type === 'stages') item.order = +fd.get('order');

        if (!isEdit) {
          delete item.id;
          item.id = await table.add(item);
        } else {
          await table.put(item);
        }

        try {
          await refreshAll(S);
          await afterChange(S, onSave);
          toast('Справочник обновлен', 'ok');
          box.close();
        } catch (e) {
          setDbBeacon('error', '🔴 Ошибка базы данных');
          toast('Ошибка записи', 'err');
        }
      };
    }
  });
}
