// src/pages/settings.js
import { doExport, doImport } from '../services/storage.js';
import { seedDemo, addDemoProjects } from '../services/seed.js';
import { confirmBox } from '../ui/modal.js';
import { db, refreshAll } from '../core/db.js';
import { afterChange, setDbBeacon } from '../utils/logger.js';
import { toast } from '../ui/toast.js';

export function renderSettingsPage(S, mount, callbacks = {}) {
  mount.innerHTML = `
    <div class="phead">
      <div><div class="kick">Параметры и управление данными</div><h1>Настройки и Резервное копирование</h1></div>
    </div>
    <div class="setgrid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
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
        <p style="font-size:12.5px;color:var(--mut);margin-bottom:14px;line-height:1.5">
          ${S.fileHandle ? `Подключен файл: <b>${S.fileHandle.name}</b>` : 'Вы можете привязать файл на диске, в который изменения будут автоматически записываться в реальном времени (File System Access API).'}
        </p>
        <div>
          <button class="btn" id="btnPickFile">${S.fileHandle ? 'Сменить файл' : '🔗 Выбрать файл для автосохранения'}</button>
        </div>
      </div>
    </div>`;

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
      toast('Файл подключен для автосохранения: ' + S.fileHandle.name, 'ok');
      renderSettingsPage(S, mount, callbacks);
    } catch (e) {}
  };
}
