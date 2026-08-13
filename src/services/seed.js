// src/services/seed.js
import { db, refreshAll } from '../core/db.js';
import { todayISO, addDays, nowIso } from '../utils/date.js';

export async function seedDemo(S, withProjects) {
  const ps = [['В процессе', '#2F9E63'], ['Отложен', '#E8A13C'], ['Очередь', '#7B8AA6'], ['Отменен', '#D1495B'], ['Отозван', '#9C7BC0']];
  const ts = [['Бэклог', '#8A94A6', 1], ['В работе', '#2D7DD2', 2], ['Ревью', '#7C5CFC', 3], ['Тестирование', '#E8A13C', 4], ['Готово', '#2F9E63', 5], ['Блокировано', '#D1495B', 6]];
  const pr = [['Критический', '#C6362C', 1], ['Высокий', '#E86A2E', 2], ['Средний', '#E3B23C', 3], ['Низкий', '#7C9CBF', 4]];
  const st = [['Rec', '#38A3D8', 1], ['Dev', '#7C5CFC', 2], ['Test', '#E8A13C', 3], ['UAT', '#2F9E63', 4]];
  const emp = [['Антонов Егор', 'dev', 'Senior-разработчик', '#2D7DD2'], ['Соколова Мария', 'dev', 'Middle-разработчик', '#E86A9E'], ['Ким Денис', 'dev', 'Fullstack', '#2F9E63'], ['Гусев Павел', 'dev', 'Junior-разработчик', '#E8A13C'], ['АК «Вектор»', 'agent', 'Внешний агент', '#7C5CFC'], ['Фриланс Илья', 'agent', 'Подрядчик', '#38A3D8'], ['ПАО «Системы»', 'agent', 'Заказчик', '#D1644A']];

  await db.projectStatuses.bulkAdd(ps.map(p => ({ name: p[0], color: p[1] })));
  await db.taskStatuses.bulkAdd(ts.map(p => ({ name: p[0], color: p[1], order: p[2] })));
  await db.priorities.bulkAdd(pr.map(p => ({ name: p[0], color: p[1], weight: p[2] })));
  await db.stages.bulkAdd(st.map(p => ({ name: p[0], color: p[1], order: p[2] })));
  await db.employees.bulkAdd(emp.map(p => ({ name: p[0], role: p[1], position: p[2], color: p[3], active: true })));

  if (withProjects) {
    await addDemoProjects(S);
  }
}

