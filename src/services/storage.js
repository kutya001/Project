// src/services/storage.js
import { db, refreshAll } from '../core/db.js';
import { savePrefs } from '../core/prefs.js';
import { nowIso, fmtDT, stamp } from '../utils/date.js';
import { download, debounce, $ } from '../utils/dom.js';
import { updateBackupBeacon, afterChange, setDbBeacon } from '../utils/logger.js';
import { toast } from '../ui/toast.js';

export function buildSnapshot(S) {
  return {
    version: 1,
    app: 'ProjectsSPA',
    exportDate: nowIso(),
    data: {
      projects: S.projects,
      tasks: S.tasks,
      changes: S.changes,
      employees: S.employees,
      priorities: S.priorities,
      taskStatuses: S.taskStatuses,
      projectStatuses: S.projectStatuses,
      stages: S.stages,
      stageHistory: S.history,
      kanbanBoards: S.kanbanBoards || [],
      prefs: S.prefs,
      counters: S.counters
    }
  };
}

export async function doExport(S) {
  try {
    download('app_backup_' + stamp() + '.json', JSON.stringify(buildSnapshot(S), null, 2));
    S.lastExport = nowIso();
    await db.meta.put({ key: 'lastExport', value: S.lastExport });
    updateBackupBeacon(S);
    const sbExport = $('#sbExport');
    if (sbExport) sbExport.textContent = fmtDT(S.lastExport);
    toast('Экспорт выполнен: app_backup_' + stamp() + '.json', 'ok');
  } catch (e) {
    toast('Ошибка экспорта', 'err');
  }
}

export async function doImport(S, file, onComplete) {
  try {
    const txt = await file.text();
    if (!txt.trim()) return toast('Неверный формат файла: файл пустой', 'err');

    let obj;
    try {
      obj = JSON.parse(txt);
    } catch (e) {
      return toast('Файл поврежден: невалидный JSON', 'err');
    }

    let data = null;
    if (obj && obj.data && typeof obj.data === 'object' && Array.isArray(obj.data.projects)) {
      data = obj.data;
    } else if (obj && Array.isArray(obj.records)) {
      data = {
        projects: obj.records.filter(r => r && r.name).map((r, i) => ({
          num: 'P-' + String(i + 1).padStart(3, '0'),
          name: r.name,
          desc: r.description || '',
          stageProgress: {},
          agents: [],
          devs: [],
          createdAt: r.createdAt || nowIso()
        })),
        tasks: [],
        changes: []
      };
    }

    if (!data) return toast('Структура данных не поддерживается', 'err');

    const tablesToSync = ['projects', 'tasks', 'changes', 'employees', 'priorities', 'taskStatuses', 'projectStatuses', 'stages', 'stageHistory', 'kanbanBoards'];

    for (const t of tablesToSync) {
      if (db[t]) await db[t].clear();
    }

    for (const k of tablesToSync) {
      const arr = Array.isArray(data[k]) ? data[k].filter(x => x && typeof x === 'object') : [];
      if (arr.length && db[k]) await db[k].bulkAdd(arr);
    }

    if (data.prefs && typeof data.prefs === 'object') S.prefs = Object.assign(S.prefs, data.prefs);
    if (data.counters) S.counters = data.counters;
    else {
      S.counters = { p: S.projects.length, t: S.tasks.length, c: S.changes.length };
    }

    await savePrefs(S);
    await refreshAll(S);
    await afterChange(S, () => autoSaveNow(S));
    toast('Импорт выполнен успешно', 'ok');
    if (onComplete) onComplete();
  } catch (e) {
    setDbBeacon('error', '🔴 Ошибка базы данных');
    toast('Ошибка импорта: ' + e.message, 'err');
  }
}

export async function autoSaveNow(S) {
  if (!S.fileHandle) return;
  try {
    const perm = await S.fileHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      console.warn('Auto-save skipped: Write permission not granted (requires user interaction in Settings).');
      return;
    }
    const w = await S.fileHandle.createWritable();
    await w.write(JSON.stringify(buildSnapshot(S), null, 2));
    await w.close();
  } catch (e) {
    console.error('Ошибка авто-сохранения в файл:', e);
  }
}

export function createScheduleAutoFile(S) {
  return debounce(() => autoSaveNow(S), 900);
}
