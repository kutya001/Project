// src/components/table/renderers.js
import { esc } from '../../utils/dom.js';
import { fmtD } from '../../utils/date.js';
import { tint, txtOn, shade, colorOf } from '../../utils/color.js';
import { emp, prj, tsk } from '../../services/refs.js';

export function colVal(S, ent, r, k) {
  switch (k) {
    case 'tasksCount': return S.tasks.filter(t => t.projectId === r.id).length;
    case 'changesCount': return S.changes.filter(c => c.taskId === r.id).length;
    case 'progress': {
      const v = Object.values(r.stageProgress || {});
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
    }
    case 'agents': return (r.agents || []).map(id => (emp(S, id) || {}).name || '').filter(Boolean).join(', ');
    case 'devs': return (r.devs || []).map(id => (emp(S, id) || {}).name || '').filter(Boolean).join(', ');
    case 'projectId': return prj(S, r.projectId)?.name || null;
    case 'taskId': return tsk(S, r.taskId)?.name || null;
    default: return r[k];
  }
}

export function dirItem(colDef, id) {
  return (colDef.dir ? colDef.dir() : []).find(x => x.id === id);
}

export function chipHtml(name, color) {
  return `<span class="chip" style="background:${tint(color, .13)};border-color:${tint(color, .45)};color:${txtOn('#f8f8f8') === '#1B2430' ? shade(color) : '#333'}"><i style="background:${color}"></i>${esc(name)}</span>`;
}

export function cellHtml(S, ent, cdef, r) {
  const k = cdef.k;
  if (cdef.type === 'select') {
    const it = dirItem(cdef, r[k]);
    return it ? chipHtml(it.name, colorOf(it)) : `<span style="color:var(--mut2)">—</span>`;
  }
  if (cdef.type === 'multi') {
    const ids = r[k === 'agents' ? 'agents' : 'devs'] || [];
    if (!ids.length) return `<span style="color:var(--mut2)">—</span>`;
    return ids.slice(0, 3).map(id => {
      const e = emp(S, id);
      return e ? `<span class="chip" style="margin:1px 2px 1px 0;background:${tint(colorOf(e), .13)};border-color:${tint(colorOf(e), .4)}"><i style="background:${colorOf(e)}"></i>${esc(e.name)}</span>` : '';
    }).join('') + (ids.length > 3 ? `<span class="mono" style="color:var(--mut)">+${ids.length - 3}</span>` : '');
  }
  if (cdef.type === 'date') {
    return r[k] ? `<span class="mono">${fmtD(r[k])}</span>` : `<span style="color:var(--mut2)">—</span>`;
  }
  if (cdef.type === 'number') return `<span class="mono">${colVal(S, ent, r, k)}</span>`;
  if (cdef.type === 'color') {
    const col = r[k] || '#0B7285';
    return `<div style="display:flex;align-items:center;gap:6px"><span class="sw" style="background:${col};width:16px;height:16px;border-radius:4px;border:1px solid var(--line);display:inline-block"></span><span class="mono" style="font-size:11.5px;color:var(--mut)">${esc(col)}</span></div>`;
  }
  if (cdef.type === 'role') {
    return r.role === 'dev'
      ? `<span class="chip" style="background:#EBF5FF;border-color:#BEE3F8;color:#2B6CB0">Разработчик</span>`
      : `<span class="chip" style="background:#FEEBC8;border-color:#FBD38D;color:#C05621">Агент</span>`;
  }
  if (cdef.type === 'active') {
    return r.active !== false
      ? `<span style="color:var(--grn);font-weight:600;font-size:12px">● Активен</span>`
      : `<span style="color:var(--mut2);font-weight:600;font-size:12px">○ Неактивен</span>`;
  }
  if (k === 'progress') {
    const v = colVal(S, ent, r, k);
    return `<div class="progwrap"><div class="progbar"><i style="width:${v}%"></i></div><span class="mono">${v}%</span></div>`;
  }
  if (k === 'extLink') return r.extLink ? `<a href="${esc(r.extLink)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:var(--acc)">🔗 открыть</a>` : `<span style="color:var(--mut2)">—</span>`;
  if (k === 'name') return `<span class="namecell" title="${esc(r.name)}">${esc(r.name)}</span>`;
  if (k === 'num') return `<span class="numcell">${esc(r.num)}</span>`;

  const v = colVal(S, ent, r, k);
  return v ? `<span style="color:${(k === 'desc' || k === 'note') ? 'var(--mut)' : 'inherit'};max-width:260px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom" title="${esc(v)}">${esc(v)}</span>` : `<span style="color:var(--mut2)">—</span>`;
}
