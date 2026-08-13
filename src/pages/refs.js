// src/pages/refs.js
import { esc } from '../utils/dom.js';
import { colorOf } from '../utils/color.js';
import { REFTABS } from '../core/state.js';
import { db, refreshAll } from '../core/db.js';
import { confirmBox } from '../ui/modal.js';
import { afterChange, setDbBeacon } from '../utils/logger.js';
import { toast } from '../ui/toast.js';
import { renderTableView } from '../components/table/TableView.js';
import { openQuickChangeModal, getCommonContextMenuItems } from '../services/quickActions.js';
import { showContextMenu } from '../ui/contextMenu.js';

let curTab = 'employees';
let curView = 'table'; // 'table' | 'cards'

export function renderRefsPage(S, mount, callbacks = {}) {
  const tabs = REFTABS.map(([k, name]) => `
    <button data-tab="${k}" class="${curTab === k ? 'on' : ''}">${esc(name)} (${(S[k] || []).length})</button>
  `).join('');

  mount.innerHTML = `
    <div class="phead">
      <div><div class="kick">Системные справочники</div><h1>Справочники</h1></div>
      <div class="sp"></div>
      <div class="view-switch" style="display:inline-flex;background:var(--line2);padding:3px;border-radius:10px;gap:2px">
        <button id="btnViewTable" class="btn sm ${curView === 'table' ? 'pri' : 'ghost'}" title="Представление: Таблица" style="display:inline-flex;align-items:center;gap:4px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18"/></svg>
          Таблица
        </button>
        <button id="btnViewCards" class="btn sm ${curView === 'cards' ? 'pri' : 'ghost'}" title="Представление: Карточки" style="display:inline-flex;align-items:center;gap:4px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
          Карточки
        </button>
      </div>
      <button class="btn pri" id="btnAddRef">+ Добавить элемент</button>
    </div>
    <div class="refs">
      <div class="tabs">${tabs}</div>
      <div id="refPanel"></div>
    </div>`;

  const panelEl = mount.querySelector('#refPanel');
  const reRender = () => renderRefsPage(S, mount, callbacks);

  mount.querySelector('#btnViewTable').onclick = () => {
    if (curView !== 'table') {
      curView = 'table';
      reRender();
    }
  };

  mount.querySelector('#btnViewCards').onclick = () => {
    if (curView !== 'cards') {
      curView = 'cards';
      reRender();
    }
  };

  mount.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    curTab = b.dataset.tab;
    reRender();
  });

  mount.querySelector('#btnAddRef').onclick = () => {
    if (callbacks.onAddDir) callbacks.onAddDir(curTab);
  };

  const refCallbacks = {
    onView: (ent, id) => {
      if (callbacks.onView) callbacks.onView(ent, id);
    },
    onEdit: (ent, id) => {
      if (callbacks.onEditDir) callbacks.onEditDir(ent, id);
    },
    onDelete: (ent, id) => {
      confirmBox('Удалить эту запись из справочника?', async () => {
        try {
          await db[ent].delete(id);
          await refreshAll(S);
          await afterChange(S, callbacks.autoSave);
          toast('Запись удалена из справочника', 'ok');
          reRender();
        } catch (e) {
          setDbBeacon('error', '🔴 Ошибка базы данных');
          toast('Ошибка удаления', 'err');
        }
      });
    },
    autoSave: callbacks.autoSave
  };

  if (curView === 'table') {
    renderTableView(S, curTab, panelEl, refCallbacks);
  } else {
    renderCardsView(S, curTab, panelEl, refCallbacks, reRender);
  }
}

