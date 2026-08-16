const sb = window.supabase.createClient(window.PG_CONFIG.SUPABASE_URL, window.PG_CONFIG.SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => Number(n) === 0 ? 'Free' : `₦${Number(n).toLocaleString('en-NG')}`;
const formatDate = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'});
const configReady = () => window.PG_CONFIG && !String(window.PG_CONFIG.SUPABASE_URL).includes("PASTE_") && !String(window.PG_CONFIG.SUPABASE_ANON_KEY).includes("PASTE_");
function configError(){return 'Supabase is not connected yet. Open config.js and paste your Supabase Project URL and ANON/PUBLISHABLE key.';}
async function requireAdmin(){
  const {data:{session}} = await sb.auth.getSession();
  if(!session){showLogin();throw new Error('Please sign in to the admin dashboard.');}
  const {data,isAdminError}=await sb.rpc('is_current_user_admin');
  if(isAdminError || !data) { await sb.auth.signOut(); showLogin(); throw new Error('This account is not authorised as an admin.');}
  return session;
}
async function setupMenu(){
  const t=$('#menuToggle'), n=$('#mainNav'); if(!t||!n)return;
  t.addEventListener('click',()=>{const open=n.classList.toggle('open');t.setAttribute('aria-expanded',open)});
  n.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>n.classList.remove('open')));
}
async function renderEvents(){
  const grid=$('#eventsGrid'); if(!grid)return;
  if(!configReady()){grid.innerHTML=`<div class="error-box">${configError()}</div>`;return;}
  const {data:events,error}=await sb.from('events').select('*').eq('status','active').order('date',{ascending:true});
  if(error){grid.innerHTML=`<div class="error-box">${esc(error.message)}</div>`;return;}
  const {data:counts}=await sb.from('event_registration_counts').select('*');
  const countMap=Object.fromEntries((counts||[]).map(x=>[x.event_id,Number(x.registered)]));
  grid.innerHTML=events?.length?events.map(e=>{
    const registered=countMap[e.id]||0, full=registered>=e.capacity;
    return `<article class="event-card"><div class="event-date">${formatDate(e.date)}</div><h3>${esc(e.name)}</h3><p><b>${esc(e.time)}</b> · ${esc(e.location)}</p><p>${esc(e.purpose)}</p><p><b>Dress:</b> ${esc(e.dress)}<br><b>Entry:</b> ${money(e.price)}<br><b>Spots:</b> ${Math.max(0,e.capacity-registered)} remaining</p>${full?'<button class="button sold" disabled>Registration Full</button>':`<a class="button" href="register.html?event=${encodeURIComponent(e.id)}">Register <span>→</span></a>`}</article>`;
  }).join(''):'<p>No upcoming events yet. Check back soon.</p>';
}
async function renderGallery(){
  const grid=$('#galleryGrid');if(!grid)return;
  if(!configReady()){grid.innerHTML=`<div class="error-box">${configError()}</div>`;return;}
  const {data:gallery,error}=await sb.from('gallery').select('*').order('memory_date',{ascending:false}).order('created_at',{ascending:false});
  if(error){grid.innerHTML=`<div class="error-box">${esc(error.message)}</div>`;return;}
  grid.innerHTML=gallery?.length?gallery.map(g=>g.type==='video'
    ?`<article class="memory-card"><video controls preload="metadata" src="${esc(g.media_url)}"></video><div><span class="memory-date">${formatDate(g.memory_date)}</span><h3>${esc(g.title)}</h3><p>${esc(g.description||'')}</p></div></article>`
    :`<article class="memory-card"><img loading="lazy" src="${esc(g.media_url)}" alt="${esc(g.title)}"><div><span class="memory-date">${formatDate(g.memory_date)}</span><h3>${esc(g.title)}</h3><p>${esc(g.description||'')}</p></div></article>`).join('')
    :'<p>No memories have been added yet.</p>';
}
async function setupRegister(){
  const form=$('#registrationForm');if(!form)return;
  if(!configReady()){form.innerHTML=`<div class="error-box">${configError()}</div>`;return;}
  const id=new URLSearchParams(location.search).get('event');
  if(!id){$('#eventName').textContent='No event selected';return;}
  const {data:e,error}=await sb.from('events').select('*').eq('id',id).eq('status','active').single();
  if(error||!e){$('#eventName').textContent='Event unavailable';form.innerHTML='<div class="error-box">This event is unavailable or has been archived.</div>';return;}
  $('#eventName').textContent=e.name;
  $('#eventMeta').innerHTML=`${formatDate(e.date)} · ${esc(e.time)} · ${esc(e.location)} · <b>${money(e.price)}</b><br>${esc(e.purpose)}<br><b>Dress code:</b> ${esc(e.dress)}`;
  const {data:count}=await sb.from('event_registration_counts').select('registered').eq('event_id',id).maybeSingle();
  if(Number(count?.registered||0)>=e.capacity){form.innerHTML='<h2>Registration is full.</h2>';return;}
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();const btn=form.querySelector('button');btn.disabled=true;$('#formMessage').textContent='Saving your registration…';
    const data=Object.fromEntries(new FormData(form));
    const {data:out,error}=await sb.rpc('register_for_event',{p_first_name:data.firstName,p_last_name:data.lastName,p_email:data.email,p_phone:data.phone,p_source:data.source,p_event_id:e.id});
    if(error){$('#formMessage').textContent=error.message;btn.disabled=false;return;}
    const ticket=out?.[0]||out;
    sessionStorage.setItem('pg_ticket_token',ticket.ticket_lookup_token);
    $('#paymentBox').classList.remove('hidden');form.classList.add('hidden');
    $('#paymentAmount').textContent=money(e.price);$('#viewTicketLink').href=`success.html?token=${encodeURIComponent(ticket.ticket_lookup_token)}`;
    $('#formMessage').textContent='';
    if(ticket.payment_status==='paid')location.href=`success.html?token=${encodeURIComponent(ticket.ticket_lookup_token)}`;
  });
}
async function fetchTicket(token){
  const {data,error}=await sb.rpc('get_ticket_by_token',{p_token:token});
  if(error)throw error;
  const t=Array.isArray(data)?data[0]:data;
  if(!t)throw new Error('Ticket not found. Check the ticket link.');
  return t;
}
async function renderBarcode(code){
  const el=$('#ticketBarcode');if(!el)return;
  if(window.JsBarcode){JsBarcode(el,code,{format:'CODE128',displayValue:true,fontSize:14,height:70,margin:8});}
}
async function setupSuccess(){
  const ticketBox=$('#ticket');if(!ticketBox)return;
  if(!configReady()){ticketBox.innerHTML=`<div class="error-box">${configError()}</div>`;return;}
  const token=new URLSearchParams(location.search).get('token')||sessionStorage.getItem('pg_ticket_token');
  if(!token){ticketBox.innerHTML='<div class="error-box">No ticket link was provided.</div>';return;}
  try{
    const t=await fetchTicket(token);
    const paid=['paid','verified'].includes(t.payment_status);
    $('#successEyebrow').textContent=paid?'TICKET READY':'REGISTRATION SAVED';
    $('#successTitle').textContent=paid?'See you there.':'Payment pending';
    $('#successText').textContent=paid?'Your ticket is permanently stored in the Preserved Generation database. Present the barcode on event day.':`Your registration is saved. Transfer ${money(t.amount)} to UBA 2245627970, Salako Oluwakemi. Your ticket becomes valid for entry after payment is verified.`;
    ticketBox.innerHTML=`<div class="ticket-top"><div><b>${esc(t.event_name)}</b><span>${formatDate(t.event_date)} · ${esc(t.event_time)}</span></div><strong>${esc(t.ticket_code)}</strong></div><p><b>Name:</b> ${esc(t.first_name)} ${esc(t.last_name)}<br><b>Email:</b> ${esc(t.email)}<br><b>Location:</b> ${esc(t.location)}<br><b>Dress:</b> ${esc(t.dress)}<br><b>Status:</b> ${esc(t.payment_status)}</p><svg id="ticketBarcode" class="barcode"></svg><p class="small">Ticket access is single-use. Keep this ticket safe. Your ticket record remains in the database.</p>`;
    renderBarcode(t.ticket_code);
    $('#printTicket').onclick=()=>window.print();
    $('#emailTicket').onclick=()=>{const subject=encodeURIComponent(`Preserved Generation Ticket — ${t.event_name}`);const body=encodeURIComponent(`Hello ${t.first_name},\n\nYour Preserved Generation ticket is ${t.ticket_code}.\nEvent: ${t.event_name}\nDate: ${formatDate(t.event_date)}\nTime: ${t.event_time}\nLocation: ${t.location}\n\nKeep your ticket link safe: ${location.href}\n\nPresent the barcode at the entrance.`);location.href=`mailto:${encodeURIComponent(t.email)}?subject=${subject}&body=${body}`;};
  }catch(err){ticketBox.innerHTML=`<div class="error-box">${esc(err.message)}</div>`;}
}
function showLogin(){ $('#loginPanel')?.classList.remove('hidden'); $('#dashboard')?.classList.add('hidden'); $('#logoutBtn')?.classList.add('hidden'); }
function showDashboard(){ $('#loginPanel')?.classList.add('hidden'); $('#dashboard')?.classList.remove('hidden'); $('#logoutBtn')?.classList.remove('hidden'); }
async function setupAdmin(){
  if(!$('#loginForm'))return;
  if(!configReady()){$('#loginMessage').textContent=configError();return;}
  const {data:{session}}=await sb.auth.getSession();
  if(session){try{await requireAdmin();showDashboard();await loadDashboard();}catch{}}
  else showLogin();
  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();$('#loginMessage').textContent='Signing in…';
    const email=$('#adminEmail').value.trim()||window.PG_CONFIG.ADMIN_EMAIL;
    const password=$('#adminPassword').value;
    const {error}=await sb.auth.signInWithPassword({email,password});
    if(error){$('#loginMessage').textContent=error.message;return;}
    try{await requireAdmin();$('#adminPassword').value='';$('#loginMessage').textContent='';showDashboard();await loadDashboard();}
    catch(err){$('#loginMessage').textContent=err.message;}
  });
  $('#logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();showLogin()});
  $('#newEventBtn').addEventListener('click',()=>openEventModal());
  $('#newMemoryBtn').addEventListener('click',()=>openMemoryModal());
  $('#refreshRegistrations').addEventListener('click',loadRegistrations);
  $('#registrationEventFilter').addEventListener('change',loadRegistrations);
  $('#manualScan').addEventListener('click',()=>scanTicket($('#scanCode').value));
  $('#startScanner').addEventListener('click',startScanner);
  $('#stopScanner').addEventListener('click',stopScanner);
  $('#closeModal').addEventListener('click',closeModal);
}
async function loadDashboard(){
  $('#apiStatus').textContent='Supabase connected';$('#apiStatus').className='status-pill good';
  await loadEventsAdmin();await loadRegistrations();await loadGalleryAdmin();
}
async function loadEventsAdmin(){
  const box=$('#eventManager');
  const {data:events,error}=await sb.from('events').select('*').order('date',{ascending:false});
  if(error){box.innerHTML=`<div class="error-box">${esc(error.message)}</div>`;return;}
  $('#registrationEventFilter').innerHTML='<option value="">All events</option>'+events.map(e=>`<option value="${esc(e.id)}">${esc(e.name)} (${esc(e.status)})</option>`).join('');
  box.innerHTML=`<div class="admin-cards">${events.map(e=>`<article class="admin-card"><div><span class="memory-date">${esc(e.status)}</span><h3>${esc(e.name)}</h3><p>${formatDate(e.date)} · ${esc(e.time)} · ${money(e.price)} · ${e.capacity} capacity</p></div><div class="card-actions"><button class="button small-btn" data-edit-event="${esc(e.id)}">Edit</button>${e.status==='active'?`<button class="button secondary small-btn" data-archive-event="${esc(e.id)}">Archive</button>`:`<button class="button secondary small-btn" data-restore-event="${esc(e.id)}">Restore</button>`}<button class="danger-btn" data-delete-event="${esc(e.id)}">Delete</button></div></article>`).join('')||'<p>No events yet. Create the first event above.</p>'}`;
  box.querySelectorAll('[data-edit-event]').forEach(b=>b.onclick=()=>editEvent(b.dataset.editEvent));
  box.querySelectorAll('[data-archive-event]').forEach(b=>b.onclick=()=>archiveEvent(b.dataset.archiveEvent));
  box.querySelectorAll('[data-restore-event]').forEach(b=>b.onclick=()=>restoreEvent(b.dataset.restoreEvent));
  box.querySelectorAll('[data-delete-event]').forEach(b=>b.onclick=()=>deleteEvent(b.dataset.deleteEvent));
}
async function loadRegistrations(){
  const box=$('#registrationManager');if(!box)return;
  const filter=$('#registrationEventFilter').value;
  let q=sb.from('registrations_admin_view').select('*').order('created_at',{ascending:false});
  if(filter)q=q.eq('event_id',filter);
  const {data:registrations,error}=await q;
  if(error){box.innerHTML=`<div class="error-box">${esc(error.message)}</div>`;return;}
  box.innerHTML=registrations?.length?`<table class="table"><thead><tr><th>Name</th><th>Event</th><th>Payment</th><th>Ticket</th><th>Access</th><th>Action</th></tr></thead><tbody>${registrations.map(r=>`<tr><td><b>${esc(r.first_name)} ${esc(r.last_name)}</b><br><span class="small">${esc(r.email)} · ${esc(r.phone)}</span></td><td>${esc(r.event_name)}</td><td><span class="status-pill ${['verified','paid'].includes(r.payment_status)?'good':'pending'}">${esc(r.payment_status)}</span></td><td>${esc(r.ticket_code)}</td><td>${esc(r.ticket_status)}${r.checked_in_at?`<br><span class="small">${new Date(r.checked_in_at).toLocaleString()}</span>`:''}</td><td>${r.payment_status==='pending'?`<button class="button small-btn" data-verify="${r.id}">Verify</button>`:''} ${r.payment_status!=='cancelled'?`<button class="danger-btn" data-cancel="${r.id}">Cancel</button>`:''}</td></tr>`).join('')}</tbody></table>`:'<p>No registrations yet.</p>';
  box.querySelectorAll('[data-verify]').forEach(b=>b.onclick=()=>verifyPayment(b.dataset.verify));
  box.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>cancelRegistration(b.dataset.cancel));
}
async function verifyPayment(id){
  const {data,error}=await sb.rpc('verify_registration_payment',{p_registration_id:id});
  if(error){alert(error.message);return;}
  alert('Payment verified. The ticket is now valid. It remains permanently stored in the database.');
  loadRegistrations();
}
async function cancelRegistration(id){
  if(!confirm('Cancel this registration?'))return;
  const {error}=await sb.from('registrations').update({payment_status:'cancelled',ticket_status:'cancelled'}).eq('id',id);
  if(error)alert(error.message);else loadRegistrations();
}
function openEventModal(event={}){
  $('#modalContent').innerHTML=`<p class="eyebrow">EVENT</p><h2>${event.id?'Edit event':'Create event'}</h2><form id="eventForm"><label>Event name<input required name="name" value="${esc(event.name)}"></label><div class="form-grid"><label>Date<input required type="date" name="date" value="${esc(event.date)}"></label><label>Time<input required name="time" value="${esc(event.time)}"></label></div><label>Location<input required name="location" value="${esc(event.location)}"></label><label>Purpose<input required name="purpose" value="${esc(event.purpose)}"></label><label>Dress code<input required name="dress" value="${esc(event.dress)}"></label><div class="form-grid"><label>Price (₦)<input required type="number" min="0" name="price" value="${Number(event.price)||0}"></label><label>Capacity<input required type="number" min="1" name="capacity" value="${Number(event.capacity)||100}"></label></div><button class="button full">Save event</button><p id="modalMessage" class="message"></p></form>`;
  $('#modal').classList.remove('hidden');
  $('#eventForm').addEventListener('submit',async e=>{
    e.preventDefault();const d=Object.fromEntries(new FormData(e.target));
    const payload={name:d.name,date:d.date,time:d.time,location:d.location,purpose:d.purpose,dress:d.dress,price:Number(d.price)||0,capacity:Number(d.capacity)||1};
    const result=event.id?await sb.from('events').update(payload).eq('id',event.id):await sb.from('events').insert(payload);
    if(result.error){$('#modalMessage').textContent=result.error.message;return;}closeModal();loadEventsAdmin();renderEvents();
  });
}
async function editEvent(id){const {data,error}=await sb.from('events').select('*').eq('id',id).single();if(error)alert(error.message);else openEventModal(data);}
async function archiveEvent(id){const {error}=await sb.from('events').update({status:'archived'}).eq('id',id);if(error)alert(error.message);else{loadEventsAdmin();renderEvents();}}
async function restoreEvent(id){const {error}=await sb.from('events').update({status:'active'}).eq('id',id);if(error)alert(error.message);else{loadEventsAdmin();renderEvents();}}
async function deleteEvent(id){if(!confirm('Delete this event? Archive is safer because registrations remain linked to it.'))return;const {error}=await sb.from('events').delete().eq('id',id);if(error)alert(error.message);else{loadEventsAdmin();renderEvents();}}
function openMemoryModal(item={}){
  $('#modalContent').innerHTML=`<p class="eyebrow">GALLERY</p><h2>${item.id?'Edit memory':'Add memory'}</h2><form id="memoryForm"><label>Type<select name="type"><option value="image" ${item.type==='image'?'selected':''}>Image</option><option value="video" ${item.type==='video'?'selected':''}>Video</option></select></label><label>Upload file<input id="memoryFile" type="file" accept="image/*,video/*"></label><label>Or media URL<input name="media_url" type="url" placeholder="https://…" value="${esc(item.media_url)}"></label><label>Title<input required name="title" value="${esc(item.title)}"></label><label>Description<textarea name="description">${esc(item.description)}</textarea></label><label>Date<input required type="date" name="memory_date" value="${esc(item.memory_date)}"></label><button class="button full">Save memory</button><p id="modalMessage" class="message"></p></form>`;
  $('#modal').classList.remove('hidden');
  $('#memoryForm').addEventListener('submit',async e=>{
    e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const file=$('#memoryFile').files[0];let mediaUrl=d.media_url||item.media_url||'';
    if(file){
      const safeName=`${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'-')}`;
      const {error:upErr}=await sb.storage.from('gallery').upload(safeName,file,{upsert:true});
      if(upErr){$('#modalMessage').textContent=upErr.message;return;}
      const {data:pub}=sb.storage.from('gallery').getPublicUrl(safeName);mediaUrl=pub.publicUrl;
    }
    if(!mediaUrl){$('#modalMessage').textContent='Please upload a file or provide a media URL.';return;}
    const payload={type:d.type,media_url:mediaUrl,title:d.title,description:d.description||'',memory_date:d.memory_date};
    const result=item.id?await sb.from('gallery').update(payload).eq('id',item.id):await sb.from('gallery').insert(payload);
    if(result.error){$('#modalMessage').textContent=result.error.message;return;}closeModal();loadGalleryAdmin();renderGallery();
  });
}
async function loadGalleryAdmin(){
  const box=$('#galleryManager');if(!box)return;
  const {data:gallery,error}=await sb.from('gallery').select('*').order('memory_date',{ascending:false});
  if(error){box.innerHTML=`<div class="error-box">${esc(error.message)}</div>`;return;}
  box.innerHTML=gallery?.length?`<div class="admin-cards">${gallery.map(g=>`<article class="admin-card"><div><span class="memory-date">${formatDate(g.memory_date)} · ${esc(g.type)}</span><h3>${esc(g.title)}</h3><p>${esc(g.description||'')}</p><a class="small" href="${esc(g.media_url)}" target="_blank" rel="noopener">Open media</a></div><div class="card-actions"><button class="button small-btn" data-edit-memory="${g.id}">Edit</button><button class="danger-btn" data-delete-memory="${g.id}">Delete</button></div></article>`).join('')}</div>`:'<p>No memories yet.</p>';
  box.querySelectorAll('[data-edit-memory]').forEach(b=>b.onclick=()=>editMemory(b.dataset.editMemory));
  box.querySelectorAll('[data-delete-memory]').forEach(b=>b.onclick=()=>deleteMemory(b.dataset.deleteMemory));
}
async function editMemory(id){const {data,error}=await sb.from('gallery').select('*').eq('id',id).single();if(error)alert(error.message);else openMemoryModal(data);}
async function deleteMemory(id){if(!confirm('Delete this memory?'))return;const {error}=await sb.from('gallery').delete().eq('id',id);if(error)alert(error.message);else{loadGalleryAdmin();renderGallery();}}
let codeReader=null;
async function startScanner(){
  const video=$('#scannerVideo');if(!video)return;
  try{
    if(!window.ZXingBrowser){$('#scanResult').innerHTML='<div class="error-box">Scanner library did not load. Use manual ticket entry.</div>';return;}
    codeReader=new ZXingBrowser.BrowserMultiFormatReader();
    const devices=await ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
    if(!devices.length)throw new Error('No camera found. Give Safari/your browser camera permission.');
    const device=devices.find(d=>/back|rear|environment/i.test(d.label))||devices[devices.length-1];
    await codeReader.decodeFromVideoDevice(device.deviceId,video,(result,error)=>{
      if(result){stopScanner();$('#scanCode').value=result.getText();scanTicket(result.getText());}
    });
    $('#scanResult').innerHTML='<div class="info-box">Camera scanner is active.</div>';
  }catch(e){$('#scanResult').innerHTML=`<div class="error-box">${esc(e.message)}<br>Use manual ticket entry if camera access is blocked.</div>`}
}
function stopScanner(){try{codeReader?.reset()}catch{}const v=$('#scannerVideo');if(v?.srcObject){v.srcObject.getTracks().forEach(t=>t.stop());v.srcObject=null}}
async function scanTicket(code){
  const clean=String(code||'').trim().toUpperCase();if(!clean){$('#scanResult').innerHTML='<div class="error-box">Enter or scan a ticket code.</div>';return;}
  const {data,error}=await sb.rpc('scan_ticket',{p_ticket_code:clean});
  if(error){$('#scanResult').innerHTML=`<div class="error-box"><b>ACCESS NOT GRANTED</b><br>${esc(error.message)}</div>`;return;}
  const t=Array.isArray(data)?data[0]:data;
  $('#scanResult').innerHTML=`<div class="success-box"><b>ACCESS GRANTED</b><br>Welcome ${esc(t.first_name)} ${esc(t.last_name)}.<br>${esc(t.event_name)}<br><b>${esc(t.ticket_code)}</b><br>Checked in successfully.</div>`;
  $('#scanCode').value='';loadRegistrations();
}
function closeModal(){$('#modal').classList.add('hidden');$('#modalContent').innerHTML=''}
setupMenu();renderEvents();renderGallery();setupRegister();setupSuccess();setupAdmin();
