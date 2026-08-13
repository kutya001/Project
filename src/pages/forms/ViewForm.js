// src/pages/forms/ViewForm.js
import { esc } from '../../utils/dom.js';
import { fmtD, fmtDT } from '../../utils/date.js';
import { ENT, REFNAME } from '../../core/state.js';
import { statFor, pri, emp, prj, tsk, stg } from '../../services/refs.js';
import { chipHtml } from '../../components/table/renderers.js';
import { colorOf } from '../../utils/color.js';
import { modal } from '../../ui/modal.js';
import { toast } from '../../ui/toast.js';
import { duplicateRecord, openQuickChangeModal, createSubItem } from '../../services/quickActions.js';

export function openViewModal(S, ent, id, callbacks = {}, stack = []) {
  if (!stack || !stack.length) {
    stack = [{ ent, id }];
  }

  const curr = stack[stack.length - 1];
  const cEnt = curr.ent;
  const cId = curr.id;

  const list = S[cEnt] || [];
  const r = list.find(x => x.id === cId);
  if (!r) return;

  const isMainEnt = ['projects', 'tasks', 'changes'].includes(cEnt);
  const entTitle = ENT[cEnt]?.ru || REFNAME[cEnt] || 'Запись';

  // Helper refs
  const st = statFor(S, cEnt, r.statusId);
  const pr = pri(S, r.priorityId);
  const sg = stg(S, r.stageId);
  const dv = emp(S, r.devId);
  const ag = emp(S, r.agentId);
  const pj = prj(S, r.projectId);
  const tk = tsk(S, r.taskId);

  // Navigation Breadcrumb HTML
  const breadcrumbHtml = `<div class="v-breadcrumb">
    ${stack.length > 1 ? `<button class="btn sm v-back" id="vBtnBack" style="font-weight:700">◀ Назад</button>` : ''}
    <div class="v-path">
      ${stack.map((s, idx) => {
        const item = (S[s.ent] || []).find(x => x.id === s.id);
        const codeName = item ? (item.num ? `${item.num} · ${item.name}` : item.name) : s.ent;
        const eLabel = ENT[s.ent]?.ru || REFNAME[s.ent] || s.ent;
        const isLast = idx === stack.length - 1;
        return isLast
          ? `<span class="v-step curr" title="${esc(codeName)}"><b>${esc(eLabel)}:</b> ${esc(codeName)}</span>`
          : `<button class="v-step link" data-stackidx="${idx}" title="${esc(codeName)}"><b>${esc(eLabel)}:</b> ${esc(codeName)}</button><span class="v-sep">›</span>`;
      }).join('')}
    </div>
  </div>`;

  // Hero Header Banner
  const heroHtml = `<div class="v-hero">
    <div class="v-hero-info">
      <div class="v-hero-tag">
        <span>${esc(entTitle.toUpperCase())}</span>
        ${r.num ? `<b class="mono" style="color:var(--acc);font-size:12px;background:#EBF5F8;padding:2px 8px;border-radius:4px">${esc(r.num)}</b>` : ''}
      </div>
      <div class="v-hero-title">${esc(r.name)}</div>
      <div class="v-hero-chips">
        ${st ? chipHtml(st.name, colorOf(st)) : ''}
        ${pr ? chipHtml(pr.name, colorOf(pr)) : ''}
        ${sg ? chipHtml('Этап: ' + sg.name, colorOf(sg)) : ''}
        ${r.role ? `<span class="chip" style="background:#EBF5FF;border-color:#BEE3F8;color:#2B6CB0">${r.role === 'dev' ? 'Разработчик' : 'Агент'}</span>` : ''}
        ${r.active !== undefined ? (r.active !== false ? '<span class="chip" style="background:#E6FFFA;border-color:#319795;color:#234E52">● Активен</span>' : '<span class="chip" style="background:#EDF2F7;border-color:#CBD5E0;color:#4A5568">○ Неактивен</span>') : ''}
      </div>
    </div>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <button class="btn sm" id="vBtnQuickChange" title="Сменить статус, приоритет, этап, ответственных" style="display:inline-flex;align-items:center;gap:4px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        Параметры
      </button>
      <button class="btn sm" id="vBtnDuplicate" title="Дублировать текущую запись" style="display:inline-flex;align-items:center;gap:4px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Дублировать
      </button>
      ${cEnt === 'projects' ? `<button class="btn sm" id="vBtnAddSubTask" title="Создать задачу к проекту" style="display:inline-flex;align-items:center;gap:4px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M12 5v14M5 12h14"/></svg>
        Задача
      </button>` : ''}
      <button class="btn sm" id="vBtnCopyCode" title="Скопировать название/код" style="display:inline-flex;align-items:center;gap:4px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        Копировать
      </button>
    </div>
  </div>`;

  // Multi-Pills for Agents & Devs
  const multiPills = key => ((r[key] || []).map(empId => {
    const e = emp(S, empId);
    return e ? chipHtml(e.name, colorOf(e)) : '';
  }).join(' ') || '<span style="color:var(--mut2)">—</span>');

  // Stats / Overview Grid
  let statsGrid = '';
  if (isMainEnt) {
    const progVal = cEnt === 'projects' && r.stageProgress
      ? Math.round(Object.values(r.stageProgress).reduce((a, b) => a + b, 0) / (Object.values(r.stageProgress).length || 1))
      : null;

    statsGrid = `<div class="v-stats-grid">
      <div class="v-stat-card">
        <div class="lbl">Сроки выполнения</div>
        <div class="val mono">${r.start ? fmtD(r.start) : '—'} → ${r.end ? fmtD(r.end) : '—'}</div>
      </div>
      ${dv || ag ? `<div class="v-stat-card">
        <div class="lbl">Главные ответственные</div>
        <div class="val" style="display:flex;gap:6px;flex-wrap:wrap">
          ${dv ? chipHtml('Дев: ' + dv.name, colorOf(dv)) : ''}
          ${ag ? chipHtml('Агент: ' + ag.name, colorOf(ag)) : ''}
        </div>
      </div>` : ''}
      ${pj ? `<div class="v-stat-card">
        <div class="lbl">Родительский проект</div>
        <div class="val"><button class="v-step link" id="vLinkParentPj" style="font-size:13.5px">📁 ${esc(pj.name)}</button></div>
      </div>` : ''}
      ${tk ? `<div class="v-stat-card">
        <div class="lbl">Родительская задача</div>
        <div class="val"><button class="v-step link" id="vLinkParentTk" style="font-size:13.5px">🛠 ${esc(tk.name)}</button></div>
      </div>` : ''}
      ${progVal !== null ? `<div class="v-stat-card">
        <div class="lbl">Общий прогресс этапов</div>
        <div class="val" style="display:flex;align-items:center;gap:8px">
          <div class="progbar" style="width:100px;height:9px"><i style="width:${progVal}%"></i></div>
          <span class="mono">${progVal}%</span>
        </div>
      </div>` : ''}
    </div>`;
  }

  // Children Lists
  let kidsHtml = '';
  if (cEnt === 'projects') {
    const ts = S.tasks.filter(t => t.projectId === r.id);
    kidsHtml = `<div>
      <div class="v-section-title">Задачи проекта (${ts.length})</div>
      <table class="mini-t">
        <thead><tr style="background:#F6F7F2"><td style="font-weight:700">№</td><td style="font-weight:700">Название</td><td style="font-weight:700">Статус</td><td style="font-weight:700">Разработчик</td><td style="font-weight:700">Сроки</td></tr></thead>
        <tbody>${ts.map(t => {
          const tst = statFor(S, 'tasks', t.statusId);
          const tdv = emp(S, t.devId);
          return `<tr data-tid="${t.id}">
            <td><b class="mono" style="color:var(--acc)">${esc(t.num)}</b></td>
            <td><b>${esc(t.name)}</b></td>
            <td>${tst ? chipHtml(tst.name, colorOf(tst)) : '—'}</td>
            <td>${tdv ? chipHtml(tdv.name, colorOf(tdv)) : '—'}</td>
            <td class="mono" style="font-size:12px;color:var(--mut)">${fmtD(t.start)} → ${fmtD(t.end)}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="5" style="color:var(--mut2);padding:12px;text-align:center">Задач пока нет</td></tr>'}</tbody>
      </table>
    </div>`;
  } else if (cEnt === 'tasks') {
    const cs = S.changes.filter(c => c.taskId === r.id);
    kidsHtml = `<div>
      <div class="v-section-title">Изменения по задаче (${cs.length})</div>
      <table class="mini-t">
        <thead><tr style="background:#F6F7F2"><td style="font-weight:700">№</td><td style="font-weight:700">Название</td><td style="font-weight:700">Статус</td><td style="font-weight:700">Разработчик</td><td style="font-weight:700">Сроки</td></tr></thead>
        <tbody>${cs.map(c => {
          const cst = statFor(S, 'changes', c.statusId);
          const cdv = emp(S, c.devId);
          return `<tr data-cid="${c.id}">
            <td><b class="mono" style="color:var(--acc)">${esc(c.num)}</b></td>
            <td><b>${esc(c.name)}</b></td>
            <td>${cst ? chipHtml(cst.name, colorOf(cst)) : '—'}</td>
            <td>${cdv ? chipHtml(cdv.name, colorOf(cdv)) : '—'}</td>
            <td class="mono" style="font-size:12px;color:var(--mut)">${fmtD(c.start)} → ${fmtD(c.end)}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="5" style="color:var(--mut2);padding:12px;text-align:center">Изменений пока нет</td></tr>'}</tbody>
      </table>
    </div>`;
  } else if (cEnt === 'employees') {
    const pjs = S.projects.filter(p => p.devId === r.id || p.agentId === r.id || (p.devs || []).includes(r.id) || (p.agents || []).includes(r.id));
    const tks = S.tasks.filter(t => t.devId === r.id || t.agentId === r.id || (t.devs || []).includes(r.id) || (t.agents || []).includes(r.id));

    kidsHtml = `<div>
      <div class="v-section-title">Проекты с участием (${pjs.length})</div>
      <table class="mini-t" style="margin-bottom:16px">
        <tbody>${pjs.map(p => {
          const pst = statFor(S, 'projects', p.statusId);
          return `<tr data-pid="${p.id}">
            <td><b class="mono" style="color:var(--acc)">${esc(p.num)}</b></td>
            <td><b>${esc(p.name)}</b></td>
            <td>${pst ? chipHtml(pst.name, colorOf(pst)) : '—'}</td>
            <td class="mono" style="font-size:12px">${fmtD(p.start)} → ${fmtD(p.end)}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="4" style="color:var(--mut2);padding:12px;text-align:center">Нет привязанных проектов</td></tr>'}</tbody>
      </table>

      <div class="v-section-title">Задачи с участием (${tks.length})</div>
      <table class="mini-t">
        <tbody>${tks.map(t => {
          const tst = statFor(S, 'tasks', t.statusId);
          return `<tr data-tid="${t.id}">
            <td><b class="mono" style="color:var(--acc)">${esc(t.num)}</b></td>
            <td><b>${esc(t.name)}</b></td>
            <td>${tst ? chipHtml(tst.name, colorOf(tst)) : '—'}</td>
            <td class="mono" style="font-size:12px">${fmtD(t.start)} → ${fmtD(t.end)}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="4" style="color:var(--mut2);padding:12px;text-align:center">Нет привязанных задач</td></tr>'}</tbody>
      </table>
    </div>`;
  } else if (cEnt === 'priorities') {
    const pjs = S.projects.filter(p => p.priorityId === r.id);
    const tks = S.tasks.filter(t => t.priorityId === r.id);
    const chs = S.changes.filter(c => c.priorityId === r.id);

    kidsHtml = `<div>
      <div class="v-section-title">Проекты с приоритетом «${esc(r.name)}» (${pjs.length})</div>
      <table class="mini-t" style="margin-bottom:16px">
        <tbody>${pjs.map(p => {
          const pst = statFor(S, 'projects', p.statusId);
          return `<tr data-pid="${p.id}">
            <td><b class="mono" style="color:var(--acc)">${esc(p.num)}</b></td>
            <td><b>${esc(p.name)}</b></td>
            <td>${pst ? chipHtml(pst.name, colorOf(pst)) : '—'}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="3" style="color:var(--mut2);padding:12px;text-align:center">Нет привязанных проектов</td></tr>'}</tbody>
      </table>

      <div class="v-section-title">Задачи с приоритетом «${esc(r.name)}» (${tks.length})</div>
      <table class="mini-t" style="margin-bottom:16px">
        <tbody>${tks.map(t => {
          const tst = statFor(S, 'tasks', t.statusId);
          return `<tr data-tid="${t.id}">
            <td><b class="mono" style="color:var(--acc)">${esc(t.num)}</b></td>
            <td><b>${esc(t.name)}</b></td>
            <td>${tst ? chipHtml(tst.name, colorOf(tst)) : '—'}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="3" style="color:var(--mut2);padding:12px;text-align:center">Нет привязанных задач</td></tr>'}</tbody>
      </table>

      <div class="v-section-title">Изменения с приоритетом «${esc(r.name)}» (${chs.length})</div>
      <table class="mini-t">
        <tbody>${chs.map(c => {
          const cst = statFor(S, 'changes', c.statusId);
          return `<tr data-cid="${c.id}">
            <td><b class="mono" style="color:var(--acc)">${esc(c.num)}</b></td>
            <td><b>${esc(c.name)}</b></td>
            <td>${cst ? chipHtml(cst.name, colorOf(cst)) : '—'}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="3" style="color:var(--mut2);padding:12px;text-align:center">Нет привязанных изменений</td></tr>'}</tbody>
      </table>
    </div>`;
  } else if (cEnt === 'projectStatuses') {
    const pjs = S.projects.filter(p => p.statusId === r.id);
    kidsHtml = `<div>
      <div class="v-section-title">Проекты в статусе «${esc(r.name)}» (${pjs.length})</div>
      <table class="mini-t">
        <tbody>${pjs.map(p => `
          <tr data-pid="${p.id}">
            <td><b class="mono" style="color:var(--acc)">${esc(p.num)}</b></td>
            <td><b>${esc(p.name)}</b></td>
            <td class="mono" style="font-size:12px">${fmtD(p.start)} → ${fmtD(p.end)}</td>
          </tr>
        `).join('') || '<tr><td colspan="3" style="color:var(--mut2);padding:12px;text-align:center">Нет проектов в этом статусе</td></tr>'}</tbody>
      </table>
    </div>`;
  } else if (cEnt === 'taskStatuses') {
    const tks = S.tasks.filter(t => t.statusId === r.id);
    const chs = S.changes.filter(c => c.statusId === r.id);
    kidsHtml = `<div>
      <div class="v-section-title">Задачи в статусе «${esc(r.name)}» (${tks.length})</div>
      <table class="mini-t" style="margin-bottom:16px">
        <tbody>${tks.map(t => `
          <tr data-tid="${t.id}">
            <td><b class="mono" style="color:var(--acc)">${esc(t.num)}</b></td>
            <td><b>${esc(t.name)}</b></td>
            <td class="mono" style="font-size:12px">${fmtD(t.start)} → ${fmtD(t.end)}</td>
          </tr>
        `).join('') || '<tr><td colspan="3" style="color:var(--mut2);padding:12px;text-align:center">Нет задач в этом статусе</td></tr>'}</tbody>
      </table>

      <div class="v-section-title">Изменения в статусе «${esc(r.name)}» (${chs.length})</div>
      <table class="mini-t">
        <tbody>${chs.map(c => `
          <tr data-cid="${c.id}">
            <td><b class="mono" style="color:var(--acc)">${esc(c.num)}</b></td>
            <td><b>${esc(c.name)}</b></td>
            <td class="mono" style="font-size:12px">${fmtD(c.start)} → ${fmtD(c.end)}</td>
          </tr>
        `).join('') || '<tr><td colspan="3" style="color:var(--mut2);padding:12px;text-align:center">Нет изменений в этом статусе</td></tr>'}</tbody>
      </table>
    </div>`;
  } else if (cEnt === 'stages') {
    const pjs = S.projects.filter(p => p.stageId === r.id);
    kidsHtml = `<div>
      <div class="v-section-title">Проекты на этапе «${esc(r.name)}» (${pjs.length})</div>
      <table class="mini-t">
        <tbody>${pjs.map(p => `
          <tr data-pid="${p.id}">
            <td><b class="mono" style="color:var(--acc)">${esc(p.num)}</b></td>
            <td><b>${esc(p.name)}</b></td>
            <td class="mono" style="font-size:12px">${fmtD(p.start)} → ${fmtD(p.end)}</td>
          </tr>
        `).join('') || '<tr><td colspan="3" style="color:var(--mut2);padding:12px;text-align:center">Нет проектов на этом этапе</td></tr>'}</tbody>
      </table>
    </div>`;
  }

  // Stage History Tab HTML (for Projects)
  let histHtml = '';
  if (cEnt === 'projects') {
    const h = S.history.filter(x => x.projectId === r.id).sort((a, b) => a.ts < b.ts ? 1 : -1);
    histHtml = `<div>
      <div class="v-section-title">Журнал изменения этапов</div>
      <table class="mini-t hist">${h.map(x => {
        const stgName = (S.stages.find(s => s.id === x.stageId) || {}).name || 'Этап';
        const delta = x.to - x.from;
        const dStr = delta > 0 ? `<span class="delta-up">+${delta}%</span>` : `<span class="delta-dn">${delta}%</span>`;
        return `<tr><td class="mono" style="color:var(--mut);width:150px">${fmtDT(x.ts)}</td><td><b>${esc(stgName)}</b>: ${x.from}% → ${x.to}% (${dStr})</td></tr>`;
      }).join('') || '<tr><td style="color:var(--mut2);padding:12px;text-align:center">История пуста</td></tr>'}</table>
    </div>`;
  }

  // Detailed Key-Value Grid
  const detailsHtml = `<dl class="dl" style="margin-bottom:16px">
    ${r.num ? `<dt>Номер / Код</dt><dd><b class="mono" style="font-size:14px;color:var(--acc)">${esc(r.num)}</b></dd>` : ''}
    <dt>Название</dt><dd><b style="font-size:14px;color:var(--ink)">${esc(r.name)}</b></dd>
    ${r.extNum ? `<dt>№ в системе</dt><dd><span class="mono">${esc(r.extNum)}</span></dd>` : ''}
    ${r.extLink ? `<dt>Внешняя ссылка</dt><dd><a href="${esc(r.extLink)}" target="_blank" rel="noopener" style="color:var(--acc);font-weight:600">🔗 ${esc(r.extLink)}</a></dd>` : ''}
    ${r.position ? `<dt>Должность / Компания</dt><dd><b>${esc(r.position)}</b></dd>` : ''}
    ${r.weight !== undefined ? `<dt>Вес приоритета</dt><dd class="mono"><b>${r.weight}</b></dd>` : ''}
    ${r.order !== undefined ? `<dt>Порядок сортировки</dt><dd class="mono"><b>${r.order}</b></dd>` : ''}
    ${cEnt !== 'changes' && isMainEnt ? `<dt>Участники Агенты</dt><dd>${multiPills('agents')}</dd>` : ''}
    ${cEnt !== 'changes' && isMainEnt ? `<dt>Участники Разработчики</dt><dd>${multiPills('devs')}</dd>` : ''}
    ${r.createdAt ? `<dt>Создано / Изменено</dt><dd><span class="mono" style="font-size:11.5px;color:var(--mut)">${fmtDT(r.createdAt)} / ${fmtDT(r.updatedAt)}</span></dd>` : ''}
  </dl>`;

  // Description and Notes Boxes
  const descHtml = r.desc ? `<div style="margin-bottom:14px">
    <div class="v-section-title">Описание</div>
    <div style="white-space:pre-wrap;background:#F8F9F4;padding:12px 14px;border-radius:8px;border:1px solid var(--line2);font-size:13px;line-height:1.5">${esc(r.desc)}</div>
  </div>` : '';

  const noteHtml = r.note ? `<div style="margin-bottom:14px">
    <div class="v-section-title">Примечание</div>
    <div style="white-space:pre-wrap;background:#FFFDF5;padding:10px 12px;border-radius:8px;border:1px solid #F6E05E;font-size:12.5px;color:#744210">${esc(r.note)}</div>
  </div>` : '';

  const body = `
    ${breadcrumbHtml}
    <div style="padding:16px 20px">
      ${heroHtml}
      ${statsGrid}

      <div class="ftabs" id="vtabs" style="padding:0;margin-bottom:14px">
        <button class="on" data-vt="main">Основное</button>
        ${kidsHtml ? `<button data-vt="kids">Связи / Дочерние</button>` : ''}
        ${histHtml ? `<button data-vt="hist">История этапов</button>` : ''}
      </div>

      <div id="vbody">
        <div id="vt-main">
          ${detailsHtml}
          ${descHtml}
          ${noteHtml}
        </div>
        ${kidsHtml ? `<div id="vt-kids" class="hidden">${kidsHtml}</div>` : ''}
        ${histHtml ? `<div id="vt-hist" class="hidden">${histHtml}</div>` : ''}
      </div>
    </div>`;

  modal({
    title: esc(r.name),
    sub: `${entTitle.toUpperCase()} · ${r.num || ('ID ' + r.id)}`,
    wide: true,
    body,
    foot: `
      ${stack.length > 1 ? `<button class="btn" id="vFootBack">◀ Назад</button>` : ''}
      <button class="btn" data-edit>Редактировать</button>
      <button class="btn pri" data-x>Закрыть</button>
    `,
    mount(box) {
      // Tab switching
      box.el.querySelectorAll('#vtabs button').forEach(btn => btn.onclick = () => {
        box.el.querySelectorAll('#vtabs button').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        const vt = btn.dataset.vt;
        const mainEl = box.el.querySelector('#vt-main');
        const kidsEl = box.el.querySelector('#vt-kids');
        const histEl = box.el.querySelector('#vt-hist');

        if (mainEl) mainEl.classList.toggle('hidden', vt !== 'main');
        if (kidsEl) kidsEl.classList.toggle('hidden', vt !== 'kids');
        if (histEl) histEl.classList.toggle('hidden', vt !== 'hist');
      });

      // Close & Edit actions
      box.el.querySelector('[data-x]').onclick = () => box.close();
      box.el.querySelector('[data-edit]').onclick = () => {
        box.close();
        if (isMainEnt) {
          if (callbacks.onEdit) callbacks.onEdit(cEnt, cId);
        } else {
          if (callbacks.onEditDir) callbacks.onEditDir(cEnt, cId);
        }
      };

      // Quick Change Button
      const quickBtn = box.el.querySelector('#vBtnQuickChange');
      if (quickBtn) {
        quickBtn.onclick = () => {
          openQuickChangeModal(S, cEnt, cId, {
            autoSave: callbacks.autoSave,
            onSuccess: () => {
              box.close();
              openViewModal(S, cEnt, cId, callbacks, stack);
            }
          });
        };
      }

      // Duplicate Button
      const dupBtn = box.el.querySelector('#vBtnDuplicate');
      if (dupBtn) {
        dupBtn.onclick = async () => {
          const newId = await duplicateRecord(S, cEnt, cId, callbacks.autoSave);
          if (newId) {
            box.close();
            openViewModal(S, cEnt, newId, callbacks, [...stack.slice(0, -1), { ent: cEnt, id: newId }]);
          }
        };
      }

      // Add Sub Task Button
      const addSubTaskBtn = box.el.querySelector('#vBtnAddSubTask');
      if (addSubTaskBtn) {
        addSubTaskBtn.onclick = () => {
          box.close();
          createSubItem(S, 'projects', cId, 'tasks', callbacks);
        };
      }

      // Add Sub Change Button
      const addSubChangeBtn = box.el.querySelector('#vBtnAddSubChange');
      if (addSubChangeBtn) {
        addSubChangeBtn.onclick = () => {
          box.close();
          createSubItem(S, 'tasks', cId, 'changes', callbacks);
        };
      }

      // Copy Code Button
      const copyBtn = box.el.querySelector('#vBtnCopyCode');
      if (copyBtn) {
        copyBtn.onclick = () => {
          const str = r.num ? `${r.num} · ${r.name}` : r.name;
          navigator.clipboard.writeText(str);
          toast('Скопировано: ' + str, 'ok');
        };
      }

      // Back navigation button ("Назад")
      const backNav = () => {
        if (stack.length > 1) {
          box.close();
          const newStack = stack.slice(0, stack.length - 1);
          openViewModal(S, newStack[newStack.length - 1].ent, newStack[newStack.length - 1].id, callbacks, newStack);
        }
      };

      const btnBackTop = box.el.querySelector('#vBtnBack');
      const btnBackFoot = box.el.querySelector('#vFootBack');
      if (btnBackTop) btnBackTop.onclick = backNav;
      if (btnBackFoot) btnBackFoot.onclick = backNav;

      // Clickable Breadcrumbs
      box.el.querySelectorAll('.v-step.link[data-stackidx]').forEach(btn => {
        btn.onclick = () => {
          const idx = +btn.dataset.stackidx;
          const newStack = stack.slice(0, idx + 1);
          const target = newStack[newStack.length - 1];
          box.close();
          openViewModal(S, target.ent, target.id, callbacks, newStack);
        };
      });

      // Clickable Parents in stats
      const linkParentPj = box.el.querySelector('#vLinkParentPj');
      if (linkParentPj && pj) {
        linkParentPj.onclick = () => {
          box.close();
          openViewModal(S, 'projects', pj.id, callbacks, [...stack, { ent: 'projects', id: pj.id }]);
        };
      }
      const linkParentTk = box.el.querySelector('#vLinkParentTk');
      if (linkParentTk && tk) {
        linkParentTk.onclick = () => {
          box.close();
          openViewModal(S, 'tasks', tk.id, callbacks, [...stack, { ent: 'tasks', id: tk.id }]);
        };
      }

      // Clickable Sub-Items (Tasks, Changes, Projects)
      box.el.querySelectorAll('tr[data-tid]').forEach(tr => tr.onclick = () => {
        const tid = +tr.dataset.tid;
        box.close();
        openViewModal(S, 'tasks', tid, callbacks, [...stack, { ent: 'tasks', id: tid }]);
      });

      box.el.querySelectorAll('tr[data-cid]').forEach(tr => tr.onclick = () => {
        const cid = +tr.dataset.cid;
        box.close();
        openViewModal(S, 'changes', cid, callbacks, [...stack, { ent: 'changes', id: cid }]);
      });

      box.el.querySelectorAll('tr[data-pid]').forEach(tr => tr.onclick = () => {
        const pid = +tr.dataset.pid;
        box.close();
        openViewModal(S, 'projects', pid, callbacks, [...stack, { ent: 'projects', id: pid }]);
      });
    }
  });
}
