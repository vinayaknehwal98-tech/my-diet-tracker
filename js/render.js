// --- RENDER ---
let activeTab = 'today';

function switchTab(tab, btn) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderAll();
}

function renderAll() {
  updateMacros();
  const main = document.getElementById('mainContent');

  if (activeTab === 'today') {
    main.innerHTML = renderToday();

  }
  else if (activeTab === 'week') {
    main.innerHTML = renderWeek();
  }
  else if (activeTab === 'reminders') {
    main.innerHTML = renderReminders();
  }
  else if (activeTab === 'export') {
    main.innerHTML = renderExport();
  }

  const opts = {
    weekday:'long',
    day:'numeric',
    month:'long',
    year:'numeric'
  };

  document.getElementById('dateBadge').textContent =
    today.toLocaleDateString('en-IN', opts) + ' · IST';
}


function updateMacros() {
  const TOTAL = {
  kcal: state.meals.reduce((a,m) => a + m.kcal, 0) || 3320,
  pro: state.meals.reduce((a,m) => a + m.protein, 0) || 149,
  carbs: state.meals.reduce((a,m) => a + (m.carbs||0), 0) || 415,
  fat: state.meals.reduce((a,m) => a + (m.fat||0), 0) || 72
};

document.querySelector('#macroKcal').closest('.macro-item').querySelector('.total-lbl').textContent = `/ ${TOTAL.kcal.toLocaleString()}`;
  document.querySelector('#macroPro').closest('.macro-item').querySelector('.total-lbl').textContent = `/ ${TOTAL.pro}g`;
  document.querySelector('#macroCarbs').closest('.macro-item').querySelector('.total-lbl').textContent = `/ ${TOTAL.carbs}g`;
  document.querySelector('#macroFat').closest('.macro-item').querySelector('.total-lbl').textContent = `/ ${TOTAL.fat}g`;
  
  const doneMeals = state.meals.filter(m => isMealDone(m.id));
  const extras = (state.extraMeals || []).filter(e => e.date === todayKey());
  const kcal  = doneMeals.reduce((a,m) => a + m.kcal, 0)    + extras.reduce((a,e) => a + e.kcal, 0);
  const pro   = doneMeals.reduce((a,m) => a + m.protein, 0) + extras.reduce((a,e) => a + e.protein, 0);
  const carbs = doneMeals.reduce((a,m) => a + (m.carbs || 0), 0) + extras.reduce((a,e) => a + (e.carbs || 0), 0);
  const fat   = doneMeals.reduce((a,m) => a + (m.fat || 0), 0)   + extras.reduce((a,e) => a + (e.fat || 0), 0);

  const pKcal  = Math.min(100, Math.round((kcal  / TOTAL.kcal)  * 100));
  const pPro   = Math.min(100, Math.round((pro   / TOTAL.pro)   * 100));
  const pCarbs = Math.min(100, Math.round((carbs / TOTAL.carbs) * 100));
  const pFat   = Math.min(100, Math.round((fat   / TOTAL.fat)   * 100));

  document.getElementById('macroKcal').textContent  = kcal  ? kcal.toLocaleString() : '0';
  document.getElementById('macroPro').textContent   = pro   ? pro + 'g'   : '0g';
  document.getElementById('macroCarbs').textContent = carbs ? carbs + 'g' : '0g';
  document.getElementById('macroFat').textContent   = fat   ? fat + 'g'   : '0g';

  document.getElementById('barKcal').style.width  = pKcal  + '%';
  document.getElementById('barPro').style.width   = pPro   + '%';
  document.getElementById('barCarbs').style.width = pCarbs + '%';
  document.getElementById('barFat').style.width   = pFat   + '%';
}

