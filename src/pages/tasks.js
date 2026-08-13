// src/pages/tasks.js
import { savePrefs } from '../core/prefs.js';
import { renderTableView } from '../components/table/TableView.js';
import { renderKanbanView } from '../components/kanban/KanbanView.js';
import { renderTimelineView } from '../components/timeline/TimelineView.js';
import { VIEW_ICONS } from '../ui/viewIcons.js';

export function renderTasksPage(S, mount, callbacks = {}) {
  const ent = 'tasks';
  const vMode = S.prefs.views[ent] || 'tbl';

  mount.innerHTML = `
    <div class="phead">
      <div><div class="kick">Реестр задач</div><h1>Задачи</h1></div>
      <span class="big-n">${S.tasks.length}</span>
      <div class="sp"></div>
      <div class="seg" id="tViewSeg">
        <button data-v="tbl" class="${vMode === 'tbl' ? 'on' : ''}">${VIEW_ICONS.tbl} Таблица</button>
        <button data-v="kb" class="${vMode === 'kb' ? 'on' : ''}">${VIEW_ICONS.kb} Канбан</button>
        <button data-v="tl" class="${vMode === 'tl' ? 'on' : ''}">${VIEW_ICONS.tl} Гант</button>
      </div>
      <button class="btn pri" id="btnAddTsk">+ Создать задачу</button>
    </div>
    <div id="tContent"></div>`;

  const cnt = mount.querySelector('#tContent');
  const reRender = () => renderTasksPage(S, mount, callbacks);

  if (vMode === 'tbl') renderTableView(S, ent, cnt, callbacks);
  else if (vMode === 'kb') renderKanbanView(S, ent, cnt, callbacks);
  else renderTimelineView(S, ent, cnt, callbacks);

  mount.querySelectorAll('#tViewSeg button').forEach(b => b.onclick = async () => {
    S.prefs.views[ent] = b.dataset.v;
    await savePrefs(S);
    reRender();
  });

  mount.querySelector('#btnAddTsk').onclick = () => {
    if (callbacks.onAdd) callbacks.onAdd('tasks');
  };
}
