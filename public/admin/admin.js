const tokenKey = 'pt_admin_token';
const token = () => localStorage.getItem(tokenKey) || '';
let currentSettings = null;
let currentUploads = [];
let googleSheetsStatus = null;
let spreadsheetNextPageToken = '';

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
    googleSheetsStatus = await adminFetch('/api/admin/google-sheets/status');
    renderGoogleSheets(googleSheetsStatus);
    setStatus('Dashboard loaded.', true);
    showGoogleOAuthNotice();
  }catch(error){
    setStatus(error.message, false);
    if(/Unauthorized/i.test(error.message)) logout();
  }
}

function renderGoogleSheets(status){
    if(!status) return;
    const statusEl=$('google-sheets-connection-status');
    $('google-sheets-redirect-uri').textContent=status.redirectUri || '';
    $('google-sheets-connect-btn').disabled=!status.oauthConfigured;
    $('google-sheets-connect-btn').textContent=status.connected?'Reconnect Google Drive':'Connect Google Drive';
    $('google-sheets-disconnect-btn').classList.toggle('hidden', !status.connected && !status.connectionError);
    $('google-sheets-disconnect-btn').textContent=status.connectionError?'Reset saved connection':'Disconnect';
    $('google-sheets-selector').classList.toggle('hidden', !status.connected);

    if(status.connectionError){
      statusEl.textContent=`${status.connectionError} Use Reset saved connection, then connect again.`;
      statusEl.className='admin-status err';
    }else if(!status.oauthConfigured){
      statusEl.textContent='Google OAuth needs server configuration before an account can be connected.';
      statusEl.className='admin-status err';
    }else if(status.connected){
      statusEl.textContent=`Connected to ${status.accountEmail || 'Google Drive'}.`;
      statusEl.className='admin-status ok';
    }else{
      statusEl.textContent='No Google account is connected.';
      statusEl.className='admin-status';
    }

    const selection=status.selection;
    $('google-sheets-selection-status').textContent=selection
      ? `Current destination: ${selection.spreadsheetName} — ${selection.sheetTitle}`
      : 'No spreadsheet destination selected yet.';
    $('google-sheets-selection-status').className=`admin-status ${selection?'ok':''}`;

    if(status.connected){
      const search=$('google-sheets-search');
      if(selection && !search.value) search.value=selection.spreadsheetName;
      findGoogleSpreadsheets(false, true).catch(error=>setGoogleSheetsMessage(error.message, false));
    }
  }

function setGoogleSheetsMessage(message, ok=true){
    const status=$('google-sheets-selection-status');
    status.textContent=message;
    status.className=`admin-status ${ok?'ok':'err'}`;
  }

function showGoogleOAuthNotice(){
    const params=new URLSearchParams(location.search);
    const result=params.get('googleSheets');
    if(!result) return;
    document.querySelector('.tab-btn[data-tab="settings"]').click();
    setGoogleSheetsMessage(
      result==='connected'?'Google Drive connected. Choose a spreadsheet and tab.':'Google Drive could not be connected. Check the OAuth setup and try again.',
      result==='connected'
    );
    params.delete('googleSheets');
    const query=params.toString();
    history.replaceState(null, '', `${location.pathname}${query?`?${query}`:''}${location.hash}`);
  }

async function findGoogleSpreadsheets(append=false, quiet=false){
    const select=$('google-sheets-spreadsheet');
    const query=$('google-sheets-search').value.trim();
    const pageToken=append?spreadsheetNextPageToken:'';
    if(!append){
      spreadsheetNextPageToken='';
      select.innerHTML='<option value="">Loading spreadsheets...</option>';
      select.disabled=true;
    }
    $('google-sheets-find-btn').disabled=true;
    $('google-sheets-more-btn').disabled=true;
    try{
      const params=new URLSearchParams();
      if(query) params.set('q', query);
      if(pageToken) params.set('pageToken', pageToken);
      const result=await adminFetch(`/api/admin/google-sheets/spreadsheets?${params}`);
      const files=result.spreadsheets||[];
      if(!append) select.innerHTML='<option value="">Select a spreadsheet</option>';
      files.forEach(file=>{
        if([...select.options].some(option=>option.value===file.id)) return;
        const option=document.createElement('option');
        option.value=file.id;
        option.textContent=file.name;
        select.append(option);
      });
      spreadsheetNextPageToken=result.nextPageToken||'';
      $('google-sheets-more-btn').classList.toggle('hidden', !spreadsheetNextPageToken);
      select.disabled=false;

      const selectedId=googleSheetsStatus?.selection?.spreadsheetId;
      if(!append && selectedId && [...select.options].some(option=>option.value===selectedId)){
        select.value=selectedId;
        await loadGoogleTabs(selectedId);
      }else if(!files.length && !append){
        select.innerHTML='<option value="">No spreadsheets found</option>';
        select.disabled=false;
      }
      if(!quiet) setGoogleSheetsMessage(files.length?'Select the destination spreadsheet and tab.':'No spreadsheets found for that search.', Boolean(files.length));
    }catch(error){
      if(!append) select.innerHTML='<option value="">Unable to load spreadsheets</option>';
      setGoogleSheetsMessage(error.message, false);
    }finally{
      $('google-sheets-find-btn').disabled=false;
      $('google-sheets-more-btn').disabled=false;
    }
  }

