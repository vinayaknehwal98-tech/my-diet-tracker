const NOTIF_SUPPORTED = (typeof Notification !== 'undefined');
let notifPermission = NOTIF_SUPPORTED ? Notification.permission : 'denied';

// --- SERVICE WORKER REGISTRATION ---
let swReg = null;

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swReg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    navigator.serviceWorker.addEventListener('message', handleSWMessage);
  } catch(e) {
    console.warn('SW reg failed (app still works):', e);
    // App works fine without SW - notifications just need app open
  }
}
// Register SW but never let it block app init
try { registerSW(); } catch(e) {}

function sendToSW(msg) {
  if (navigator.serviceWorker && navigator.serviceWorker.controller)
    navigator.serviceWorker.controller.postMessage(msg);
}

function handleSWMessage(e) {
  const msg = e.data;
  if (!msg) return;
  if (msg.type === 'PLAY_ALARM') startAudioAlarm(msg.mealId);
  if (msg.type === 'STOP_ALARM_AUDIO') stopAudioAlarm(msg.mealId);
  if (msg.type === 'MEAL_DISMISSED_FROM_NOTIF') {
    stopAudioAlarm(msg.mealId);
    renderAll();
  }
}

// --- AUDIO ALARM ENGINE ---
let audioCtx = null;
let alarmNodes = {};

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playAlarmBeep(ctx) {
  const now = ctx.currentTime;
  [0, 0.4, 0.8, 1.2].forEach(offset => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now + offset);
    osc.frequency.setValueAtTime(1100, now + offset + 0.1);
    gain.gain.setValueAtTime(0.8, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.35);
    osc.start(now + offset); osc.stop(now + offset + 0.35);
  });
}

function startAudioAlarm(mealId) {
  if (alarmNodes[mealId]) return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    playAlarmBeep(ctx);
    alarmNodes[mealId] = setInterval(() => { try { playAlarmBeep(getAudioCtx()); } catch(e){} }, 2000);
    showAlarmBanner(mealId);
  } catch(e) {}
}

function stopAudioAlarm(mealId) {
  if (alarmNodes[mealId]) { clearInterval(alarmNodes[mealId]); delete alarmNodes[mealId]; }
  hideAlarmBanner();
  sendToSW({ type: 'STOP_ALARM', mealId });
}

// --- ALARM BANNER ---
function showAlarmBanner(mealId) {
  let b = document.getElementById('alarmBanner');
  if (!b) { b = document.createElement('div'); b.id = 'alarmBanner'; document.body.appendChild(b); }
  const meal = state.meals.find(m => m.id === mealId);
  const name = meal ? meal.name : 'Meal';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;font-family:var(--font);box-shadow:0 4px 20px rgba(249,115,22,0.6);';
  b.innerHTML = `
    <div>
      <div style="font-size:15px;font-weight:700;">🔔 ${name}</div>
      <div style="font-size:11px;opacity:0.85;margin-top:2px;">Tap Done to mark & stop alarm</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="snoozeAlarm('${mealId}')" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:8px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-family:var(--font);">Snooze 5m</button>
      <button onclick="doneAlarm('${mealId}')" style="background:#fff;border:none;color:#f97316;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font);">✅ Done</button>
    </div>`;
}

function hideAlarmBanner() {
  const b = document.getElementById('alarmBanner');
  if (b) b.remove();
}

function snoozeAlarm(mealId) {
  stopAudioAlarm(mealId);
  setTimeout(() => startAudioAlarm(mealId), 5 * 60 * 1000);
  showToast('⏰ Snoozed 5 min');
}

function doneAlarm(mealId) {
  stopAudioAlarm(mealId);
  state.checked[`${todayKey()}_${mealId}`] = true;
  saveState(); renderAll();
  showToast('✅ Meal marked done!');
}

// --- NOTIFICATIONS ---
async function requestNotifPermission() {
  if (!NOTIF_SUPPORTED) return false;
  if (Notification.permission === 'granted') {
    await getFCMToken();
    return true;
  }
  const result = await Notification.requestPermission();
  notifPermission = result;
  if (result === 'granted') await getFCMToken();
  return result === 'granted';
}

function sendNotif(title, body) {
  if (!NOTIF_SUPPORTED || Notification.permission !== 'granted') return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: './icon-192.png',
        badge: './icon-192.png'
      });
    }).catch(() => {
      try { new Notification(title, { body }); } catch(e) {}
    });
  } else {
    try { new Notification(title, { body }); } catch(e) {}
  }
}

// --- MEAL REMINDER SCHEDULER ---
let mealTimers = [];

