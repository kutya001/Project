// src/components/table/subRows.js
import { cellHtml } from './renderers.js';

export function visOf(defs) {
  return defs.filter(c => ['num', 'name', 'statusId', 'priorityId', 'devId', 'start', 'end'].includes(c.k));
}

export function subRowHtml(S, coldefs, ent, r) {
  const cols = visOf(coldefs[ent === 'projects' ? 'tasks' : 'changes']);
  const kids = ent === 'projects'
    ? S.tasks.filter(t => t.projectId === r.id)
    : S.changes.filter(c => c.taskId === r.id);
  const childEnt = ent === 'projects' ? 'tasks' : 'changes';

  const rowsHtml = kids.length
    ? kids.map(k => `<tr data-cid="${k.id}">${cols.map(c => `<td>${cellHtml(S, childEnt, c, k)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${cols.length}" style="color:var(--mut2);padding:12px">Пока пусто</td></tr>`;

  return `<tr class="subrow"><td colspan="99"><div class="subpad">
    <div class="stt">${ent === 'projects' ? 'Задачи проекта' : 'Изменения задачи'} · ${kids.length}
      <button class="btn sm" data-addsub="${r.id}" style="margin-left:10px">+ Добавить</button></div>
    <table class="mini-t">${rowsHtml}</table></div></td></tr>`;
}