function renderToday() {

state.meals.forEach(meal => {
  ensureMissedMealReason(meal);
});

  const startWeight =
  state.contract.locked
    ? state.contract.startWeight
    : getCurrentWeight();

const currentWeight = getCurrentWeight();
const targetWeight = getGoalWeight();

console.log(
  "Start:",
  startWeight,
  "Current:",
  currentWeight,
  "Goal:",
  targetWeight
);

const progress = Math.max(
  0,
  Math.min(
    100,
    ((currentWeight - startWeight) /
      (targetWeight - startWeight)) * 100
  )
);

const remainingWeight = Math.max(
  0,
  targetWeight - currentWeight
);
  const TOTAL_KCAL = state.meals.reduce((a,m) => a + m.kcal, 0);
  const todayExtraKcal = (state.extraMeals || []).filter(e => e.date === todayKey()).reduce((a,e) => a + e.kcal, 0);
  const doneKcal   = state.meals.filter(m => isMealDone(m.id)).reduce((a,m) => a + m.kcal, 0) + todayExtraKcal;
  const doneMeals  = completedCount();
  const totalMeals = state.meals.length;
  const pct = TOTAL_KCAL > 0 ? Math.round((doneKcal / TOTAL_KCAL) * 100) : 0;
  const r = 29, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  let html = `
    <div class="day-progress">
      <div class="progress-ring-wrap">
        <svg width="70" height="70" viewBox="0 0 70 70">
          <circle cx="35" cy="35" r="${r}" fill="none" stroke="#2a3040" stroke-width="6"/>
          <circle cx="35" cy="35" r="${r}" fill="none" stroke="#f97316" stroke-width="6"
            stroke-dasharray="${dash} ${circ}" stroke-linecap="round"/>
        </svg>
        <div class="ring-center">
          <div class="pct">${pct}%</div>
          <div class="sub">${doneKcal} cal</div>
        </div>
      </div>
      <div class="day-info">
        <h2>${doneMeals === totalMeals ? '🎉 All meals done!' : doneMeals === 0 ? 'EARN IT' : `${totalMeals - doneMeals} meal${totalMeals - doneMeals > 1 ? 's' : ''} left`}</h2>
        <p>Target: ${state.meals.reduce((a,m)=>a+m.kcal,0).toLocaleString()} kcal · ${state.meals.reduce((a,m)=>a+m.protein,0)}g protein<br>Just Stay Fuckin Consistent</p>
      </div>
    </div>
  `;

  // Extra meals logged today
  const todayExtras = (state.extraMeals || []).filter(e => e.date === todayKey());
  if (todayExtras.length) {
    html += `<div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.08em;margin:18px 0 8px 4px;">EXTRA / SWAPPED TODAY</div>`;
    todayExtras.forEach(ex => {
      html += `
        <div class="meal-card" style="border-color:rgba(139,148,158,0.25);opacity:0.85;">
          <div class="meal-header">
            <div class="meal-left">
              <span class="meal-emoji">${ex.emoji || '📸'}</span>
              <div>
                <div class="meal-title">${ex.name}</div>
                <div class="meal-time">${ex.swappedFor ? 'Swapped for ' + ex.swappedFor : 'Extra meal'} · ${ex.time || ''}</div>
              </div>
            </div>
            <div class="meal-right">
              <div class="meal-kcal">~${ex.kcal} kcal</div>
              <button class="check-btn checked" onclick="removeExtra('${ex.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div style="padding:0 14px 12px;display:flex;gap:8px;flex-wrap:wrap;">
            <span style="font-size:12px;color:var(--muted);">${ex.protein}g protein</span>
            <span style="font-size:12px;color:var(--muted);">${ex.carbs||0}g carbs</span>
            <span style="font-size:12px;color:var(--muted);">${ex.fat||0}g fat</span>
          </div>
        </div>`;
    });
  }

  html += `<div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.08em;margin:18px 0 8px 4px;">TODAY'S PLAN</div>`;
  html += `<button class="fab-extra" onclick="openSnapModal(null, null)">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Log Extra
  </button>`;

  state.meals.forEach((meal, idx) => {
    const done = isMealDone(meal.id);
    html += `
      <div class="meal-card ${done ? 'done' : ''}" id="card_${meal.id}">
        <div class="meal-header" onclick="toggleExpand('${meal.id}')">
          <div class="meal-left">
            <span class="meal-emoji">${meal.emoji}</span>
            <div>
              <div class="meal-title">${meal.name.replace(/^[^\w]*/, '')}</div>
              <div class="meal-time">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${meal.timeLabel}
              </div>
            </div>
          </div>
          <div class="meal-right">
            <div class="meal-kcal">~${meal.kcal} kcal</div>
            <button class="check-btn ${done ? 'checked' : ''}" onclick="event.stopPropagation(); toggleMealDone('${meal.id}')">
              ${done ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
            </button>
          </div>
        </div>
        <div class="meal-body" id="body_${meal.id}">
          <hr>
          <table class="food-table">
            <thead><tr><th>Food</th><th>Qty</th><th>Cal</th><th>Pro</th></tr></thead>
            <tbody>
              ${meal.foods.map(f => `
                <tr>
                  <td>${f.name}</td>
                  <td>${f.qty}</td>
                  <td>${f.cal}</td>
                  <td>${f.pro}g</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="meal-total-row">
            <span class="lbl">Meal Total</span>
            <div class="vals">
              <span class="v kcal">~${meal.kcal} kcal</span>
              <span class="v pro">~${meal.protein}g P</span>
              <span class="v" style="color:var(--yellow)">~${meal.carbs||'?'}g C</span>
              <span class="v" style="color:var(--green)">~${meal.fat||'?'}g F</span>
            </div>
          </div>
         
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="edit-btn" onclick="openModal(${idx})">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button class="edit-btn snap-btn" onclick="event.stopPropagation(); openSnapModal('${meal.id}', '${meal.name.replace(/'/g,'')}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              I Ate This
            </button>
          </div>
        </div>
      </div>
    `;

    if (isMealMissed(meal) && !done) {

      html += `
      <div style="
        margin:8px 0 16px 0;
        padding:14px;
        border-radius:16px;
        background:rgba(239,68,68,.08);
        border:1px solid rgba(239,68,68,.15);
      ">

        <div style="
          color:#ef4444;
          font-size:12px;
          font-weight:700;
          margin-bottom:10px;
        ">
          WHY DID YOU MISS ${meal.name.replace(/^[^\w]*/, '').toUpperCase()}?
        </div>

        <textarea
  oninput="saveMissReason('${meal.id}', this.value)"
          placeholder="Write your reason..."
          style="
            width:100%;
            min-height:80px;
            background:#111;
            color:white;
            border:1px solid rgba(255,255,255,.08);
            border-radius:10px;
            padding:10px;
            resize:none;
          "
        >${
          state.missedMeals[
            `${todayKey()}_${meal.id}`
          ] || ''
        }</textarea>

      </div>
      `;
    }
  });
  

html += `
<div style="
  background: rgba(15,15,16,0.95);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 22px;
  padding: 20px;
  margin-top: 16px;
">
  <div style="
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--muted);
  margin-bottom: 8px;
">
  BULKING PROGRESS
</div>

${state.contract.locked ? `
<div style="
  display:inline-block;
  padding:4px 10px;
  border-radius:999px;
  background:rgba(34,197,94,.12);
  border:1px solid rgba(34,197,94,.25);
  color:#22c55e;
  font-size:11px;
  font-weight:600;
  margin-bottom:14px;
">
  LOCKED IN 🔒
</div>
` : `
<div style="margin-bottom:14px;">
  <button
    onclick="lockContract()"
    style="
      background:#22c55e;
      color:white;
      border:none;
      border-radius:10px;
      padding:8px 14px;
      cursor:pointer;
      font-size:12px;
      font-weight:600;
    "
  >
    LOCK IN
  </button>
</div>
`}

<div style="
  font-size:22px;
  font-weight:700;
  margin-bottom:14px;
  color:var(--accent);
">
  🔥 ${getCurrentStreak()} DAY STREAK
</div>

<div style="
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:10px;
">

   <div>
  <div style="
    font-size:24px;
    font-weight:700;
  ">
   <span
  ${!state.contract.locked ? 'onclick="editStartWeight()"' : ''}
  style="cursor:${!state.contract.locked ? 'pointer' : 'default'};"
>
  ${
    state.contract.locked
      ? state.contract.startWeight.toFixed(1)
      : (state.contract.startWeight || 0).toFixed(1)
  } kg
</span>
  </div>

  <div style="
    font-size:11px;
    color:var(--muted);
  ">
    ${
      state.contract.locked
        ? 'START'
        : 'CURRENT'
    }
  </div>
</div>
    <div style="
      color:var(--muted);
      font-size:18px;
    ">
      →
    </div>

    <div style="text-align:right;">
      <div style="
        font-size:24px;
        font-weight:700;
      ">
        <span
  ${!state.contract.locked ? 'onclick="editGoalWeight()"' : ''}
  style="cursor:${!state.contract.locked ? 'pointer' : 'default'};"
>
  ${getGoalWeight().toFixed(1)} kg
</span>
      </div>
      <div style="
        font-size:11px;
        color:var(--muted);
      ">
        TARGET
      </div>
    </div>
  </div>

  <div style="
    width:100%;
    height:12px;
    background:rgba(255,255,255,.08);
    border-radius:999px;
    overflow:hidden;
    margin-top:18px;
  ">
    <div style="
      height:100%;
      width:${progress}%;
      background:linear-gradient(
        90deg,
        #22c55e,
        #84cc16,
        #eab308
      );
      border-radius:999px;
    "></div>
     </div>

  <div style="
  display:flex;
  justify-content:space-between;
  margin-top:8px;
  font-size:12px;
  color:var(--muted);
">
  <span>${Math.round(progress)}%</span>
  <span>+${remainingWeight.toFixed(1)} kg to goal</span>
</div>

${state.contract.locked ? `
<div style="
  display:flex;
  justify-content:flex-end;
  margin-top:14px;
">
  <button
    onclick="unlockContract()"
    style="
      background:none;
      border:none;
      color:#ef4444;
      font-size:12px;
      font-weight:700;
      cursor:pointer;
    "
  >
    QUIT
  </button>
</div>
` : ''}

  </div>

</div>
`;

html += `
<div style="
  background: rgba(15,15,16,0.95);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 22px;
  padding: 20px;
  margin-top: 16px;
">

  <div style="
    font-size:12px;
    letter-spacing:2px;
    color:var(--muted);
    margin-bottom:14px;
  ">
    WEIGHT LOG
  </div>

  ${
    state.weightHistory.length
      ? state.weightHistory
          .slice()
          .reverse()
          .slice(0, 7)
          .map(entry => `
            <div style="
              display:flex;
              justify-content:space-between;
              padding:8px 0;
              border-bottom:1px solid rgba(255,255,255,0.05);
            ">
              <span>${entry.date}</span>
              <strong>${entry.weight} kg</strong>
            </div>
          `).join('')
      : `
        <div style="
          color:var(--muted);
          text-align:center;
          padding:12px 0;
        ">
          No weight entries yet
        </div>
      `
  }

  <button
    onclick="addWeightEntry()"
    style="
      margin-top:14px;
      width:100%;
      padding:12px;
      border:none;
      border-radius:12px;
      background:#22c55e;
      color:white;
      font-weight:600;
      cursor:pointer;
    "
  >
    + ADD TODAY'S WEIGHT
  </button>

</div>
`;         

   html += `
<div style="
  background: rgba(15,15,16,0.95);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 22px;
  padding: 20px;
  margin-top: 16px;
">
  <div style="
    font-size:12px;
    letter-spacing:2px;
    color:var(--muted);
    margin-bottom:12px;
  ">
    ACCOUNTABILITY MIRROR
  </div>

  <div style="
    color: var(--muted);
    font-size: 13px;
    margin-bottom: 10px;
  ">
   Calories Left: ${state.meals.reduce((a,m)=>a+m.kcal,0) - doneKcal}
- Protein Left: ${
  state.meals.reduce((a,m)=>a+m.protein,0) -
      state.meals
        .filter(m => isMealDone(m.id))
        .reduce((a,m)=>a+m.protein,0)
    }g
  </div>

  <div style="
    font-size:15px;
    font-weight:600;
    color:var(--accent);
  ">
    ${
      doneMeals === totalMeals
        ? 'WELL DONE SERGEANT!'
        : doneMeals >= 3
        ? 'Awwwww someone wanna Get Biggg?'
        : 'HAHAHA Skinny Bitch!!'
    }
  </div>
</div>
`;

return html;
}

function toggleExpand(id) {
  const body = document.getElementById('body_' + id);
  body.classList.toggle('open');
}

// Returns the ISO date string (YYYY-MM-DD) for a given day-of-week index (0=Sun)
// relative to the current week
function weekDayDateKey(dayIndex) {
  const d = new Date();
  const diff = dayIndex - d.getDay();
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

function renderWeek() {
  const mealNames = state.meals.map(m => m.emoji);
  const totalMeals = state.meals.length;

  // Build per-day stats using date-based keys
  const dayStats = DAYS.map((day, di) => {
    const dateKey = weekDayDateKey(di);
    const doneMeals = state.meals.filter(m => !!state.checked[`${dateKey}_${m.id}`]);
    const kcal    = doneMeals.reduce((a,m) => a + m.kcal, 0);
    const protein = doneMeals.reduce((a,m) => a + m.protein, 0);
    const count   = doneMeals.length;
    return { day, di, dateKey, kcal, protein, count };
  });

  const maxKcal = Math.max(...dayStats.map(d => d.kcal), 1);
  const TOTAL_KCAL = state.meals.reduce((a,m) => a + m.kcal, 0) || 3320;
  const TOTAL_PRO  = state.meals.reduce((a,m) => a + m.protein, 0) || 149;

  // --- Bar chart: kcal per day ---
  let barsHtml = dayStats.map(d => {
    const pct    = Math.round((d.kcal / TOTAL_KCAL) * 100);
    const height = Math.round((d.kcal / maxKcal) * 72);
    const isToday = d.di === todayIdx;
    const color  = isToday ? 'var(--accent)' : d.count === totalMeals ? 'var(--green)' : 'var(--border)';
    const fill   = d.kcal > 0 ? color : 'var(--card)';
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;">
        <div style="font-size:9px;color:${d.kcal > 0 ? 'var(--accent)' : 'transparent'};font-family:var(--font);font-weight:600;">${pct}%</div>
        <div style="width:100%;height:80px;display:flex;align-items:flex-end;justify-content:center;">
          <div style="width:70%;border-radius:4px 4px 0 0;background:${fill};height:${Math.max(height,d.kcal>0?4:0)}px;transition:height 0.4s ease;"></div>
        </div>
        <div style="font-size:10px;font-family:var(--font);font-weight:${isToday?700:500};color:${isToday?'var(--accent)':'var(--muted)'};">${d.day}</div>
        <div style="font-size:9px;color:var(--muted);">${d.kcal>0?d.kcal:''}</div>
      </div>`;
  }).join('');

  // --- Protein bar chart ---
  const maxPro = Math.max(...dayStats.map(d => d.protein), 1);
  let proBarsHtml = dayStats.map(d => {
    const pct    = Math.round((d.protein / TOTAL_PRO) * 100);
    const height = Math.round((d.protein / maxPro) * 60);
    const isToday = d.di === todayIdx;
    const fill   = d.protein > 0 ? (isToday ? 'var(--accent2)' : 'rgba(34,211,238,0.5)') : 'var(--card)';
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;">
        <div style="font-size:9px;color:${d.protein>0?'var(--accent2)':'transparent'};font-family:var(--font);font-weight:600;">${d.protein>0?d.protein+'g':''}</div>
        <div style="width:100%;height:64px;display:flex;align-items:flex-end;justify-content:center;">
          <div style="width:70%;border-radius:4px 4px 0 0;background:${fill};height:${Math.max(height,d.protein>0?4:0)}px;transition:height 0.4s;"></div>
        </div>
        <div style="font-size:10px;font-family:var(--font);font-weight:${isToday?700:400};color:${isToday?'var(--accent2)':'var(--muted)'};">${d.day}</div>
      </div>`;
  }).join('');

  // --- Weekly summary stats ---
  const weekDone   = dayStats.filter(d => d.count === totalMeals).length;
  const weekKcal   = dayStats.reduce((a,d) => a + d.kcal, 0);
  const weekPro    = dayStats.reduce((a,d) => a + d.protein, 0);
  const avgKcal    = Math.round(weekKcal / 7);
  const avgPro     = Math.round(weekPro / 7);

  // --- Dot grid ---
  let dotGrid = `
    <div class="week-grid">
      <div class="week-header-row">
        <span></span>
        ${mealNames.map(e => `<span>${e}</span>`).join('')}
      </div>`;
  DAYS.forEach((day, di) => {
    const isToday = di === todayIdx;
    const dateKey = weekDayDateKey(di);
    dotGrid += `<div class="week-day-row">
      <div class="day-lbl ${isToday ? 'today' : ''}">${day}</div>`;
    state.meals.forEach(m => {
      const done = !!state.checked[`${dateKey}_${m.id}`];
      dotGrid += `<div class="week-cell"><div class="wdot ${done ? 'done' : ''}" onclick="toggleWeek('${dateKey}','${m.id}')"></div></div>`;
    });
    dotGrid += `</div>`;
  });
  dotGrid += `</div>`;

  return `
    <div class="weekly-section">

      <!-- Kcal bar chart -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-family:var(--font);font-size:13px;font-weight:600;">🔥 Calories This Week</div>
          <div style="font-size:11px;color:var(--muted);">Target ${TOTAL_KCAL.toLocaleString()} kcal/day</div>
        </div>
        <div style="display:flex;gap:4px;align-items:flex-end;">${barsHtml}</div>
        <div style="display:flex;gap:2px;margin-top:8px;">
          <div style="flex:1;height:1px;background:var(--border);"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;">
          <div style="font-size:10px;color:var(--muted);">Avg/day: <span style="color:var(--accent);font-weight:600;">${avgKcal} kcal</span></div>
          <div style="font-size:10px;color:var(--muted);">Weekly: <span style="color:var(--accent);font-weight:600;">${weekKcal.toLocaleString()} kcal</span></div>
        </div>
      </div>

      <!-- Protein bar chart -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-family:var(--font);font-size:13px;font-weight:600;">💧 Protein This Week</div>
          <div style="font-size:11px;color:var(--muted);">Target ${TOTAL_PRO}g/day</div>
        </div>
        <div style="display:flex;gap:4px;align-items:flex-end;">${proBarsHtml}</div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;">
          <div style="font-size:10px;color:var(--muted);">Avg/day: <span style="color:var(--accent2);font-weight:600;">${avgPro}g</span></div>
          <div style="font-size:10px;color:var(--muted);">Weekly: <span style="color:var(--accent2);font-weight:600;">${weekPro}g</span></div>
        </div>
      </div>

      <!-- Summary pills -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-family:var(--font);font-size:18px;font-weight:700;color:var(--green);">${weekDone}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px;">Perfect Days</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-family:var(--font);font-size:18px;font-weight:700;color:var(--accent);">${dayStats.reduce((a,d)=>a+d.count,0)}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px;">Meals Done</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-family:var(--font);font-size:18px;font-weight:700;color:var(--yellow);">${Math.round((dayStats.reduce((a,d)=>a+d.count,0)/(7*totalMeals))*100)}%</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px;">Consistency</div>
        </div>
      </div>

      <!-- Dot tracker grid -->
      <h3 style="font-family:var(--font);font-size:13px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">📅 Meal Tracker</h3>
      ${dotGrid}
    </div>`;
}

function toggleWeek(dateKey, mealId) {
  const k = `${dateKey}_${mealId}`;
  state.checked[k] = !state.checked[k];
  saveState();
  renderAll();
}
