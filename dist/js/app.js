const benefitStatements = {
  Homeowner: 'Go from “My basement drain is backing up” to likely cause, repair options, estimated cost, and inspection booking in one guided experience.',
  Realtor: 'Go from “This deal may have a sewer issue” to risk level, clear next steps, transaction protection, and inspection scheduling in one guided experience.',
  'Property Manager': 'Go from “A tenant reported a drain backup” to likely cause, urgency level, repair options, and service dispatch in one guided experience.',
  'Restaurant Owner': 'Go from “Our kitchen drain is slowing down” to grease-line risk, cleaning options, shutdown prevention, and service booking in one guided experience.',
  Plumber: 'Go from “This sewer job is beyond a normal cleaning” to defect review, trenchless options, wholesale support, and partner dispatch in one guided experience.',
  'Home Inspector': 'Go from “The sewer scope found a concern” to defect explanation, risk summary, repair options, and client-ready next steps in one guided experience.',
  'Commercial Property Owner': 'Go from “This property has recurring backups” to risk review, repair planning, budget range, and priority scheduling in one guided experience.',
  Other: 'Describe the problem, review the risk, compare next steps, and decide whether an inspection or second opinion makes sense.'
};

const PT = {
  apiBase: window.PT_API_BASE || '',
  sessionId: localStorage.getItem('pt_session_id') || cryptoRandom(),
  uploadedFileIds: [],
  chatMessages: [],
  publicSettings: null,
  currentModule: null
};
localStorage.setItem('pt_session_id', PT.sessionId);

function cryptoRandom(){
  if(window.crypto?.getRandomValues){
    const values = new Uint32Array(2);
    window.crypto.getRandomValues(values);
    return `${values[0].toString(16)}${values[1].toString(16)}`;
  }
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

function getModuleKey(){
  const path = window.location.pathname;
  if(path.includes('/tools/')) return path.split('/').pop().replace('.html','') || 'general';
  return 'home';
}

function escapeHtml(value){
  return String(value || '').replace(/[&<>'"]/g, (char) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;'
  }[char]));
}

function riskClass(value){
  return String(value || 'medium')
    .toLowerCase()
    .replace(/moderate/g, 'medium')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'medium';
}

function normalizeUrgency(value){
  const clean = String(value || '').trim();
  if(!clean) return 'Medium';
  if(/emergency/i.test(clean)) return 'Emergency';
  if(/urgent/i.test(clean)) return 'Urgent';
  if(/high/i.test(clean)) return 'High';
  if(/medium|moderate/i.test(clean)) return 'Medium';
  if(/low/i.test(clean)) return 'Low';
  if(/scheduled/i.test(clean)) return 'Scheduled';
  return clean;
}

function extractUrgencyFromText(text){
  const value = String(text || '');
  const labelMatch = value.match(/(?:urgency|urgency level|risk level|priority)\s*(?:level|score|rating)?\s*[:\-–]\s*(Emergency|Urgent|High|Medium|Moderate|Low|Scheduled)/i);
  if(labelMatch) return normalizeUrgency(labelMatch[1]);
  const firstPart = value.slice(0, 600);
  const wordMatch = firstPart.match(/\b(Emergency|Urgent|High|Medium|Moderate|Low|Scheduled)\b/i);
  return wordMatch ? normalizeUrgency(wordMatch[1]) : 'Medium';
}

function extractCostRangeFromText(text){
  const value = String(text || '');
  const labelMatch = value.match(/(?:estimated\s+cost|estimated\s+planning\s+range|cost\s+range|rough\s+range|planning\s+range)\s*[:\-–]\s*([^\n]+)/i);
  if(labelMatch) return labelMatch[1].trim().replace(/\*+/g, '');
  const moneyMatch = value.match(/\$\s?\d[\d,]*(?:\s*(?:-|–|to)\s*\$\s?\d[\d,]*\+?)?/i);
  return moneyMatch ? moneyMatch[0].trim() : '';
}

function calculateCostEstimateDetails(){
  const length = Number(document.getElementById('length')?.value || 0);
  const depth = Number(document.getElementById('depth')?.value || 0);
  const surface = String(document.getElementById('surface')?.value || 'grass').toLowerCase();
  let baseLow = 900;
  let baseHigh = 3500;
  const factors = [];

  if(length > 0) factors.push(`Approximate pipe length: ${length} ft`);
  if(depth > 0) factors.push(`Approximate depth: ${depth} ft`);
  factors.push(`Surface type: ${surface}`);

  if(length > 40){
    baseLow += 2500;
    baseHigh += 7000;
    factors.push('Longer run over 40 ft increases labor/material planning range');
  }
  if(length > 80){
    baseLow += 3000;
    baseHigh += 9000;
    factors.push('Longer run over 80 ft adds another planning increase');
  }
  if(depth > 6){
    baseLow += 2500;
    baseHigh += 8000;
    factors.push('Depth over 6 ft can increase access, safety, and equipment needs');
  }
  if(['driveway','sidewalk','street','basement floor'].includes(surface)){
    baseLow += 1800;
    baseHigh += 6500;
    factors.push('Hard surface restoration/access can raise price');
  }

  const low = Math.max(baseLow, 900);
  const high = Math.max(baseHigh, low + 1500);
  return {
    low,
    high,
    label: `$${low.toLocaleString()} to $${high.toLocaleString()}+`,
    factors
  };
}