export async function addDemoProjects(S) {
  await refreshAll(S);
  const stId = n => S.projectStatuses.find(x => x.name === n)?.id;
  const tsId = n => S.taskStatuses.find(x => x.name === n)?.id;
  const prId = n => S.priorities.find(x => x.name === n)?.id;
  const sgId = n => S.stages.find(x => x.name === n)?.id;
  const eId = n => S.employees.find(x => x.name === n)?.id;
  const T = todayISO(), d = n => addDays(T, n);

  S.counters.p++;
  const p1 = {
    num: 'P-00' + S.counters.p,
    name: 'CRM: миграция на новый биллинг',
    desc: 'Перевод расчетов клиентов на новую модель',
    statusId: stId('В процессе'),
    priorityId: prId('Высокий'),
    stageId: sgId('Dev'),
    devId: eId('Антонов Егор'),
    agentId: eId('ПАО «Системы»'),
    start: d(-20),
    end: d(45),
    stageProgress: { [sgId('Rec')]: 100, [sgId('Dev')]: 40, [sgId('Test')]: 0, [sgId('UAT')]: 0 },
    agents: [eId('ПАО «Системы»')],
    devs: [eId('Антонов Егор'), eId('Соколова Мария')],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  p1.id = await db.projects.add(p1);

  S.counters.p++;
  const p2 = {
    num: 'P-00' + S.counters.p,
    name: 'Мобильное приложение v2.0',
    desc: 'Редизайн и офлайн-режим',
    statusId: stId('В процессе'),
    priorityId: prId('Критический'),
    stageId: sgId('Rec'),
    devId: eId('Ким Денис'),
    agentId: eId('АК «Вектор»'),
    start: d(-5),
    end: d(60),
    stageProgress: { [sgId('Rec')]: 70 },
    agents: [eId('АК «Вектор»')],
    devs: [eId('Ким Денис')],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  p2.id = await db.projects.add(p2);

  S.counters.p++;
  const p3 = {
    num: 'P-00' + S.counters.p,
    name: 'Портал самообслуживания',
    statusId: stId('Очередь'),
    priorityId: prId('Средний'),
    stageId: null,
    start: d(30),
    end: d(120),
    stageProgress: {},
    agents: [],
    devs: [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  p3.id = await db.projects.add(p3);

  const tasks = [
    [p1.id, 'Схема биллинг-аккаунта', 'Готово', 'Низкий', 'Антонов Егор', 'АК «Вектор»', d(-20), d(-12), 'EXT-101', 'https://example.com/EXT-101'],
    [p1.id, 'API тарифов', 'В работе', 'Высокий', 'Антонов Егор', null, d(-10), d(8), 'EXT-102', 'https://example.com/EXT-102'],
    [p1.id, 'Фронт: панель расчетов', 'В работе', 'Высокий', 'Соколова Мария', null, d(-6), d(14), 'EXT-103', ''],
    [p1.id, 'Интеграция 1С', 'Блокировано', 'Критический', 'Ким Денис', 'ПАО «Системы»', d(2), d(20), 'EXT-104', ''],
    [p1.id, 'Отчеты по начислениям', 'Бэклог', 'Средний', 'Гусев Павел', null, d(15), d(32), 'EXT-105', ''],
    [p2.id, 'Прототипы экранов', 'Ревью', 'Высокий', 'Ким Денис', 'АК «Вектор»', d(-4), d(4), 'MB-11', ''],
    [p2.id, 'Офлайн-хранилище', 'Бэклог', 'Критический', 'Ким Денис', null, d(6), d(26), 'MB-12', ''],
    [p2.id, 'Пуш-уведомления', 'Бэклог', 'Низкий', 'Соколова Мария', null, d(20), d(38), 'MB-13', ''],
    [p1.id, 'Нагрузочное тестирование API', 'Тестирование', 'Высокий', 'Гусев Павел', null, d(-2), d(6), 'EXT-106', '']
  ];

  for (const t of tasks) {
    S.counters.t++;
    const obj = {
      num: 'T-' + String(S.counters.t).padStart(3, '0'),
      projectId: t[0],
      name: t[1],
      statusId: tsId(t[2]),
      priorityId: prId(t[3]),
      devId: eId(t[4]),
      agentId: t[5] ? eId(t[5]) : null,
      start: t[6],
      end: t[7],
      extNum: t[8],
      extLink: t[9],
      agents: [],
      devs: [],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    obj.id = await db.tasks.add(obj);

    if (t[1] === 'API тарифов') {
      for (let i = 0; i < 3; i++) {
        S.counters.c++;
        await db.changes.add({
          num: 'C-' + String(S.counters.c).padStart(3, '0'),
          taskId: obj.id,
          name: 'Правка спецификации №' + (i + 1),
          statusId: tsId(['Готово', 'В работе', 'Бэклог'][i]),
          priorityId: prId('Средний'),
          devId: eId('Антонов Егор'),
          agentId: null,
          start: d(-3 + i * 3),
          end: d(-1 + i * 3),
          extNum: 'CHG-' + (200 + i),
          extLink: '',
          agents: [],
          devs: [],
          createdAt: nowIso(),
          updatedAt: nowIso()
        });
      }
    }
  }

  await db.stageHistory.bulkAdd([
    { projectId: p1.id, ts: addDays(T, -18) + 'T10:20:00', stageId: sgId('Rec'), from: 0, to: 60 },
    { projectId: p1.id, ts: addDays(T, -12) + 'T15:05:00', stageId: sgId('Rec'), from: 60, to: 100 },
    { projectId: p1.id, ts: addDays(T, -9) + 'T09:40:00', stageId: sgId('Dev'), from: 0, to: 25 },
    { projectId: p1.id, ts: addDays(T, -2) + 'T17:12:00', stageId: sgId('Dev'), from: 25, to: 40 }
  ]);

  await db.meta.put({ key: 'counters', value: S.counters });
}
