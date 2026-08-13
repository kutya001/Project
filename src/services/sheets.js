import { getAccessToken } from './auth.js';
import { buildSnapshot } from './storage.js';

export async function exportToGoogleSheets(S) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  // We will create a new Google Sheet with a couple of sheets (Projects, Tasks, Changes)
  // First, create the spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: `Projects App Backup - ${new Date().toISOString()}`
      },
      sheets: [
        { properties: { title: 'Projects' } },
        { properties: { title: 'Tasks' } },
        { properties: { title: 'Changes' } }
      ]
    })
  });
  
  if (!createRes.ok) throw new Error('Failed to create spreadsheet');
  const spreadsheet = await createRes.json();
  const spreadsheetId = spreadsheet.spreadsheetId;

  // Now, populate the data
  const data = buildSnapshot(S).data;
  
  // Prepare values for Projects
  const projectHeaders = ['ID', 'Num', 'Name', 'Status', 'Priority', 'Customer', 'Start', 'End', 'Created'];
  const projectRows = data.projects.map(p => [p.id, p.num, p.name, p.statusId, p.priorityId, p.customerId, p.start, p.end, p.createdAt]);
  
  // Tasks
  const taskHeaders = ['ID', 'Num', 'Name', 'Project ID', 'Status', 'Priority', 'Agent', 'Start', 'End', 'Created'];
  const taskRows = data.tasks.map(t => [t.id, t.num, t.name, t.projectId, t.statusId, t.priorityId, t.agentId, t.start, t.end, t.createdAt]);
  
  // Changes
  const changeHeaders = ['ID', 'Num', 'Name', 'Task ID', 'Status', 'Priority', 'Agent', 'Start', 'End', 'Created'];
  const changeRows = data.changes.map(c => [c.id, c.num, c.name, c.taskId, c.statusId, c.priorityId, c.agentId, c.start, c.end, c.createdAt]);
  
  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: 'Projects!A1', values: [projectHeaders, ...projectRows] },
        { range: 'Tasks!A1', values: [taskHeaders, ...taskRows] },
        { range: 'Changes!A1', values: [changeHeaders, ...changeRows] }
      ]
    })
  });

  if (!updateRes.ok) throw new Error('Failed to write data to spreadsheet');
  
  return spreadsheet.spreadsheetUrl;
}
