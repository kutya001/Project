// src/app.js
import { state } from './core/state.js';
import { db, refreshAll } from './core/db.js';
import { router } from './core/router.js';
import { bus } from './core/events.js';
import { $ } from './utils/dom.js';
import { setDbBeacon, updateBackupBeacon, updateCounts, afterChange } from './utils/logger.js';
import { seedDemo } from './services/seed.js';
import { createScheduleAutoFile } from './services/storage.js';
import { openProjectForm } from './pages/forms/ProjectForm.js';
import { openTaskForm } from './pages/forms/TaskForm.js';
import { openChangeForm } from './pages/forms/ChangeForm.js';
import { openDirForm } from './pages/forms/DirForm.js';
import { openViewModal } from './pages/forms/ViewForm.js';
import { renderProjectsPage } from './pages/projects.js';
import { renderTasksPage } from './pages/tasks.js';
import { renderChangesPage } from './pages/changes.js';
import { renderRefsPage } from './pages/refs.js';
import { renderSettingsPage } from './pages/settings.js';
import { confirmBox } from './ui/modal.js';
import { toast } from './ui/toast.js';

export async function initApp() {
  const S = state.raw();
  const autoSave = createScheduleAutoFile(S);

  // 1. Initialize Meta & DB
  try {
    const [pRec, cRec, lsRec, leRec] = await Promise.all([
      db.meta.get('prefs'),
      db.meta.get('counters'),
      db.meta.get('lastSaved'),
      db.meta.get('lastExport')
    ]);

    if (pRec && pRec.value) S.prefs = Object.assign(S.prefs, pRec.value);
    if (cRec && cRec.value) S.counters = cRec.value;
    if (lsRec && lsRec.value) S.lastSaved = lsRec.value;
    if (leRec && leRec.value) S.lastExport = leRec.value;

    await refreshAll(S);

    // Seed initial demo data if empty
    if (!S.projects.length && !S.taskStatuses.length) {
      await seedDemo(S, true);
      await refreshAll(S);
    }

    setDbBeacon('saved', '🟢 База данных подключена');
  } catch (err) {
    setDbBeacon('error', '🔴 Ошибка IndexedDB');
    console.error('DB Init Error:', err);
  }

  updateCounts(S);
  updateBackupBeacon(S);

  // 2. Navigation bar & routes
  const pageMount = $('#page');

  const callbacks = {
    autoSave,
    onAdd(ent) {
      if (ent === 'projects') openProjectForm(S, null, autoSave);
      else if (ent === 'tasks') openTaskForm(S, null, {}, autoSave);
      else openChangeForm(S, null, {}, autoSave);
    },
    onView(ent, id) {
      openViewModal(S, ent, id, callbacks);
    },
    onEdit(ent, id) {
      if (ent === 'projects') openProjectForm(S, id, autoSave);
      else if (ent === 'tasks') openTaskForm(S, id, {}, autoSave);
      else openChangeForm(S, id, {}, autoSave);
    },
    onDelete(ent, id) {
      const item = S[ent].find(x => x.id === id);
      if (!item) return;
      confirmBox(`Удалить «${item.name}» (${item.num})?`, async () => {
        try {
          await db[ent].delete(id);
          await refreshAll(S);
          await afterChange(S, autoSave);
          toast('Удалено', 'ok');
          renderCurrentPage();
        } catch (e) {
          setDbBeacon('error', '🔴 Ошибка базы данных');
          toast('Ошибка удаления', 'err');
        }
      });
    },
    onAddDir(type) { openDirForm(S, type, null, autoSave); },
    onEditDir(type, id) { openDirForm(S, type, id, autoSave); },
    onRefreshPage() { renderCurrentPage(); }
  };

  function renderCurrentPage() {
    const p = router.getRoute();
    S.page = p;

    // Update active nav button
    document.querySelectorAll('nav .nv').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.page === p);
    });

    if (p === 'projects') renderProjectsPage(S, pageMount, callbacks);
    else if (p === 'tasks') renderTasksPage(S, pageMount, callbacks);
    else if (p === 'changes') renderChangesPage(S, pageMount, callbacks);
    else if (p === 'refs') renderRefsPage(S, pageMount, callbacks);
    else if (p === 'settings') renderSettingsPage(S, pageMount, callbacks);
    else renderProjectsPage(S, pageMount, callbacks);
  }

  // Mobile Sidebar Menu logic
  const sideEl = $('#side');
  const overlayEl = $('#sideOverlay');
  const btnMobileMenu = $('#btnMobileMenu');

  function toggleMobileMenu(open) {
    if (!sideEl || !overlayEl) return;
    const isOpened = open !== undefined ? open : !sideEl.classList.contains('open');
    sideEl.classList.toggle('open', isOpened);
    overlayEl.classList.toggle('open', isOpened);
  }

  if (btnMobileMenu) btnMobileMenu.onclick = () => toggleMobileMenu();
  if (overlayEl) overlayEl.onclick = () => toggleMobileMenu(false);

  // Bind nav bar click listeners
  document.querySelectorAll('nav .nv').forEach(btn => {
    btn.onclick = () => {
      toggleMobileMenu(false);
      router.go(btn.dataset.page);
    };
  });

  // Topbar search input
  const topSearch = $('#topSearch');
  if (topSearch) {
    topSearch.oninput = e => {
      S.search = e.target.value.trim();
      renderCurrentPage();
    };
  }

  // Router listener
  router.on('route:change', () => {
    renderCurrentPage();
  });

  // Refresh view on state changes
  bus.on('state:change', () => {
    updateCounts(S);
  });

  // Start router
  router.start();
}
