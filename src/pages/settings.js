// src/pages/settings.js
import { doExport, doImport } from '../services/storage.js';
import { seedDemo, addDemoProjects } from '../services/seed.js';
import { confirmBox } from '../ui/modal.js';
import { db, refreshAll } from '../core/db.js';
import { afterChange, setDbBeacon } from '../utils/logger.js';
import { toast } from '../ui/toast.js';

import { exportToGoogleSheets } from '../services/sheets.js';
import { googleSignIn, logout } from '../services/auth.js';

export function renderSettingsPage(S, mount, callbacks = {}) {
  mount.innerHTML = `
    <div class="phead">
      <div><div class="kick">Параметры и управление данными</div><h1>Настройки и Резервное копирование</h1></div>
    </div>
    <div class="setgrid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
      <div class="setcard">
        <h3>📊 Google Sheets Синхронизация</h3>
        <p style="font-size:12.5px;color:var(--mut);margin-bottom:14px;line-height:1.5">
          ${S.user ? `Авторизован как: <b>${S.user.email || S.user.displayName}</b>` : 'Войдите с помощью Google, чтобы экспортировать данные в Google Таблицы.'}
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${S.needsAuth !== false || !S.user ? `
            <button class="gsi-material-button" id="btnGoogleLogin" style="background:#fff;border:1px solid #dadce0;border-radius:4px;padding:0 12px;height:40px;cursor:pointer;display:inline-flex;align-items:center;gap:10px;">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
              <span style="font-family:'Google Sans',Roboto,sans-serif;font-size:14px;color:#3c4043;font-weight:500;">Sign in with Google</span>
            </button>
          ` : `
            <button class="btn pri" id="btnExportSheets" style="background:#0F9D58;border-color:#0F9D58">📊 Экспорт в Sheets</button>
            <button class="btn" id="btnGoogleLogout">Выйти</button>
          `}
        </div>
      </div>
      <div class="setcard">
        <h3>📂 Экспорт и Импорт (JSON)</h3>
        <p style="font-size:12.5px;color:var(--mut);margin-bottom:14px;line-height:1.5">Сохраняйте снимки локальной базы данных или восстанавливайте данные из файла резервной копии.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn pri" id="btnExport">💾 Скачать копию (JSON)</button>
          <label class="btn" style="cursor:pointer">
            📥 Импортировать JSON
            <input type="file" id="fileImp" accept=".json" style="display:none">
          </label>
        </div>
      </div>

      <div class="setcard">
        <h3>⚡ Демо-данные и Очистка</h3>
        <p style="font-size:12.5px;color:var(--mut);margin-bottom:14px;line-height:1.5">Загружайте тестовые проекты и справочники для проверки работы приложения или полностью очищайте локальную БД.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="btnDemoAll">Загрузить демо (Все)</button>
          <button class="btn" id="btnDemoPrj">+ Демо-проекты</button>
          <button class="btn dgr" id="btnClearAll">🧹 Очистить всё</button>
        </div>
      </div>

      <div class="setcard">
        <h3>🤖 Автосохранение в локальный файл</h3>
        <p style="font-size:12.5px;color:var(--mut);margin-bottom:14px;line-height:1.5" id="fsStatusText">
          ${S.fileHandle ? `Подключен файл: <b>${S.fileHandle.name}</b><br><span id="fsPermStatus" style="color:var(--mut2)">Проверка прав...</span>` : 'Вы можете привязать файл на диске, в который изменения будут автоматически записываться в реальном времени (File System Access API).'}
        </p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="btnPickFile">${S.fileHandle ? 'Сменить файл' : '🔗 Выбрать файл для автосохранения'}</button>
          ${S.fileHandle ? `<button class="btn pri hidden" id="btnGrantPerm">🔓 Разрешить запись</button>` : ''}
        </div>
      </div>
    </div>`;

  // Verify permission if handle exists
  if (S.fileHandle) {
    S.fileHandle.queryPermission({ mode: 'readwrite' }).then(perm => {
      const pStat = mount.querySelector('#fsPermStatus');
      const bGrant = mount.querySelector('#btnGrantPerm');
      if (perm === 'granted') {
        if (pStat) pStat.innerHTML = '<span style="color:var(--grn)">Автосохранение активно</span>';
      } else {
        if (pStat) pStat.innerHTML = '<span style="color:var(--amb)">Требуется разрешение на запись после перезагрузки</span>';
        if (bGrant) {
          bGrant.classList.remove('hidden');
          bGrant.onclick = async () => {
            const req = await S.fileHandle.requestPermission({ mode: 'readwrite' });
            if (req === 'granted') {
              toast('Разрешение получено', 'ok');
              renderSettingsPage(S, mount, callbacks);
              if (callbacks.autoSave) callbacks.autoSave(); // Trigger an immediate save
            }
          };
        }
      }
    });
  }

  const btnGoogleLogin = mount.querySelector('#btnGoogleLogin');
  if (btnGoogleLogin) {
    btnGoogleLogin.onclick = async () => {
      try {
        const { user } = await googleSignIn();
        S.user = user;
        S.needsAuth = false;
        toast('Авторизация успешна', 'ok');
        renderSettingsPage(S, mount, callbacks);
      } catch (e) {
        toast('Ошибка авторизации', 'err');
      }
    };
  }

  const btnGoogleLogout = mount.querySelector('#btnGoogleLogout');
  if (btnGoogleLogout) {
    btnGoogleLogout.onclick = async () => {
      await logout();
      S.user = null;
      S.needsAuth = true;
      toast('Вы вышли из аккаунта Google', 'ok');
      renderSettingsPage(S, mount, callbacks);
    };
  }

  const btnExportSheets = mount.querySelector('#btnExportSheets');
  if (btnExportSheets) {
    btnExportSheets.onclick = async () => {
      try {
        toast('Экспорт в Google Таблицы...', 'ok');
        const url = await exportToGoogleSheets(S);
        toast('Экспорт успешно завершен!', 'ok');
        window.open(url, '_blank');
      } catch (e) {
        console.error(e);
        toast('Ошибка экспорта в Google Sheets: ' + e.message, 'err');
      }
    };
  }

  mount.querySelector('#btnExport').onclick = () => doExport(S);

  const fileImp = mount.querySelector('#fileImp');
  fileImp.onchange = e => {
    const file = e.target.files[0];
    if (file) {
      confirmBox('Заменить текущие данные информацией из файла?', () => {
        doImport(S, file, () => {
          if (callbacks.onRefreshPage) callbacks.onRefreshPage();
        });
      });
    }
  };

  mount.querySelector('#btnDemoAll').onclick = () => {
    confirmBox('Заполнить базу полными демо-данными (справочники + проекты)?', async () => {
      await seedDemo(S, true);
      await refreshAll(S);
      await afterChange(S, callbacks.autoSave);
      toast('Демо-данные успешно загружены', 'ok');
      if (callbacks.onRefreshPage) callbacks.onRefreshPage();
    });
  };

  mount.querySelector('#btnDemoPrj').onclick = () => {
    confirmBox('Добавить еще комплект тестовых проектов?', async () => {
      await addDemoProjects(S);
      await refreshAll(S);
      await afterChange(S, callbacks.autoSave);
      toast('Демо-проекты добавлены', 'ok');
      if (callbacks.onRefreshPage) callbacks.onRefreshPage();
    });
  };

  mount.querySelector('#btnClearAll').onclick = () => {
    confirmBox('Вы абсолютно уверены? Все проекты, задачи, изменения и справочники будут БЕЗВОЗВРАТНО удалены!', async () => {
      for (const t of ['projects', 'tasks', 'changes', 'employees', 'priorities', 'taskStatuses', 'projectStatuses', 'stages', 'stageHistory']) {
        await db[t].clear();
      }
      S.counters = { p: 0, t: 0, c: 0 };
      await db.meta.put({ key: 'counters', value: S.counters });
      await refreshAll(S);
      await afterChange(S, callbacks.autoSave);
      toast('База данных полностью очищена', 'ok');
      if (callbacks.onRefreshPage) callbacks.onRefreshPage();
    });
  };

  mount.querySelector('#btnPickFile').onclick = async () => {
    if (!window.showSaveFilePicker) return toast('Ваш браузер не поддерживает File System Access API', 'err');
    try {
      S.fileHandle = await window.showSaveFilePicker({
        suggestedName: 'projects_app_data.json',
        types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }]
      });
      await db.meta.put({ key: 'fileHandle', value: S.fileHandle });
      toast('Файл подключен для автосохранения: ' + S.fileHandle.name, 'ok');
      renderSettingsPage(S, mount, callbacks);
      if (callbacks.autoSave) callbacks.autoSave(); // immediately trigger a save
    } catch (e) {}
  };
}