function stripMarkdown(value){
  return String(value || '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\*\*(.*?)\*\*:?$/, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .trim();
}

function isLikelyHeading(line){
  const clean = stripMarkdown(line).replace(/:$/, '');
  if(!clean || clean.length > 70) return false;
  if(/^[-•*]\s+/.test(line)) return false;
  return /:$/.test(line) || /^(Summary|Plain-English summary|Likely cause|Likely cause categories|Urgency level|Recommended next step|Recommended next steps|What I can see|What this may mean|Missing information|Questions to ask|Safety note|Soft CTA|Next step|Disclaimer)/i.test(clean);
}

function formatStructuredAnswer(text){
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if(!lines.length) return '';

  const sections = [];
  let current = { title: 'AI Review Summary', paragraphs: [], bullets: [] };

  function pushCurrent(){
    if(current.paragraphs.length || current.bullets.length){
      sections.push(current);
    }
  }

  lines.forEach(rawLine => {
    const line = stripMarkdown(rawLine);
    const bulletMatch = line.match(/^[-•*]\s+(.*)/);
    const labeled = line.match(/^(Urgency level|Risk level|Priority)\s*[:\-–]\s*/i);
    if(labeled){
      return;
    }
    if(isLikelyHeading(rawLine)){
      pushCurrent();
      current = { title: line.replace(/:$/, ''), paragraphs: [], bullets: [] };
      return;
    }
    if(bulletMatch){
      current.bullets.push(bulletMatch[1]);
      return;
    }
    current.paragraphs.push(line);
  });
  pushCurrent();

  if(!sections.length){
    return `<div class="result-section"><p>${escapeHtml(text)}</p></div>`;
  }

  return sections.map(section => {
    const title = section.title || 'Details';
    const paragraphs = section.paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
    const bullets = section.bullets.length ? `<ul class="result-bullets">${section.bullets.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
    return `
      <div class="result-section">
        <div class="result-section-title">${escapeHtml(title)}</div>
        ${paragraphs}
        ${bullets}
      </div>
    `;
  }).join('');
}

function textToHtml(text){
  return formatStructuredAnswer(text);
}

async function apiFetch(path, options = {}){
  const response = await fetch(`${PT.apiBase}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    }
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if(!response.ok){
    const message = typeof data === 'object' ? (data.error || 'Request failed') : data;
    throw new Error(message);
  }
  return data;
}

function trackEvent(event, data = {}){
  apiFetch('/api/events', {
    method:'POST',
    body: JSON.stringify({
      event,
      module: getModuleKey(),
      userType: localStorage.getItem('pt_user_type') || 'Homeowner',
      page: window.location.pathname,
      sessionId: PT.sessionId,
      data
    })
  }).catch(() => {});
}

function selectUserType(type){
  document.querySelectorAll('.choice').forEach(btn => btn.classList.remove('active'));
  const active = Array.from(document.querySelectorAll('.choice')).find(btn => btn.textContent.trim() === type);
  if(active) active.classList.add('active');
  const output = document.getElementById('benefit-output');
  const userBubble = document.getElementById('selected-user-bubble');
  if(output) output.textContent = benefitStatements[type] || benefitStatements.Other;
  if(userBubble){userBubble.textContent = type; userBubble.style.display='block';}
  localStorage.setItem('pt_user_type', type);
  trackEvent('user_type_selected', { type });
}


async function loadPublicModuleSettings(){
  const moduleKey = getModuleKey();
  if(moduleKey === 'home'){
    try{
      const result = await apiFetch('/api/modules');
      PT.publicSettings = result.settings || null;
      return result;
    }catch{return null;}
  }
  try{
    const result = await apiFetch(`/api/modules/${moduleKey}`);
    PT.publicSettings = result.settings || null;
    PT.currentModule = result.module || null;
    return result;
  }catch(error){
    console.warn('Could not load module settings:', error);
    return null;
  }
}

function applyModuleAvailability(){
  const moduleKey = getModuleKey();
  const settings = PT.publicSettings || {};
  const module = PT.currentModule || {};
  const moduleDisabled = moduleKey !== 'home' && module.enabled === false;
  const aiDisabled = settings.aiEnabled === false;
  const uploadsDisabled = settings.uploadsEnabled === false;
  const leadsDisabled = settings.leadsEnabled === false;

  if(settings.showChatWidget === false){
    const widget = document.getElementById('pt-chat-widget');
    if(widget) widget.remove();
  }

  document.querySelectorAll('input[type="file"]').forEach(input => {
    input.disabled = uploadsDisabled || moduleDisabled;
    if(uploadsDisabled) input.closest('label')?.classList.add('is-disabled');
  });

  document.querySelectorAll('.lead-box input, .lead-box select, .lead-box textarea, .lead-box button').forEach(el => {
    if(leadsDisabled || moduleDisabled) el.disabled = true;
  });

  document.querySelectorAll('.module-layout .panel:not(.lead-box) .form-section button.btn').forEach(button => {
    if(aiDisabled || moduleDisabled) button.disabled = true;
  });

  if(moduleDisabled || aiDisabled || uploadsDisabled || leadsDisabled){
    const target = document.querySelector('.module-layout') || document.querySelector('main') || document.body;
    if(document.getElementById('module-disabled-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'module-disabled-banner';
    banner.className = 'module-disabled-banner';
    const messages = [];
    if(moduleDisabled) messages.push('This module is currently disabled by the admin dashboard.');
    if(aiDisabled) messages.push('AI responses are currently disabled.');
    if(uploadsDisabled) messages.push('File uploads are currently disabled.');
    if(leadsDisabled) messages.push('Lead capture is currently disabled.');
    banner.innerHTML = `<strong>Admin setting notice</strong><p>${escapeHtml(messages.join(' '))}</p>`;
    target.insertAdjacentElement('beforebegin', banner);
  }
}

function initUserType(){
  const saved = localStorage.getItem('pt_user_type') || 'Homeowner';
  selectUserType(saved);
}

function checkedValues(name){
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(i => i.value);
}

function showResult(risk, title, summary, nextSteps, links){
  const box = document.getElementById('result-box');
  if(!box) return;
  const urgency = normalizeUrgency(risk);
  const cls = riskClass(urgency);
  box.className = `result-box show result-${cls}`;
  box.innerHTML = `
    <div class="result-header-card">
      <div class="urgency-label">Urgency level</div>
      <div class="urgency-row">
        <span class="badge urgency-badge ${cls}">${escapeHtml(urgency)}</span>
        <strong>${escapeHtml(title)}</strong>
      </div>
      <p>${escapeHtml(summary)}</p>
    </div>

    <div class="result-section">
      <div class="result-section-title">Recommended next steps</div>
      <ol class="result-steps">${nextSteps.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol>
    </div>

    <div class="result-section">
      <div class="result-section-title">Helpful links</div>
      <div class="link-list">${links.map(l=>`<a href="${escapeHtml(l.href)}">${escapeHtml(l.text)}</a>`).join('')}</div>
    </div>

    <p class="disclaimer"><strong>Important:</strong> This AI tool provides educational guidance only. Final diagnosis, repair method, pricing, code compliance, permits, and safety decisions require professional inspection and verification.</p>
  `;
  trackEvent('tool_result_generated', { risk: urgency, title });
  box.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function runSymptomChecker(){
  const fixtures = checkedValues('fixture');
  const signals = checkedValues('signal');
  const repeat = document.getElementById('repeat')?.value || '';
  let score = 0;
  if(fixtures.includes('Multiple fixtures')) score += 3;
  if(fixtures.includes('Outside cleanout')) score += 2;
  if(signals.includes('Sewage smell')) score += 2;
  if(signals.includes('Water comes up from another fixture')) score += 3;
  if(signals.includes('Recent heavy rain')) score += 1;
  if(signals.includes('Large trees nearby')) score += 1;
  if(signals.includes('Prior repeated cleanings')) score += 2;
  if(repeat === 'Every time water is used') score += 3;
  if(repeat === 'Keeps coming back') score += 2;
  let risk='Low', title='Lower risk drain issue', summary='The symptoms may point to a localized clog or early-stage restriction, but the cause still needs to be verified before money is spent on repair work.';
  let steps=['Avoid approving major repair work without camera verification.','Document when the backup happens and which fixtures are affected.','Consider cleaning or camera inspection if the issue returns.'];
  if(score >= 8){risk='Emergency'; title='Possible main sewer backup or serious restriction'; summary='Multiple fixtures, repeated backups, cross-flow, sewage odor, or outside cleanout activity can point to a main sewer issue that should be checked urgently.'; steps=['Stop using water where possible if sewage is active.','Request sewer camera inspection with locate once the line can be safely accessed.','Ask for Good / Better / Best repair options before approving replacement.'];}
  else if(score >= 5){risk='High'; title='High risk recurring sewer restriction'; summary='Your answers suggest this may be more than a one-time clog. Root intrusion, an offset joint, belly, heavy scale, or partial collapse may need to be ruled out.'; steps=['Schedule a sewer camera inspection with locate.','Ask whether hydro jetting, cleaning, pipe bursting, lining, spot repair, or replacement fits the actual defect.','Get a second opinion before approving a full replacement.'];}
  else if(score >= 3){risk='Medium'; title='Moderate sewer or drain risk'; summary='There are enough warning signs to avoid guessing. Cleaning may help, but a camera inspection may be smarter if the issue is recurring.'; steps=['Track symptoms and recent rain or water usage patterns.','Ask whether a camera inspection is appropriate before repeated drain cleaning.','Review trenchless options if a structural defect is found.'];}
  showResult(risk,title,summary,steps,[
    {text:'Learn more about sewer camera inspections in Southeastern Pennsylvania.',href:'https://protrenchless.com/sewer-camera-inspection/'},
    {text:'Compare trenchless sewer repair and excavation.',href:'https://protrenchless.com/trenchless-sewer-repair/'},
    {text:'Schedule a Pro Trenchless sewer inspection.',href:'#lead-form'}
  ]);
}

function runEmergencyCheck(){
  const signals = checkedValues('emergency');
  let score = 0;
  const critical = ['Sewage actively entering home or business','Multiple fixtures backing up','Water near electrical systems','Restaurant kitchen shutdown risk'];
  signals.forEach(s => score += critical.includes(s) ? 3 : 1);
  if(signals.includes('Real estate closing deadline')) score += 1;
  let risk='Scheduled', title='Likely scheduled service', summary='No emergency signals were selected. A planned inspection or second opinion may still help avoid guesswork.';
  let steps=['Take photos or video of the issue.','Do not approve a major repair without clear camera findings.','Schedule service during normal hours if the issue is stable.'];
  if(score >= 6){risk='Emergency'; title='Emergency sewer or drain risk'; summary='Active sewage, multiple backed-up fixtures, electrical proximity, or business shutdown risk should be treated as urgent.'; steps=['Stop using water where possible.','Keep people away from contaminated water.','Call or request emergency service now.'];}
  else if(score >=3){risk='Urgent'; title='Urgent sewer attention recommended'; summary='The issue may not be a full emergency yet, but it should not wait if symptoms are recurring or spreading.'; steps=['Limit water use until the line is checked.','Request camera inspection with locate.','Ask for written findings and repair options.'];}
  showResult(risk,title,summary,steps,[
    {text:'Call Pro Trenchless Services now at (484) 206-5551.',href:'tel:4842065551'},
    {text:'Review sewer backup service options.',href:'https://protrenchless.com/sewer-backup/'},
    {text:'Book an inspection or send details.',href:'#lead-form'}
  ]);
}

function runEstimateReview(){
  const items = checkedValues('estimate');
  const missing = ['Pipe footage','Pipe material','Depth','Surface restoration','Permits','Utility marking','Camera verification','Warranty','Cleanout details','Good / Better / Best options'].filter(x => !items.includes(x));
  const risk = missing.length >= 6 ? 'High' : missing.length >= 3 ? 'Medium' : 'Low';
  const title = missing.length ? 'Estimate may need clarification' : 'Estimate looks more complete than average';
  const summary = missing.length ? `Before approving the work, clarify these missing items: ${missing.join(', ')}.` : 'The estimate includes several important scope details. Still, final pricing and method should match verified camera findings.';
  showResult(risk,title,summary,[
    'Ask the contractor to explain the defect, footage, material, depth, access, restoration, and warranty in writing.',
    'Ask whether cleaning, hydro jetting, lining, pipe bursting, spot repair, or replacement was considered.',
    'Get a second opinion before approving a large replacement if the estimate feels vague.'
  ],[
    {text:'Review sewer repair options before approving an estimate.',href:'https://protrenchless.com/sewer-repair/'},
    {text:'Learn how pipe bursting compares with digging.',href:'https://protrenchless.com/pipe-bursting/'},
    {text:'Upload your estimate for a Pro Trenchless second opinion.',href:'#lead-form'}
  ]);
}

function runCostEstimator(){
  const length = Number(document.getElementById('length')?.value || 0);
  const depth = Number(document.getElementById('depth')?.value || 0);
  const surface = document.getElementById('surface')?.value || 'grass';
  let baseLow = 900, baseHigh = 3500;
  if(length > 40){baseLow += 2500; baseHigh += 7000;}
  if(length > 80){baseLow += 3000; baseHigh += 9000;}
  if(depth > 6){baseLow += 2500; baseHigh += 8000;}
  if(['driveway','sidewalk','street','basement floor'].includes(surface)){baseLow += 1800; baseHigh += 6500;}
  const highRange = `$${baseLow.toLocaleString()} to $${baseHigh.toLocaleString()}+`;
  showResult('Medium','Rough planning range only',`Based on the basic details provided, a planning range could be around ${highRange}. This is not a quote. Sewer repair pricing can change heavily after camera inspection, locate, depth confirmation, permits, and restoration review.`,[
    'Book a camera inspection and locate before final repair planning.',
    'Ask what raises the price: depth, hard surfaces, access limits, permits, restoration, or emergency timing.',
    'Compare least-destructive options before excavation is approved.'
  ],[
    {text:'Learn more about trenchless sewer repair options.',href:'https://protrenchless.com/trenchless-sewer-repair/'},
    {text:'Review sewer replacement planning details.',href:'https://protrenchless.com/sewer-replacement/'},
    {text:'Schedule a Pro Trenchless sewer inspection.',href:'#lead-form'}
  ]);
}

function getLeadValue(box, labelText){
  const fields = Array.from(box.querySelectorAll('.field'));
  const field = fields.find(item => item.querySelector('label')?.textContent.toLowerCase().includes(labelText.toLowerCase()));
  const input = field?.querySelector('input, textarea, select');
  return input?.value?.trim() || '';
}


function waitForEvent(target, eventName){
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener('error', onError);
    };
    const onEvent = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error(`Could not load media for ${eventName}.`)); };
    target.addEventListener(eventName, onEvent, { once:true });
    target.addEventListener('error', onError, { once:true });
  });
}

