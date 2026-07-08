// --- WATER REMINDER SCHEDULER ---
let waterTimer = null;
const WATER_INTERVAL_MIN = 60;

function clearWaterTimer() {
  if (waterTimer) clearInterval(waterTimer);
  waterTimer = null;
}

function startWaterReminders(intervalMin) {
  clearWaterTimer();
  if (!NOTIF_SUPPORTED || Notification.permission !== 'granted') return;
  const ms = (intervalMin || WATER_INTERVAL_MIN) * 60 * 1000;
  waterTimer = setInterval(() => sendNotif('💧 Water Reminder', 'Drink a glass of water! Target: 3–4 L daily 🥤'), ms);
}



function setWaterGoal(val) {
  const rs = getRemindersState();

  const goal = Math.max(1, Math.min(20, parseInt(val) || 8));

  rs.waterGoalGlasses = goal;
  saveRemindersState(rs);

  const current = Math.min(getWaterCount(), goal);
  localStorage.setItem(todayWaterKey(), current);

  // Update the number beside Goal
  const label = document.getElementById("waterGoalLabel");
  if (label) label.textContent = goal;

  updateWaterUI();

  showToast(`💧 Water goal updated to ${goal} glasses`);
}
// --- WATER LOG ---
function todayWaterKey() { return 'water_' + new Date().toDateString(); }

function getWaterCount() {
  return parseInt(localStorage.getItem(todayWaterKey()) || '0');
}

function logWater(delta) {
  const cur = getWaterCount();
  const goal = getRemindersState().waterGoalGlasses || 8;
  const next = Math.max(0, Math.min(goal, cur + delta));

  localStorage.setItem(todayWaterKey(), next);
  updateWaterUI();

  if (next >= goal) {
    showToast(`🎉 Water goal hit! ${(next * 0.25).toFixed(1)} L done`);
  }
}
function updateWaterUI() {
  const count = getWaterCount();
  const goal = getRemindersState().waterGoalGlasses || 8;
  const container = document.getElementById('waterGlasses');
  const statusEl = document.getElementById('waterStatus');
  if (!container) return;
  let html = '';
  for (let i = 0; i < goal; i++) {
    html += `<div onclick="logWater(${i < count ? -1 : 1})" style="
      width:28px;height:28px;border-radius:6px;
      background:${i < count ? 'var(--accent2)' : 'var(--card)'};
      border:1.5px solid ${i < count ? 'var(--accent2)' : 'var(--border)'};
      display:flex;align-items:center;justify-content:center;
      font-size:14px;cursor:pointer;transition:all 0.15s;
    ">${i < count ? '💧' : ''}</div>`;
  }
  container.innerHTML = html;
  const liters = (count * 0.25).toFixed(2).replace(/\.?0+$/, '');
  statusEl.textContent = `${count} / ${goal} glasses · ${liters} L`;
}

// Re-run updateWaterUI after renderAll when on reminders tab
const _origRenderAll = renderAll;
renderAll = function() {
  _origRenderAll();
  setTimeout(updateWaterUI, 0);
};
