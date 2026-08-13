// src/pages/changes.js
import { savePrefs } from '../core/prefs.js';
import { renderTableView } from '../components/table/TableView.js';
import { renderKanbanView } from '../components/kanban/KanbanView.js';
import { renderTimelineView } from '../components/timeline/TimelineView.js';
import { VIEW_ICONS } from '../ui/viewIcons.js';

export function renderChangesPage(S, mount, callbacks = {}) {
  const ent = 'changes';
  const vMode = S.prefs.views[ent] || 'tbl';

  mount.innerHTML = `
    <div class="phead">
      <div><div class="kick">Журнал изменений</div><h1>Изменения</h1></div>
      <span class="big-n">${S.changes.length}</span>
      <div class="sp"></div>
      <div class="seg" id="cViewSeg">
        <button data-v="tbl" class="${vMode === 'tbl' ? 'on' : ''}">${VIEW_ICONS.tbl} Таблица</button>
        <button data-v="kb" class="${vMode === 'kb' ? 'on' : ''}">${VIEW_ICONS.kb} Канбан</button>
        <button data-v="tl" class="${vMode === 'tl' ? 'on' : ''}">${VIEW_ICONS.tl} Гант</button>
      </div>
      <button class="btn pri" id="btnAddChg">+ Зафиксировать изменение</button>
    </div>
    <div id="cContent"></div>`;

  const cnt = mount.querySelector('#cContent');
  const reRender = () => renderChangesPage(S, mount, callbacks);

  if (vMode === 'tbl') renderTableView(S, ent, cnt, callbacks);
  else if (vMode === 'kb') renderKanbanView(S, ent, cnt, callbacks);
  else renderTimelineView(S, ent, cnt, callbacks);

  mount.querySelectorAll('#cViewSeg button').forEach(b => b.onclick = async () => {
    S.prefs.views[ent] = b.dataset.v;
    await savePrefs(S);
    reRender();
  });

  mount.querySelector('#btnAddChg').onclick = () => {
    if (callbacks.onAdd) callbacks.onAdd('changes');
  };
}