function canvasToBlob(canvas, type='image/jpeg', quality=0.82){
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function extractVideoFrames(file, frameCount=6){
  if(!file.type.startsWith('video/')) return [];
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try{
    await waitForEvent(video, 'loadedmetadata');
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const count = Math.min(frameCount, Math.max(1, Math.floor(duration)) || frameCount);
    const frames = [];
    const maxWidth = 1280;
    const ratio = video.videoWidth && video.videoHeight ? video.videoHeight / video.videoWidth : 9 / 16;
    const width = Math.min(maxWidth, video.videoWidth || maxWidth);
    const height = Math.round(width * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'video';

    for(let i = 0; i < count; i += 1){
      const time = duration * ((i + 1) / (count + 1));
      video.currentTime = Math.min(duration - 0.05, Math.max(0, time));
      await waitForEvent(video, 'seeked');
      ctx.drawImage(video, 0, 0, width, height);
      const blob = await canvasToBlob(canvas);
      if(blob){
        frames.push(new File([blob], `${baseName}-frame-${i + 1}.jpg`, { type:'image/jpeg' }));
      }
    }
    return frames;
  }catch(error){
    console.warn('Video frame extraction failed:', error);
    return [];
  }finally{
    URL.revokeObjectURL(url);
  }
}

async function prepareFilesForUpload(fileList){
  const files = Array.from(fileList || []);
  const prepared = [];
  for(const file of files){
    prepared.push(file);
    if(file.type.startsWith('video/')){
      const frames = await extractVideoFrames(file, 6);
      prepared.push(...frames);
    }
  }
  return prepared;
}

function collectFormContextFromBox(box){
  if(!box) return '';
  const values = [];
  box.querySelectorAll('input, select, textarea').forEach(input => {
    if(input.type === 'button') return;
    const label = input.closest('label')?.textContent || input.closest('.field')?.querySelector('label')?.textContent || input.name || input.id || 'Field';
    const cleanLabel = label.replace(/\s+/g,' ').trim();
    if(input.type === 'file'){
      const names = Array.from(input.files || []).map(file => `${file.name} (${file.type || 'unknown type'})`);
      if(names.length) values.push(`${cleanLabel}: ${names.join(', ')}`);
      return;
    }
    if((input.type === 'checkbox' || input.type === 'radio') && !input.checked) return;
    if(input.value) values.push(`${cleanLabel}: ${input.value}`);
  });
  return values.join('\n');
}

function renderAiResult(answer, links=[], meta={}, structuredAnswer=null){
  const box = document.getElementById('result-box');
  if(!box) return;
  const structured = structuredAnswer || (answer && typeof answer === 'object' ? answer : null);
  const urgency = structured?.urgencyLevel || extractUrgencyFromText(answer);
  const cls = riskClass(urgency);
  const costEstimate = structured?.estimatedCost || meta.costEstimate || (getModuleKey() === 'cost-estimator' ? extractCostRangeFromText(answer) : '');

  const renderList = (items) => {
    if(!Array.isArray(items) || items.length === 0) return '';
    return `<ul class="result-bullets">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  };

  const costCard = costEstimate ? `
    <div class="cost-estimate-card">
      <div class="cost-estimate-label">Estimated cost</div>
      <div class="cost-estimate-value">${escapeHtml(costEstimate)}</div>
      <p>Planning range only. Final pricing requires camera inspection, locate, access review, permits, and professional verification.</p>
    </div>
  ` : '';

  const aiReviewSummary = structured?.aiReviewSummary ? `
    <div class="result-card">
      <div class="result-card-title">AI Review Summary</div>
      <div class="result-card-copy">${escapeHtml(structured.aiReviewSummary)}</div>
    </div>
  ` : '';

  const summarySection = structured?.summary ? `
    <div class="result-card">
      <div class="result-card-title">Summary</div>
      <div class="result-card-copy">${escapeHtml(structured.summary)}</div>
    </div>
  ` : '';

  const likelyCauses = structured?.likelyCauseCategories ? `
    <div class="result-card">
      <div class="result-card-title">Likely cause categories</div>
      ${renderList(structured.likelyCauseCategories)}
    </div>
  ` : '';

  const recommendedSteps = structured?.recommendedNextSteps ? `
    <div class="result-card">
      <div class="result-card-title">Recommended next steps</div>
      ${renderList(structured.recommendedNextSteps)}
    </div>
  ` : '';

  const questionsSection = structured?.questionsToAskOrInformationToGather ? `
    <div class="result-card">
      <div class="result-card-title">Questions to ask or information to gather</div>
      ${renderList(structured.questionsToAskOrInformationToGather)}
    </div>
  ` : '';

  const softCtaSection = structured?.softCTA ? `
    <div class="result-card">
      <div class="result-card-title">Soft CTA</div>
      <div class="result-card-copy">${escapeHtml(structured.softCTA)}</div>
    </div>
  ` : '';

  const disclaimerText = structured?.disclaimer || 'This AI tool provides educational guidance only. Final diagnosis, repair method, pricing, code compliance, permits, and safety decisions require professional inspection and verification.';

  box.className = `result-box show result-${cls}`;
  box.innerHTML = `
    <div class="result-header-card">
      <div class="urgency-label">Urgency level</div>
      <div class="urgency-row">
        <span class="badge urgency-badge ${cls}">${escapeHtml(urgency)}</span>
        <strong>Guided AI recommendation</strong>
      </div>
    </div>
    ${costCard}
    ${aiReviewSummary}
    ${summarySection}
    ${likelyCauses}
    ${recommendedSteps}
    ${questionsSection}
    ${softCtaSection}
    <div class="result-card">
      <div class="result-card-title">Disclaimer</div>
      <div class="result-card-copy">${escapeHtml(disclaimerText)}</div>
    </div>
  `;

  if(links.length){
    const wrap = document.createElement('div');
    wrap.className = 'result-section result-links';
    wrap.innerHTML = `<div class="result-section-title">Helpful links</div>${links.map(link => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.text)}</a>`).join('')}`;
    box.appendChild(wrap);
  }
  box.scrollIntoView({ behavior:'smooth', block:'start' });
}

async function submitToolAi(button){
  const box = button.closest('.panel');
  const status = box.querySelector('.tool-status') || document.createElement('div');
  status.className = 'tool-status lead-status';
  if(!status.parentElement) button.insertAdjacentElement('afterend', status);

  try{
    button.disabled = true;
    const originalText = button.dataset.originalText || button.textContent;
    button.dataset.originalText = originalText;
    button.textContent = 'Reviewing...';
    status.className = 'tool-status lead-status is-loading';
    const hasFiles = panelHasSelectedFiles(box);
    status.textContent = hasFiles
      ? 'Uploading files, extracting video frames when possible, and asking the AI...'
      : 'Asking the AI based on the options/details selected in this module...';

    const newFileIds = await uploadLeadFiles(box);
    const context = collectFormContextFromBox(box) || collectVisibleFormContext();
    const moduleKey = getModuleKey();
    const costEstimate = moduleKey === 'cost-estimator' ? calculateCostEstimateDetails() : null;
    const costInstruction = costEstimate
      ? `

Cost estimator requirement:
- Use this calculated planning range in your answer: ${costEstimate.label}.
- Include this exact line near the top: Estimated cost: ${costEstimate.label}
- Explain that it is a rough planning range only, not a quote.
- Cost factors from the form: ${costEstimate.factors.join('; ') || 'basic planning inputs only'}.`
      : '';
    const uploadInstruction = hasFiles
      ? 'Examine the uploaded images/video frames/documents plus the intake information.'
      : 'No upload was selected. Use only the options/details picked in this module intake.';

    const result = await apiFetch('/api/chat', {
      method:'POST',
      body: JSON.stringify({
        module: moduleKey,
        userType: localStorage.getItem('pt_user_type') || 'Homeowner',
        messages: [{
          role:'user',
          content:`${uploadInstruction} Give a specific sewer/drain decision-center answer for this module, not a generic template.${costInstruction}

Intake information:
${context || 'No form details provided.'}`
        }],
        formContext: {
          page: window.location.pathname,
          toolForm: context,
          uploadedFileSelected: hasFiles,
          costEstimate: costEstimate ? { label: costEstimate.label, low: costEstimate.low, high: costEstimate.high, factors: costEstimate.factors } : null
        },
        uploadedFileIds: Array.from(new Set([...PT.uploadedFileIds, ...newFileIds])),
        sessionId: PT.sessionId
      })
    });
    PT.sessionId = result.sessionId || PT.sessionId;
    renderAiResult(result.answer, result.links || [], { costEstimate: costEstimate?.label }, result.structuredAnswer);
    status.className = 'tool-status lead-status is-success';
    status.textContent = `AI review complete. Mode: ${result.mode || 'openai'}`;
    trackEvent('tool_ai_reviewed', { mode: result.mode, model: result.model, module: getModuleKey() });
  }catch(error){
    status.className = 'tool-status lead-status is-error';
    status.textContent = error.message || 'Could not review this with AI right now.';
  }finally{
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Generate guided recommendation';
  }
}

function panelHasSelectedFiles(panel){
  return Array.from(panel?.querySelectorAll('input[type="file"]') || [])
    .some(input => input.files && input.files.length > 0);
}

function runStoredButtonAction(button){
  const originalOnclick = button.dataset.originalOnclick || '';
  if(!originalOnclick) return false;

  try{
    // The original pages already have the correct non-upload behavior, such as
    // symptom scoring, emergency scoring, estimate clarity, cost planning, or
    // the module-specific selected-option result. When no image/video/file is
    // selected, keep using that picked-option logic instead of forcing AI.
    Function(originalOnclick).call(button);
    return true;
  }catch(error){
    console.error('Original tool action failed:', error);
    const status = button.parentElement?.querySelector('.tool-status') || document.createElement('div');
    status.className = 'tool-status lead-status is-error';
    status.textContent = 'Could not run the selected-option result. Please check the tool setup.';
    if(!status.parentElement) button.insertAdjacentElement('afterend', status);
    return false;
  }
}

function initAiToolButtons(){
  document.querySelectorAll('.module-layout .panel:not(.lead-box) .form-section button.btn').forEach(button => {
    const originalOnclick = button.getAttribute('onclick') || '';
    button.dataset.originalOnclick = originalOnclick;
    button.removeAttribute('onclick');

    button.addEventListener('click', () => {
      submitToolAi(button);
      trackEvent('tool_ai_requested', { module: getModuleKey(), hasFiles: panelHasSelectedFiles(button.closest('.panel')) });
    });
  });
}

async function uploadLeadFiles(box){
  const fileInput = box.querySelector('input[type="file"]');
  if(!fileInput || !fileInput.files.length) return [];
  const formData = new FormData();
  const preparedFiles = await prepareFilesForUpload(fileInput.files);
  preparedFiles.forEach(file => formData.append('files', file));
  formData.append('module', getModuleKey());
  formData.append('userType', localStorage.getItem('pt_user_type') || 'Homeowner');
  formData.append('sourcePage', window.location.pathname);
  const result = await apiFetch('/api/uploads', { method:'POST', body: formData });
  const ids = (result.files || []).map(file => file.id);
  PT.uploadedFileIds = Array.from(new Set([...PT.uploadedFileIds, ...ids]));
  return ids;
}

async function submitLeadForm(box){
  const button = box.querySelector('button.btn');
  const status = box.querySelector('.lead-status') || document.createElement('div');
  status.className = 'lead-status';
  if(!status.parentElement) button?.insertAdjacentElement('afterend', status);

  try{
    if(button){ button.disabled = true; button.textContent = 'Sending...'; }
    status.textContent = 'Uploading files and sending request...';
    status.className = 'lead-status is-loading';

    const newFileIds = await uploadLeadFiles(box);
    const consent = Boolean(box.querySelector('input[type="checkbox"]')?.checked);
    const payload = {
      name: getLeadValue(box, 'name'),
      phone: getLeadValue(box, 'phone'),
      email: getLeadValue(box, 'email'),
      propertyAddress: getLeadValue(box, 'property address'),
      preferredAppointmentTime: getLeadValue(box, 'preferred appointment'),
      userType: localStorage.getItem('pt_user_type') || 'Homeowner',
      module: getModuleKey(),
      urgency: document.querySelector('#result-box .badge')?.textContent || '',
      message: collectVisibleFormContext(),
      resultSummary: document.getElementById('result-box')?.innerText || '',
      consent,
      uploadedFileIds: Array.from(new Set([...PT.uploadedFileIds, ...newFileIds])),
      sourcePage: window.location.pathname
    };

    const response = await apiFetch('/api/leads', { method:'POST', body: JSON.stringify(payload) });
    status.className = 'lead-status is-success';
    status.textContent = `Request received. Lead ID: ${response.leadId}`;
    trackEvent('lead_submitted', { leadId: response.leadId, module: getModuleKey() });
  }catch(error){
    status.className = 'lead-status is-error';
    status.textContent = error.message || 'Could not send request. Please call Pro Trenchless.';
  }finally{
    if(button){ button.disabled = false; button.textContent = 'Request Review'; }
  }
}

function collectVisibleFormContext(){
  const panel = document.querySelector('.module-layout .panel');
  if(!panel) return '';
  const values = [];
  panel.querySelectorAll('input, select, textarea').forEach(input => {
    if(input.type === 'file' || input.type === 'button') return;
    if((input.type === 'checkbox' || input.type === 'radio') && !input.checked) return;
    const label = input.closest('label')?.textContent || input.closest('.field')?.querySelector('label')?.textContent || input.name || input.id || 'Field';
    values.push(`${label.replace(/\s+/g,' ').trim()}: ${input.value || 'selected'}`);
  });
  return values.join('\n');
}

function initLeadForms(){
  document.querySelectorAll('.lead-box').forEach(box => {
    const button = box.querySelector('button.btn');
    if(button){
      button.addEventListener('click', () => submitLeadForm(box));
    }
  });
}

function initChatWidget(){
  if(PT.publicSettings?.showChatWidget === false) return;
  if(PT.publicSettings?.aiEnabled === false) return;
  if(document.getElementById('pt-chat-widget')) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'pt-chat-widget';
  wrapper.innerHTML = `
    <button class="chat-toggle" type="button" aria-label="Open sewer AI chat">Ask AI</button>
    <div class="chat-panel" aria-live="polite">
      <div class="chat-head">
        <div><strong>Instant Sewer AI</strong><br><span>Educational guidance only</span></div>
        <button type="button" class="chat-close" aria-label="Close chat">×</button>
      </div>
      <div class="chat-body">
        <div class="chat-msg assistant">Tell me what is happening with the sewer or drain. I can help you understand likely risk, missing info, and next steps before repair approval.</div>
      </div>
      <form class="chat-form">
        <textarea rows="2" placeholder="Example: basement drain backs up when washer runs"></textarea>
        <button type="submit">Send</button>
      </form>
    </div>
  `;
  document.body.appendChild(wrapper);

  const toggle = wrapper.querySelector('.chat-toggle');
  const close = wrapper.querySelector('.chat-close');
  const panel = wrapper.querySelector('.chat-panel');
  const form = wrapper.querySelector('.chat-form');
  const textarea = wrapper.querySelector('textarea');
  const body = wrapper.querySelector('.chat-body');

  toggle.addEventListener('click', () => {
    panel.classList.toggle('open');
    trackEvent('chat_opened');
    if(panel.classList.contains('open')) textarea.focus();
  });
  close.addEventListener('click', () => panel.classList.remove('open'));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = textarea.value.trim();
    if(!text) return;
    textarea.value = '';
    addChatMessage(body, 'user', text);
    PT.chatMessages.push({ role:'user', content:text });
    const loading = addChatMessage(body, 'assistant', 'Reviewing this...');
    try{
      const result = await apiFetch('/api/chat', {
        method:'POST',
        body: JSON.stringify({
          module: getModuleKey(),
          userType: localStorage.getItem('pt_user_type') || 'Homeowner',
          messages: PT.chatMessages.slice(-12),
          formContext: { page: window.location.pathname, toolForm: collectVisibleFormContext() },
          uploadedFileIds: PT.uploadedFileIds,
          sessionId: PT.sessionId
        })
      });
      loading.innerHTML = textToHtml(result.answer);
      if(result.links?.length){
        const linkWrap = document.createElement('div');
        linkWrap.className = 'chat-links';
        linkWrap.innerHTML = result.links.map(link => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.text)}</a>`).join('');
        loading.appendChild(linkWrap);
      }
      PT.chatMessages.push({ role:'assistant', content: result.answer });
      trackEvent('chat_answered', { mode: result.mode, model: result.model });
    }catch(error){
      loading.textContent = error.message || 'The AI backend could not respond right now. Please try again or call Pro Trenchless.';
    }
  });
}

function addChatMessage(container, role, content){
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.textContent = content;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

document.addEventListener('DOMContentLoaded', async () => {
  initUserType();
  await loadPublicModuleSettings();
  initAiToolButtons();
  initLeadForms();
  initChatWidget();
  applyModuleAvailability();
  trackEvent('page_view');
});
