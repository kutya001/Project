// src/components/table/colDefs.js
export function col(k, label, type, o = {}) {
  return { k, label, type, ...o };
}

export function getColDefs(S) {
  return {
    projects: [
      col('num', '№', 'text', { w: 74 }),
      col('name', 'Название', 'text'),
      col('statusId', 'Статус', 'select', { dir: () => S.projectStatuses }),
      col('priorityId', 'Приоритет', 'select', { dir: () => S.priorities }),
      col('stageId', 'Этап', 'select', { dir: () => S.stages }),
      col('devId', 'Разработчик (гл.)', 'select', { dir: () => S.employees.filter(e => e.role === 'dev') }),
      col('agentId', 'Агент (гл.)', 'select', { dir: () => S.employees.filter(e => e.role === 'agent') }),
      col('progress', 'Этапы %', 'custom'),
      col('start', 'Начало', 'date'),
      col('end', 'Конец', 'date'),
      col('tasksCount', 'Задач', 'number'),
      col('agents', 'Агенты', 'multi', { role: 'agent' }),
      col('devs', 'Разработчики', 'multi', { role: 'dev' }),
      col('desc', 'Описание', 'text'),
      col('note', 'Примечание', 'text'),
      col('createdAt', 'Создан', 'date'),
      col('updatedAt', 'Изменен', 'date')
    ],
    tasks: [
      col('num', '№', 'text', { w: 74 }),
      col('name', 'Название', 'text'),
      col('projectId', 'Проект', 'select', { dir: () => S.projects }),
      col('statusId', 'Статус', 'select', { dir: () => S.taskStatuses }),
      col('priorityId', 'Приоритет', 'select', { dir: () => S.priorities }),
      col('devId', 'Разработчик (гл.)', 'select', { dir: () => S.employees.filter(e => e.role === 'dev') }),
      col('agentId', 'Агент (гл.)', 'select', { dir: () => S.employees.filter(e => e.role === 'agent') }),
      col('extNum', '№ в системе', 'text'),
      col('extLink', 'Ссылка', 'link'),
      col('start', 'Начало', 'date'),
      col('end', 'Конец', 'date'),
      col('changesCount', 'Изменений', 'number'),
      col('agents', 'Агенты (участ.)', 'multi', { role: 'agent' }),
      col('devs', 'Разработчики (участ.)', 'multi', { role: 'dev' }),
      col('desc', 'Описание', 'text'),
      col('note', 'Примечание', 'text'),
      col('createdAt', 'Создана', 'date'),
      col('updatedAt', 'Изменена', 'date')
    ],
    changes: [
      col('num', '№', 'text', { w: 74 }),
      col('name', 'Название', 'text'),
      col('taskId', 'Задача', 'select', { dir: () => S.tasks }),
      col('statusId', 'Статус', 'select', { dir: () => S.taskStatuses }),
      col('priorityId', 'Приоритет', 'select', { dir: () => S.priorities }),
      col('devId', 'Разработчик (гл.)', 'select', { dir: () => S.employees.filter(e => e.role === 'dev') }),
      col('agentId', 'Агент (гл.)', 'select', { dir: () => S.employees.filter(e => e.role === 'agent') }),
      col('extNum', '№ в системе', 'text'),
      col('extLink', 'Ссылка', 'link'),
      col('start', 'Начало', 'date'),
      col('end', 'Конец', 'date'),
      col('desc', 'Описание', 'text'),
      col('note', 'Примечание', 'text'),
      col('createdAt', 'Создано', 'date'),
      col('updatedAt', 'Изменено', 'date')
    ],
    employees: [
      col('color', 'Цвет', 'color', { w: 80 }),
      col('name', 'ФИО / Название', 'text'),
      col('role', 'Роль', 'role'),
      col('position', 'Должность / Компания', 'text'),
      col('active', 'Статус', 'active')
    ],
    priorities: [
      col('color', 'Цвет', 'color', { w: 80 }),
      col('name', 'Название', 'text'),
      col('weight', 'Вес (1=высший)', 'number')
    ],
    taskStatuses: [
      col('color', 'Цвет', 'color', { w: 80 }),
      col('name', 'Название', 'text'),
      col('order', 'Порядок', 'number')
    ],
    projectStatuses: [
      col('color', 'Цвет', 'color', { w: 80 }),
      col('name', 'Название', 'text'),
      col('order', 'Порядок', 'number')
    ],
    stages: [
      col('color', 'Цвет', 'color', { w: 80 }),
      col('name', 'Название', 'text'),
      col('order', 'Порядок', 'number')
    ]
  };
}

export const DEFAULT_HIDDEN = {
  projects: ['desc', 'note', 'agents', 'devs', 'createdAt'],
  tasks: ['desc', 'note', 'agents', 'devs', 'changesCount', 'createdAt', 'extLink'],
  changes: ['desc', 'note', 'extLink', 'createdAt'],
  employees: [],
  priorities: [],
  taskStatuses: [],
  projectStatuses: [],
  stages: []
};