function renderCardsView(S, curTab, mount, refCallbacks, reRender) {
  const items = S[curTab] || [];

  if (!items.length) {
    mount.innerHTML = `<div style="text-align:center;padding:40px 20px;background:#fff;border:1px solid var(--line);border-radius:12px;color:var(--mut)">
      <div style="font-size:32px;margin-bottom:8px">📭</div>
      <div>Справочник пуст</div>
    </div>`;
    return;
  }

  const roleText = {
    dev: 'Разработчик',
    agent: 'Агент AI',
    pm: 'Менеджер проекта'
  };

  const roleColor = {
    dev: '#2B6CB0',
    agent: '#6B46C1',
    pm: '#D69E2E'
  };

  const cardsHtml = items.map(item => {
    const col = colorOf(item);
    let detailsHtml = '';

    if (curTab === 'employees') {
      const roleName = roleText[item.role] || item.role || 'Сотрудник';
      const rColor = roleColor[item.role] || '#4A5568';
      const pCount = S.projects.filter(p => p.devId === item.id || p.agentId === item.id || (p.devs || []).includes(item.id) || (p.agents || []).includes(item.id)).length;
      const tCount = S.tasks.filter(t => t.devId === item.id || t.agentId === item.id).length;

      detailsHtml = `
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span class="chip" style="background:${rColor}15;color:${rColor};border:1px solid ${rColor}30;font-weight:600">${esc(roleName)}</span>
          ${item.position ? `<span style="color:var(--mut)">${esc(item.position)}</span>` : ''}
        </div>
        <div style="display:flex;gap:12px;font-size:11.5px;color:var(--mut);margin-top:2px">
          <span>📁 Проектов: <b>${pCount}</b></span>
          <span>✅ Задач: <b>${tCount}</b></span>
        </div>
      `;
    } else if (curTab === 'priorities') {
      const pCount = S.projects.filter(p => p.priorityId === item.id).length;
      const tCount = S.tasks.filter(t => t.priorityId === item.id).length;
      const cCount = S.changes.filter(c => c.priorityId === item.id).length;

      detailsHtml = `
        <div>Вес приоритета: <b>${item.weight ?? 0}</b></div>
        <div style="display:flex;gap:12px;font-size:11.5px;color:var(--mut);margin-top:2px">
          <span>📁 Проектов: <b>${pCount}</b></span>
          <span>✅ Задач: <b>${tCount}</b></span>
          <span>⚡ Изменений: <b>${cCount}</b></span>
        </div>
      `;
    } else if (curTab === 'projectStatuses') {
      const pCount = S.projects.filter(p => p.statusId === item.id).length;
      detailsHtml = `<div>Проектов в этом статусе: <b>${pCount}</b></div>`;
    } else if (curTab === 'taskStatuses') {
      const tCount = S.tasks.filter(t => t.statusId === item.id).length;
      const cCount = S.changes.filter(c => c.statusId === item.id).length;
      detailsHtml = `
        <div style="display:flex;gap:12px;font-size:11.5px;color:var(--mut)">
          <span>✅ Задач: <b>${tCount}</b></span>
          <span>⚡ Изменений: <b>${cCount}</b></span>
        </div>
      `;
    } else if (curTab === 'stages') {
      const pCount = S.projects.filter(p => p.stageId === item.id).length;
      detailsHtml = `<div>Проектов на этом этапе: <b>${pCount}</b></div>`;
    }

    return `
      <div class="ref-card" data-id="${item.id}" style="border-top:3px solid ${col}">
        <div class="ref-card-head">
          <div class="ref-card-title">
            <span class="sw" style="background:${col}"></span>
            <span>${esc(item.name)}</span>
          </div>
        </div>
        <div class="ref-card-body">
          ${detailsHtml}
        </div>
        <div class="ref-card-foot">
          <button class="btn sm ghost" data-act="view">👁️ Просмотр</button>
          <button class="btn sm ghost" data-act="quick">⚡ Параметры</button>
          <button class="btn sm ghost" data-act="edit">✏️ Изменить</button>
          <button class="btn sm ghost" data-act="del" style="color:var(--red)">🗑️ Удалить</button>
        </div>
      </div>
    `;
  }).join('');

  mount.innerHTML = `<div class="ref-cards-grid">${cardsHtml}</div>`;

  mount.querySelectorAll('.ref-card').forEach(card => {
    const id = +card.dataset.id;

    card.addEventListener('contextmenu', e => {
      e.preventDefault();
      const menuItems = getCommonContextMenuItems(S, curTab, id, refCallbacks, reRender);
      showContextMenu(e, menuItems);
    });

    card.querySelectorAll('[data-act]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        if (act === 'view') {
          if (refCallbacks.onView) refCallbacks.onView(curTab, id);
        } else if (act === 'quick') {
          openQuickChangeModal(S, curTab, id, {
            autoSave: refCallbacks.autoSave,
            onSuccess: reRender
          });
        } else if (act === 'edit') {
          if (refCallbacks.onEdit) refCallbacks.onEdit(curTab, id);
        } else if (act === 'del') {
          if (refCallbacks.onDelete) refCallbacks.onDelete(curTab, id);
        }
      };
    });
  });
}
