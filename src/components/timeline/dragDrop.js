// src/components/timeline/dragDrop.js
import { $, esc } from '../../utils/dom.js';
import { fmtD, addDays, diffDays, nowIso } from '../../utils/date.js';
import { db, refreshAll } from '../../core/db.js';
import { setDbBeacon, afterChange } from '../../utils/logger.js';
import { toast } from '../../ui/toast.js';

export function setupTimelineDragDrop(S, ent, mount, reRender, rowMeta, groupBy, ppd, callbacks = {}, wsT = 0) {
  const body = mount.querySelector('#tlBody');
  if (!body) return;
  let drag = null;

  body.addEventListener('pointerdown', e => {
    const bar = e.target.closest('.bar');
    if (!bar) return;
    if (e.button && e.button !== 0) return; // Only LMB drags
    e.preventDefault();
    drag = {
      bar,
      id: +bar.dataset.id,
      s: bar.dataset.s,
      en: bar.dataset.e,
      x0: e.clientX,
      y0: e.clientY,
      h: e.target.dataset.h || null,
      origLeft: parseFloat(bar.style.left) || 0,
      origW: parseFloat(bar.style.width) || 8,
      origTop: parseFloat(bar.style.top) || 6,
      moved: false,
      dx: 0,
      gi: +bar.closest('.tl-canvas').dataset.gi
    };
    bar.setPointerCapture(e.pointerId);
  });

  body.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    drag.bar.classList.add('dragging');
    drag.dx = dx;

    const dd = Math.round(dx / ppd);
    let ns = drag.s, ne = drag.en;

    if (drag.h === 'r') {
      // Resizing right handle: expand/shrink right
      const newW = Math.max(12, drag.origW + dx);
      drag.bar.style.transform = 'none';
      drag.bar.style.width = newW + 'px';
      ne = addDays(drag.en, Math.max(dd, 1 - diffDays(drag.s, drag.en)));
    } else if (drag.h === 'l') {
      // Resizing left handle: expand/shrink left
      const newLeft = Math.min(drag.origLeft + drag.origW - 12, drag.origLeft + dx);
      const newW = Math.max(12, drag.origW - dx);
      drag.bar.style.transform = 'none';
      drag.bar.style.left = newLeft + 'px';
      drag.bar.style.width = newW + 'px';
      ns = addDays(drag.s, Math.min(dd, diffDays(drag.s, drag.en) - 1));
    } else {
      // Dragging entire bar
      drag.bar.style.transform = `translate(${dx}px, 0)`;
      ns = addDays(drag.s, dd);
      ne = addDays(drag.en, dd);
    }

    drag.ns = ns;
    drag.ne = ne;

    const rows = [...body.querySelectorAll('.tl-row')];
    let tgt = drag.gi;
    if (!drag.h) {
      rows.forEach((r, i) => {
        const rc = r.getBoundingClientRect();
        if (e.clientY >= rc.top && e.clientY < rc.bottom) tgt = i;
      });
    }
    drag.tgt = tgt;

    rows.forEach((r, i) => {
      const canvas = r.querySelector('.tl-canvas');
      if (canvas) canvas.style.outline = i === tgt && i !== drag.gi ? '2px dashed var(--acc)' : '';
    });

    // Ghost element preview (Призрак местоположения)
    let ghost = document.getElementById('tlGhost');
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.id = 'tlGhost';
      ghost.className = 'bar-ghost';
    }

    const targetCanvas = rows[tgt]?.querySelector('.tl-canvas');
    if (targetCanvas) {
      if (ghost.parentElement !== targetCanvas) {
        targetCanvas.appendChild(ghost);
      }
      const ghostX = Math.max(0, Math.round((new Date(ns + 'T00:00:00').getTime() - wsT) / 864e5 * ppd));
      const ghostW = Math.max(8, Math.round(diffDays(ns, ne) * ppd) - 2);
      ghost.style.left = ghostX + 'px';
      ghost.style.width = ghostW + 'px';
      ghost.style.top = drag.origTop + 'px';
      ghost.textContent = `${fmtD(ns)} → ${fmtD(ne)} (${diffDays(ns, ne)} дн.)`;
    }

    const tip = $('#tlTip');
    if (tip) {
      tip.classList.remove('hidden');
      tip.style.left = (e.clientX + 14) + 'px';
      tip.style.top = (e.clientY + 18) + 'px';
      const gtxt = (tgt !== drag.gi && ['dev', 'agent', 'priority', 'stage', 'status'].includes(groupBy) && rowMeta[tgt]) ? ` → ${esc(rowMeta[tgt].g.name)}` : '';
      tip.textContent = `${fmtD(ns)} → ${fmtD(ne)} (${diffDays(ns, ne)} дн.)${gtxt}`;
    }
  });

  const endDrag = async e => {
    if (!drag) return;
    const d = drag;
    drag = null;

    const ghost = document.getElementById('tlGhost');
    if (ghost && ghost.parentElement) {
      ghost.parentElement.removeChild(ghost);
    }

    const tip = $('#tlTip');
    if (tip) tip.classList.add('hidden');
    body.querySelectorAll('.tl-canvas').forEach(c => c.style.outline = '');

    if (!d.moved) {
      if (callbacks.onView) callbacks.onView(ent, d.id);
      return;
    }

    d.bar.classList.remove('dragging');
    d.bar.style.transform = '';
    d.bar.style.left = '';
    d.bar.style.width = '';

    const r = S[ent].find(x => x.id === d.id);
    if (!r) return;

    r.start = d.ns || r.start;
    r.end = d.ne || r.end;
    r.updatedAt = nowIso();

    if (d.tgt !== undefined && d.tgt !== d.gi && rowMeta[d.tgt]) {
      const g = rowMeta[d.tgt].g;
      if (groupBy === 'dev') r.devId = g.id;
      else if (groupBy === 'agent') r.agentId = g.id;
      else if (groupBy === 'priority') r.priorityId = g.id;
      else if (groupBy === 'stage') r.stageId = g.id;
      else r.statusId = g.id;
    }

    try {
      await db[ent].put(r);
      await refreshAll(S);
      await afterChange(S, callbacks.autoSave);
      toast(`«${r.name}»: ${fmtD(r.start)} → ${fmtD(r.end)}`, 'ok');
    } catch (err) {
      setDbBeacon('error', '🔴 Ошибка базы данных');
      toast('Ошибка записи', 'err');
    }
    reRender();
  };

  body.addEventListener('pointerup', endDrag);
  body.addEventListener('pointercancel', endDrag);
}