async function loadGoogleTabs(spreadsheetId){
    const tabSelect=$('google-sheets-tab');
    const saveButton=$('google-sheets-save-btn');
    tabSelect.disabled=true;
    saveButton.disabled=true;
    tabSelect.innerHTML='<option value="">Loading tabs...</option>';
    if(!spreadsheetId){
      tabSelect.innerHTML='<option value="">Select a spreadsheet first</option>';
      return;
    }
    try{
      const result=await adminFetch(`/api/admin/google-sheets/spreadsheets/${encodeURIComponent(spreadsheetId)}/tabs`);
      tabSelect.innerHTML='<option value="">Select a tab</option>';
      result.tabs.forEach(tab=>{
        const option=document.createElement('option');
        option.value=tab.id;
        option.textContent=tab.title;
        tabSelect.append(option);
      });
      if(googleSheetsStatus?.selection?.spreadsheetId===spreadsheetId){
        tabSelect.value=String(googleSheetsStatus.selection.sheetId);
      }
      tabSelect.disabled=false;
      saveButton.disabled=!tabSelect.value;
      if(!result.tabs.length) tabSelect.innerHTML='<option value="">No tabs found</option>';
    }catch(error){
      tabSelect.innerHTML='<option value="">Unable to load tabs</option>';
      setGoogleSheetsMessage(error.message, false);
    }
  }

async function connectGoogleDrive(){
    try{
      const result=await adminFetch('/api/admin/google-sheets/oauth-url');
      location.assign(result.url);
    }catch(error){ setGoogleSheetsMessage(error.message, false); }
  }

async function saveGoogleSheetsSelection(){
    try{
      $('google-sheets-save-btn').disabled=true;
      setGoogleSheetsMessage('Saving spreadsheet destination...');
      const result=await adminFetch('/api/admin/google-sheets/selection',{
        method:'PUT',
        body:JSON.stringify({
          spreadsheetId:$('google-sheets-spreadsheet').value,
          sheetId:Number($('google-sheets-tab').value)
        })
      });
      googleSheetsStatus.selection=result.selection;
      renderGoogleSheets(googleSheetsStatus);
      setGoogleSheetsMessage(`Saved destination: ${result.selection.spreadsheetName} — ${result.selection.sheetTitle}`, true);
    }catch(error){ setGoogleSheetsMessage(error.message, false); }
    finally{$('google-sheets-save-btn').disabled=!$('google-sheets-tab').value;}
  }

async function disconnectGoogleDrive(){
    if(!confirm('Disconnect Google Drive and clear the selected spreadsheet destination?')) return;
    try{
      await adminFetch('/api/admin/google-sheets/connection',{method:'DELETE'});
      googleSheetsStatus={...googleSheetsStatus,connected:false,accountEmail:'',selection:null,connectionError:''};
      renderGoogleSheets(googleSheetsStatus);
    }catch(error){setGoogleSheetsMessage(error.message,false);}
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
$('google-sheets-connect-btn').addEventListener('click', connectGoogleDrive);
$('google-sheets-disconnect-btn').addEventListener('click', disconnectGoogleDrive);
$('google-sheets-find-btn').addEventListener('click', () => findGoogleSpreadsheets());
$('google-sheets-more-btn').addEventListener('click', () => findGoogleSpreadsheets(true));
$('google-sheets-search').addEventListener('keydown', event => {
  if(event.key==='Enter'){event.preventDefault();findGoogleSpreadsheets();}
});
$('google-sheets-spreadsheet').addEventListener('change', event => loadGoogleTabs(event.target.value));
$('google-sheets-tab').addEventListener('change', event => {
  $('google-sheets-save-btn').disabled=!event.target.value;
});
$('google-sheets-save-btn').addEventListener('click', saveGoogleSheetsSelection);
initTabs();
verifySession();