function clearMealTimers() {
  mealTimers.forEach(t => clearTimeout(t));
  mealTimers = [];
}

function scheduleMealReminders() {
  clearMealTimers();

  if (!NOTIF_SUPPORTED || Notification.permission !== 'granted') return;

  _scheduleInPageTimers();
}

function _scheduleInPageTimers() {
  const now = new Date();
  const rs = getRemindersState();
  const remindBefore = rs.remindBefore || [15, 10, 5];
  const alarmAtTime = rs.alarmAtTime !== false;
  const beforeList = alarmAtTime ? [...remindBefore, 0] : remindBefore;
  beforeList.forEach(before => {
    state.meals.forEach(meal => {
      const [h, m] = meal.timeVal.split(':').map(Number);
      const mealTime = new Date(); mealTime.setHours(h, m, 0, 0);
      const diff = (mealTime - before * 60000) - now;
      if (diff <= 0) return;
      const t = setTimeout(() => {
        if (isMealDone(meal.id)) return;
        if (before === 0) startAudioAlarm(meal.id);
        else sendNotif(`⏰ ${meal.name.replace(/^[^\w\s]*\s*/,'')} in ${before} min`, `${meal.timeLabel} · ${meal.kcal} kcal`);
      }, diff);
      mealTimers.push(t);
    });
  });
}

  


// --- REMINDERS STATE ---
function getRemindersState() {
  try { const r = localStorage.getItem('bulkDiet_reminders'); if (r) return JSON.parse(r); } catch(e) {}
  return {
  mealsOn: false,
  waterOn: false,
  waterInterval: 60,
  waterGoalGlasses: 8
};
}

function saveRemindersState(rs) {
  localStorage.setItem('bulkDiet_reminders', JSON.stringify(rs));
}

