const tokenKey = 'pt_admin_token';
const token = () => localStorage.getItem(tokenKey) || '';
let currentSettings = null;
let currentUploads = [];

function $(id){ return document.getElementById(id); }
function esc(value){ return String(value || '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char])); }
function fmtDate(value){ if(!value) return ''; try{return new Date(value).toLocaleString();}catch{return value;} }
function fmtBytes(bytes){ const n=Number(bytes||0); if(n>1024*1024) return `${(n/1024/1024).toFixed(1)} MB`; if(n>1024) return `${(n/1024).toFixed(1)} KB`; return `${n} B`; }
function jsonSummary(value){ try { return esc(JSON.stringify(value || {}, null, 0)).slice(0, 260); } catch { return ''; } }
function setStatus(message, ok=true){ const el=$('admin-status'); if(!el) return; el.textContent=message; el.className=`admin-status ${ok?'ok':'err'}`; }
function showDashboard(show){ $('login-view').classList.toggle('hidden', show); $('dashboard-view').classList.toggle('hidden', !show); }

async function adminFetch(path, options={}){
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? {'Content-Type':'application/json'} : {}),
      Authorization: `Bearer ${token()}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if(!response.ok) throw new Error(data.error || 'Admin request failed');
  return data;
}

async function login(){
  const status=$('login-status');
  status.textContent='Checking login...';
  status.className='admin-status';
  try{
    const response = await fetch('/api/admin/login', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username:$('login-username').value.trim(), password:$('login-password').value })
    });
    const data = await response.json();
    if(!response.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem(tokenKey, data.token);
    showDashboard(true);
    await loadAdmin();
  }catch(error){
    status.textContent=error.message;
    status.className='admin-status err';
  }
}

function logout(){ localStorage.removeItem(tokenKey); showDashboard(false); }

async function verifySession(){
  if(!token()) return showDashboard(false);
  try{ await adminFetch('/api/admin/me'); showDashboard(true); await loadAdmin(); }
  catch{ logout(); }
}

async function loadAdmin(){
  try{
    setStatus('Loading dashboard...');
    const [stats, leads, uploads, activity, settings] = await Promise.all([
      adminFetch('/api/admin/stats'),
      adminFetch('/api/admin/leads?limit=200'),
      adminFetch('/api/admin/uploads?limit=200'),
      adminFetch('/api/admin/activity?limit=300'),
      adminFetch('/api/admin/settings')
    ]);
    currentUploads = uploads.uploads || [];
    currentSettings = settings.settings;
    $('metric-leads').textContent = stats.leads || 0;
    $('metric-uploads').textContent = stats.uploads || 0;
    $('metric-events').textContent = stats.events || 0;
    $('metric-chats').textContent = stats.chats || 0;
    renderActivity(activity.activity || []);
    renderOverview(activity.activity || []);
    renderLeads(leads.leads || []);
    renderUploads(currentUploads);
    renderSettings(currentSettings);
    setStatus('Dashboard loaded.', true);
  }catch(error){
    setStatus(error.message, false);
    if(/Unauthorized/i.test(error.message)) logout();
  }
}

function renderOverview(rows){
  const body=$('overview-body');
  const top=rows.slice(0,10);
  if(!top.length){ body.innerHTML='<tr><td colspan="5">No activity yet.</td></tr>'; return; }
  body.innerHTML=top.map(row=>`<tr><td>${esc(fmtDate(row.createdAt))}</td><td><span class="pill">${esc(row.type)}</span></td><td>${esc(row.title)}</td><td>${esc(row.module)}</td><td>${jsonSummary(row.details)}</td></tr>`).join('');
}

function renderActivity(rows){
  const body=$('activity-body');
  if(!rows.length){ body.innerHTML='<tr><td colspan="6">No activity yet.</td></tr>'; return; }
  body.innerHTML=rows.map(row=>`<tr><td>${esc(fmtDate(row.createdAt))}</td><td><span class="pill">${esc(row.type)}</span></td><td>${esc(row.title)}</td><td>${esc(row.userType)}</td><td>${esc(row.module)}</td><td>${jsonSummary(row.details)}</td></tr>`).join('');
}

function renderLeads(leads){
  const body=$('leads-body');
  if(!leads.length){ body.innerHTML='<tr><td colspan="8">No leads yet.</td></tr>'; return; }
  body.innerHTML=leads.map(lead=>`
    <tr>
      <td>${esc(fmtDate(lead.createdAt))}</td>
      <td>${esc(lead.name)}</td>
      <td>${esc(lead.phone)}<br>${esc(lead.email)}</td>
      <td>${esc(lead.userType)}</td>
      <td>${esc(lead.module)}</td>
      <td>${lead.urgency ? `<span class="pill">${esc(lead.urgency)}</span>` : ''}</td>
      <td>${esc((lead.message || lead.resultSummary || '').slice(0, 350))}</td>
      <td>${(lead.uploadedFileIds || []).map(id => `<a class="download-link" href="/api/admin/uploads/${esc(id)}/download?admin_token=${encodeURIComponent(token())}" target="_blank">${esc(id)}</a>`).join('<br>')}</td>
    </tr>`).join('');
}

function renderUploads(uploads){
  const body=$('uploads-body');
  if(!uploads.length){ body.innerHTML='<tr><td colspan="6">No uploads yet.</td></tr>'; return; }
  body.innerHTML=uploads.map(file=>`
    <tr>
      <td>${esc(fmtDate(file.createdAt))}</td>
      <td>${esc(file.originalName)}</td>
      <td>${esc(file.mimeType)}</td>
      <td>${esc(fmtBytes(file.sizeBytes))}</td>
      <td>${esc(file.module)}</td>
      <td><a class="download-link" href="/api/admin/uploads/${esc(file.id)}/download?admin_token=${encodeURIComponent(token())}" target="_blank">Download</a></td>
    </tr>`).join('');
}

function switchRow(key, title, desc, checked){
  return `<div class="switch-row"><div><strong>${esc(title)}</strong><span>${esc(desc)}</span></div><label class="toggle"><input type="checkbox" id="setting-${esc(key)}" ${checked?'checked':''}><span class="slider"></span></label></div>`;
}

function renderSettings(settings){
  if(!settings) return;
  $('global-settings').innerHTML = [
    switchRow('aiEnabled','AI responses','Allow all modules and chat to call the AI backend.', settings.aiEnabled),
    switchRow('uploadsEnabled','File uploads','Allow users to upload images, videos, reports, and estimates.', settings.uploadsEnabled),
    switchRow('leadsEnabled','Lead capture','Allow users to submit request-review forms.', settings.leadsEnabled),
    switchRow('eventTrackingEnabled','Activity tracking','Save page views, chat activity, and button events.', settings.eventTrackingEnabled),
    switchRow('requireLeadConsent','Require consent','Require consent checkbox before storing a lead.', settings.requireLeadConsent),
    switchRow('showChatWidget','Chat widget','Show the floating Ask AI chat widget.', settings.showChatWidget)
  ].join('');

  ['businessName','businessPhone','emergencyPhone','mainSiteUrl','aiSiteUrl','dashboardNote'].forEach(key => {
    const el = $(`setting-${key}`);
    if(el) el.value = settings[key] || '';
  });

  const modules = settings.modules || {};
  $('module-settings').innerHTML = Object.entries(modules).map(([key, module]) => `
    <div class="switch-row">
      <div><strong>${esc(module.title || key)}</strong><span>${esc(key)}</span></div>
      <label class="toggle"><input type="checkbox" class="module-toggle" data-module="${esc(key)}" ${module.enabled !== false ? 'checked' : ''}><span class="slider"></span></label>
    </div>`).join('');
}

function collectSettings(){
  const s = currentSettings || {};
  const next = {
    ...s,
    aiEnabled: $('setting-aiEnabled')?.checked ?? true,
    uploadsEnabled: $('setting-uploadsEnabled')?.checked ?? true,
    leadsEnabled: $('setting-leadsEnabled')?.checked ?? true,
    eventTrackingEnabled: $('setting-eventTrackingEnabled')?.checked ?? true,
    requireLeadConsent: $('setting-requireLeadConsent')?.checked ?? true,
    showChatWidget: $('setting-showChatWidget')?.checked ?? true,
    businessName: $('setting-businessName')?.value || '',
    businessPhone: $('setting-businessPhone')?.value || '',
    emergencyPhone: $('setting-emergencyPhone')?.value || '',
    mainSiteUrl: $('setting-mainSiteUrl')?.value || '',
    aiSiteUrl: $('setting-aiSiteUrl')?.value || '',
    dashboardNote: $('setting-dashboardNote')?.value || '',
    modules: { ...(s.modules || {}) }
  };
  document.querySelectorAll('.module-toggle').forEach(input => {
    const key = input.dataset.module;
    next.modules[key] = { ...(next.modules[key] || {}), enabled: input.checked };
  });
  return next;
}

async function saveSettings(){
  try{
    setStatus('Saving settings...');
    const result = await adminFetch('/api/admin/settings', { method:'PUT', body: JSON.stringify({ settings: collectSettings() }) });
    currentSettings = result.settings;
    renderSettings(currentSettings);
    setStatus('Settings saved. Restart is not needed.', true);
  }catch(error){ setStatus(error.message, false); }
}

function initTabs(){
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

$('login-btn').addEventListener('click', login);
$('login-password').addEventListener('keydown', e => { if(e.key === 'Enter') login(); });
$('logout-btn').addEventListener('click', logout);
$('refresh-btn').addEventListener('click', loadAdmin);
$('save-settings-btn').addEventListener('click', saveSettings);
$('reset-settings-btn').addEventListener('click', loadAdmin);
initTabs();
verifySession();
