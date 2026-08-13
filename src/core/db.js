// src/core/db.js
import Dexie from 'dexie';

export const db = new Dexie('AppDatabase');

db.version(3).stores({
  projects: "++id,num,name,statusId,priorityId,stageId,customerId,start,end,createdAt,updatedAt",
  tasks: "++id,num,name,projectId,statusId,priorityId,agentId,devId,customerId,start,end,createdAt,updatedAt",
  changes: "++id,num,name,taskId,statusId,priorityId,agentId,devId,customerId,start,end,createdAt,updatedAt",
  employees: "++id,name,role",
  customers: "++id,name",
  priorities: "++id,name,weight",
  taskStatuses: "++id,name,order",
  projectStatuses: "++id,name",
  stages: "++id,name,order",
  stageHistory: "++id,projectId,ts",
  meta: "key"
});

export async function refreshAll(S) {
  const [
    projects, tasks, changes, employees, customers, priorities,
    taskStatuses, projectStatuses, stages, history
  ] = await Promise.all([
    db.projects.toArray(),
    db.tasks.toArray(),
    db.changes.toArray(),
    db.employees.toArray(),
    db.customers.toArray(),
    db.priorities.toArray(),
    db.taskStatuses.toArray(),
    db.projectStatuses.toArray(),
    db.stages.toArray(),
    db.stageHistory.toArray()
  ]);

  Object.assign(S, {
    projects, tasks, changes, employees, customers, priorities,
    taskStatuses, projectStatuses, stages, history
  });
}