function renderReminders() {
  const rs = getRemindersState();
  const permGranted = NOTIF_SUPPORTED && Notification.permission === 'granted';
  const permDenied  = NOTIF_SUPPORTED && Notification.permission === 'denied';
  const swAvail = 'serviceWorker' in navigator;

  let permBanner = '';
  if (permDenied) {
    permBanner = `<div style="background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:#f87171;line-height:1.6;">
      ⚠️ Notifications are <b>blocked</b>. Go to browser Settings → Site Settings → Notifications and allow this page.
    </div>`;
  } else if (!permGranted) {
    permBanner = `<div style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);border-radius:10px;padding:12px;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;font-family:var(--font)">🔔 Enable Notifications</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.5">Required for meal alarms and water reminders.</div>
      <button onclick="handleEnableNotif()" style="background:var(--accent);border:none;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font);">Allow Notifications</button>
    </div>`;
  }

  // SW status badge
  const swStatus = swAvail
    ? `<span style="background:rgba(74,222,128,0.15);color:var(--green);font-size:10px;padding:2px 7px;border-radius:10px;font-family:var(--font);">✓ Background enabled</span>`
    : `<span style="background:rgba(251,191,36,0.15);color:var(--yellow);font-size:10px;padding:2px 7px;border-radius:10px;font-family:var(--font);">App must stay open</span>`;

  const mealRows = state.meals.map(m => {
    const [h, min] = m.timeVal.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const label = `${h12}:${String(min).padStart(2,'0')} ${ampm}`;
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-top:1px solid var(--border);">
      <div>
        <div style="font-size:13px;font-weight:500;">${m.emoji} ${m.name.replace(/^[^\w\s]*\s*/,'')}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px;">⏰ ${label} &nbsp;·&nbsp; −15, −10, −5 min &nbsp;·&nbsp; 🔔 Alarm at time</div>
      </div>
      <div style="font-size:11px;color:${permGranted && rs.mealsOn ? 'var(--green)' : 'var(--muted)'};">${permGranted && rs.mealsOn ? '🔔' : '—'}</div>
    </div>`;
  }).join('');

  return `
    ${permBanner}

    <!-- Meal Reminders -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div>
          <div style="font-family:var(--font);font-size:14px;font-weight:600;">🍽️ Meal Alarms</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">${swStatus}</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="toggleMeals" ${rs.mealsOn ? 'checked' : ''} onchange="handleMealToggle(this.checked)" ${!permGranted ? 'disabled' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
     <div style="background:var(--card);border-radius:8px;padding:12px;margin-bottom:8px;">
  <div style="font-size:11px;color:var(--muted);margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Reminder Timing</div>
  
  <div style="margin-bottom:10px;">
    <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">Notify me before meal:</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;" id="reminderChips">
      ${[5,10,15,20,30,45,60].map(min => {
        const rs2 = getRemindersState();
        const selected = (rs2.remindBefore || [15,10,5]).includes(min);
        return `<button onclick="toggleReminderChip(${min})" id="chip_${min}" style="
          padding:5px 10px;border-radius:20px;font-size:12px;cursor:pointer;
          font-family:var(--font);border:1.5px solid ${selected ? '#6366f1' : 'var(--border)'};
          background:${selected ? 'rgba(99,102,241,0.15)' : 'transparent'};
          color:${selected ? '#818cf8' : 'var(--muted)'};
          transition:all 0.15s;
        ">${min}m</button>`;
      }).join('')}
    </div>
  </div>

  <div style="display:flex;align-items:center;justify-content:space-between;">
    <div style="font-size:11px;color:var(--muted);">Alarm at meal time</div>
    <label class="toggle-switch">
      <input type="checkbox" id="toggleAlarmAtTime" ${(getRemindersState().alarmAtTime !== false) ? 'checked' : ''} onchange="toggleAlarmAtTime(this.checked)">
      <span class="toggle-slider"></span>
    </label>
  </div>
  <div style="font-size:10px;color:var(--muted);margin-top:4px;">🔔 Rings at exact meal time until you tap Done</div>
</div>
      <div>${mealRows}</div>
    </div>

    <!-- Water Reminders -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div>
          <div style="font-family:var(--font);font-size:14px;font-weight:600;">💧 Water Reminders</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">Stay hydrated — 3–4 L daily</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="toggleWater" ${rs.waterOn ? 'checked' : ''} onchange="handleWaterToggle(this.checked)" ${!permGranted ? 'disabled' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-size:12px;color:var(--muted);flex-shrink:0;">Every</div>
        <input type="range" id="waterRange" min="30" max="120" step="15" value="${rs.waterInterval}"
          oninput="handleWaterInterval(this.value)"
          style="flex:1;accent-color:var(--accent2);" ${!permGranted || !rs.waterOn ? 'disabled' : ''}>
        <div style="font-size:12px;color:var(--accent2);font-family:var(--font);font-weight:600;min-width:44px;" id="waterIntervalLabel">${rs.waterInterval} min</div>
      </div>
      <button onclick="sendTestWater()" style="background:transparent;border:1px dashed var(--border);color:var(--accent2);padding:7px 14px;border-radius:8px;font-size:12px;cursor:pointer;font-family:var(--body);margin-top:10px;width:100%;" ${!permGranted ? 'disabled' : ''}>
        💧 Test water notification
      </button>
    </div>

    <!-- Water Log -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;">
      <div style="font-family:var(--font);font-size:14px;font-weight:600;margin-bottom:10px;">💧 Water Log Today</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
  <span style="font-size:12px;color:var(--muted);">Goal</span>

  <div style="display:flex;align-items:center;gap:8px;">
    <button onclick="setWaterGoal((getRemindersState().waterGoalGlasses||8)-1)"
      style="width:28px;height:28px;border:none;border-radius:8px;background:var(--card);color:var(--text);cursor:pointer;">−</button>

    <span id="waterGoalLabel"
      style="min-width:24px;text-align:center;font-weight:600;">
      ${rs.waterGoalGlasses || 8}
    </span>

    <button onclick="setWaterGoal((getRemindersState().waterGoalGlasses||8)+1)"
      style="width:28px;height:28px;border:none;border-radius:8px;background:var(--card);color:var(--text);cursor:pointer;">+</button>
  </div>
</div>
      <div id="waterGlasses" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:12px;color:var(--muted);" id="waterStatus">0 / 8 glasses · 0 L</div>
        <div style="display:flex;gap:8px;">
          <button onclick="logWater(-1)" style="background:var(--card);border:1px solid var(--border);color:var(--muted);width:30px;height:30px;border-radius:8px;font-size:16px;cursor:pointer;">−</button>
          <button onclick="logWater(1)" style="background:var(--accent2);border:none;color:#000;width:30px;height:30px;border-radius:8px;font-size:16px;cursor:pointer;font-weight:700;">+</button>
        </div>
      </div>
    </div>`;
}

async function handleEnableNotif() {
  const granted = await requestNotifPermission();

  if (granted) {
    await getFCMToken();

    const rs = getRemindersState();
    rs.mealsOn = true;
    rs.waterOn = true;
   saveRemindersState(rs);
await syncScheduleToCloudflare();

    if (navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(() => {
        scheduleMealReminders();
        startWaterReminders(rs.waterInterval);
      });
    } else {
      scheduleMealReminders();
      startWaterReminders(rs.waterInterval);
    }

    renderAll();
    showToast('🔔 Alarms enabled!');
  } else {
    renderAll();
  }
}

async function handleMealToggle(on) {
  const rs = getRemindersState();
  rs.mealsOn = on;
  saveRemindersState(rs);

  await syncScheduleToCloudflare();

  if (on) scheduleMealReminders();
  else clearMealTimers();

  renderAll();
  showToast(on ? '🍽️ Meal reminders ON' : 'Meal reminders off');
}

async function handleWaterToggle(on) {
  const rs = getRemindersState();
  rs.waterOn = on;
  saveRemindersState(rs);

  await syncScheduleToCloudflare();

  if (on) startWaterReminders(rs.waterInterval);
  else clearWaterTimer();

  renderAll();
  showToast(on ? '💧 Water reminders ON' : 'Water reminders off');
}

async function handleWaterInterval(val) {
  const rs = getRemindersState();
  rs.waterInterval = parseInt(val);
  saveRemindersState(rs);

  await syncScheduleToCloudflare();

  document.getElementById('waterIntervalLabel').textContent = val + ' min';
  if (rs.waterOn) startWaterReminders(rs.waterInterval);
}


// --- PUSH NOTIFICATIONS ---
const PUSH_WORKER_URL = 'https://diet-push.vinayaknehwal98.workers.dev';

async function sendPushNotification(title, body, data = {}) {
  const token = localStorage.getItem('fcmToken');
  if (!token) return;
  try {
    await fetch(PUSH_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, title, body, data })
    });
  } catch(err) {
    console.warn('Push failed:', err);
  }
}

async function schedulePushReminders() {
  const token = localStorage.getItem('fcmToken');
  if (!token) return;
  const rs = getRemindersState();
  const remindBefore = rs.remindBefore || [15, 10, 5];
  const alarmAtTime = rs.alarmAtTime !== false;
  const now = new Date();

  state.meals.forEach(meal => {
    const [h, m] = meal.timeVal.split(':').map(Number);

    remindBefore.forEach(before => {
      const mealTime = new Date();
      mealTime.setHours(h, m - before, 0, 0);
      const diff = mealTime - now;
      if (diff <= 0) return;
      setTimeout(async () => {
        if (isMealDone(meal.id)) return;
        await sendPushNotification(
          `⏰ ${meal.name.replace(/^[^\w\s]*\s*/, '')} in ${before} min`,
          `${meal.timeLabel} · ${meal.kcal} kcal`,
          { mealId: meal.id, type: 'reminder' }
        );
      }, diff);
    });

    if (alarmAtTime) {
      const mealTime = new Date();
      mealTime.setHours(h, m, 0, 0);
      const diff = mealTime - now;
      if (diff <= 0) return;
      setTimeout(async () => {
        if (isMealDone(meal.id)) return;
        await sendPushNotification(
          `🔔 ${meal.name.replace(/^[^\w\s]*\s*/, '')} Time!`,
          `${meal.timeLabel} · Tap Done when finished`,
          { mealId: meal.id, type: 'alarm' }
        );
        startAudioAlarm(meal.id);
      }, diff);
    }
  });
}
  


  function toggleReminderChip(min) {
  const rs = getRemindersState();
  if (!rs.remindBefore) rs.remindBefore = [15, 10, 5];
  
  const idx = rs.remindBefore.indexOf(min);
  if (idx >= 0) {
    rs.remindBefore.splice(idx, 1);
  } else {
    rs.remindBefore.push(min);
    rs.remindBefore.sort((a,b) => b-a);
  }
  
  saveRemindersState(rs);
  
  // Update chip UI
  const chip = document.getElementById(`chip_${min}`);
  if (chip) {
    const selected = rs.remindBefore.includes(min);
    chip.style.borderColor = selected ? '#6366f1' : 'var(--border)';
    chip.style.background = selected ? 'rgba(99,102,241,0.15)' : 'transparent';
    chip.style.color = selected ? '#818cf8' : 'var(--muted)';
  }
  
  // Reschedule with new timing
  if (rs.mealsOn) scheduleMealReminders();
  showToast(rs.remindBefore.length ? `Reminders: ${rs.remindBefore.join(', ')}min before` : 'No pre-meal reminders');
}

function toggleAlarmAtTime(on) {
  const rs = getRemindersState();
  rs.alarmAtTime = on;
  saveRemindersState(rs);
  if (rs.mealsOn) scheduleMealReminders();
  showToast(on ? '🔔 Alarm at meal time ON' : 'Alarm at meal time OFF');
}
