// src/core/prefs.js
import { db } from './db.js';
import { setDbBeacon } from '../utils/logger.js';

export async function savePrefs(S) {
  try {
    await db.meta.put({ key: 'prefs', value: S.prefs });
    await db.meta.put({ key: 'counters', value: S.counters });
  } catch (e) {
    setDbBeacon('error', '🔴 Ошибка базы данных');
  }
}

export function tblState(S, tid, allKeys) {
  S.prefs.tables[tid] = S.prefs.tables[tid] || {};
  const st = S.prefs.tables[tid];
  let order = (st.order || []).filter(k => allKeys.includes(k));
  allKeys.forEach(k => {
    if (!order.includes(k)) order.push(k);
  });
  st.order = order;
  st.hidden = (st.hidden || []).filter(k => allKeys.includes(k));
  st.filters = st.filters || {};
  return st;
}

export function cardFields(S, ent) {
  const all = ['num', 'name', 'dates', 'status', 'priority', 'owner', 'project', 'stage'];
  if (!S.prefs.cards[ent]) {
    S.prefs.cards[ent] = ent === 'projects'
      ? ['num', 'name', 'dates', 'status', 'priority', 'stage']
      : ['num', 'name', 'dates', 'status', 'priority', 'owner', 'project'];
  }
  return { list: S.prefs.cards[ent], all };
}
