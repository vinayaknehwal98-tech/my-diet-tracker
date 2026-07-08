// --- EXPORT ---
function renderExport() {
  // Count how many days have any data
  const allKeys = Object.keys(state.checked).filter(k => state.checked[k]);
  const daysWithData = [...new Set(allKeys.map(k => k.split('_')[0]))].length;
  const totalChecked = allKeys.length;
  const totalPossible = daysWithData * state.meals.length;
  const consistency = totalPossible > 0 ? Math.round((totalChecked / totalPossible) * 100) : 0;

  const todayWaterGlasses = typeof todayWaterKey === 'function'
    ? parseInt(localStorage.getItem(todayWaterKey()) || 0)
    : 0;

  return `
    <div style="padding-bottom:10px;">

      <!-- Summary card -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px;">
        <div style="font-family:var(--font);font-size:14px;font-weight:600;margin-bottom:12px;">📊 Your Progress Summary</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:var(--card);border-radius:10px;padding:10px;">
            <div style="font-family:var(--font);font-size:20px;font-weight:700;color:var(--accent);">${daysWithData}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px;">Days Tracked</div>
          </div>
          <div style="background:var(--card);border-radius:10px;padding:10px;">
            <div style="font-family:var(--font);font-size:20px;font-weight:700;color:var(--green);">${consistency}%</div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px;">Consistency</div>
          </div>
          <div style="background:var(--card);border-radius:10px;padding:10px;">
            <div style="font-family:var(--font);font-size:20px;font-weight:700;color:var(--accent2);">${totalChecked}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px;">Meals Completed</div>
          </div>
          <div style="background:var(--card);border-radius:10px;padding:10px;">
            <div style="font-family:var(--font);font-size:20px;font-weight:700;color:var(--yellow);">${todayWaterGlasses}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px;">Today Glasses 💧</div>
          </div>
        </div>
      </div>

      <!-- What's exported -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px;">
        <div style="font-family:var(--font);font-size:13px;font-weight:600;margin-bottom:10px;">📋 Excel File Will Include</div>
        ${[
         ['Sheet 1 — Daily Log', 'Date, Day, each meal checked/skipped, total kcal, protein, carbs, fat consumed'],
['Sheet 2 — Meal Details', 'Full food breakdown per meal with quantities and macros'],
['Sheet 3 — Water Log', 'Daily glasses, litres, and goal hit status'],
['Sheet 4 — Missed Reasons', 'Meals you missed and the reason why'],
['Sheet 5 — Weight Log', 'Daily weight entries and progress'],
['Sheet 6 — Weekly Summary', 'Per-week totals, averages, perfect days, consistency %'],
['Sheet 7 - Workout Logs', 'Every workout set with weight, reps, RIR, completion, pattern, and volume contribution'],
['Sheet 8 - Exercise History', 'Top set, total reps, total volume, and set pattern per exercise session'],
        ].map(([title, desc]) => `
          <div style="display:flex;gap:10px;margin-bottom:8px;align-items:flex-start;">
            <div style="width:8px;height:8px;background:var(--accent);border-radius:50%;margin-top:4px;flex-shrink:0;"></div>
            <div>
              <div style="font-size:12px;font-weight:600;font-family:var(--font);">${title}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px;line-height:1.4;">${desc}</div>
            </div>
          </div>`).join('')}
      </div>

      <!-- Export buttons -->
      <button onclick="exportToExcel()" style="
        width:100%;background:var(--green);border:none;color:#000;
        padding:14px;border-radius:12px;font-size:15px;font-weight:700;
        cursor:pointer;font-family:var(--font);margin-bottom:10px;
        display:flex;align-items:center;justify-content:center;gap:8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Excel (.xlsx)
      </button>
      <button onclick="exportToCSV()" style="
        width:100%;background:transparent;border:1px solid var(--border);color:var(--muted);
        padding:11px;border-radius:12px;font-size:13px;font-weight:500;
        cursor:pointer;font-family:var(--font);
        display:flex;align-items:center;justify-content:center;gap:8px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Export as CSV (fallback)
      </button>

      <div style="margin-top:12px;font-size:11px;color:var(--muted);text-align:center;line-height:1.6;">
        All data stored on your device · Export anytime to review progress
      </div>
    </div>`;
}

function getWorkoutExportRows() {
  const rows = [['Date','Day','Workout','Exercise','Set #','Weight','Reps','RIR','Completed','Pattern','Exercise Notes','Volume Contribution']];
  if (typeof getWorkoutState !== 'function' || typeof normalizeExerciseLog !== 'function') {
    rows.push(['Workout tracker unavailable','','','','','','','','','','','']);
    return rows;
  }
  const workoutState = getWorkoutState();
  Object.entries(workoutState.logs || {}).sort(([a], [b]) => String(a).localeCompare(String(b))).forEach(([date, dayLog]) => {
    Object.entries(dayLog.exercises || {}).forEach(([exerciseId, log]) => {
      const exercise = typeof findExerciseById === 'function'
        ? (findExerciseById(exerciseId) || { id: exerciseId, name: exerciseId })
        : { id: exerciseId, name: exerciseId };
      const normalized = normalizeExerciseLog(log, exercise);
      const pattern = typeof detectSetPattern === 'function' ? detectSetPattern(normalized.sets) : '';
      normalized.sets.forEach((set, index) => {
        const weight = Number(set.weight);
        const reps = Number(set.reps);
        rows.push([
          date,
          dayLog.dayName || '',
          dayLog.workoutName || '',
          exercise.name || exerciseId,
          set.setNumber || index + 1,
          set.weight === '' ? '' : set.weight,
          set.reps === '' ? '' : set.reps,
          set.rir === '' ? '' : set.rir,
          set.completed ? 'Yes' : 'No',
          pattern,
          normalized.notes || '',
          Number.isFinite(weight) && Number.isFinite(reps) ? weight * reps : ''
        ]);
      });
    });
  });
  if (rows.length === 1) rows.push(['No workout logs yet','','','','','','','','','','','']);
  return rows;
}

function getExerciseHistoryExportRows() {
  const rows = [['Date','Exercise','Workout','Top Set','Total Reps','Total Volume','Pattern','Completed','Notes']];
  if (typeof getWorkoutState !== 'function' || typeof normalizeExerciseLog !== 'function') {
    rows.push(['Workout tracker unavailable','','','','','','','','']);
    return rows;
  }
  const workoutState = getWorkoutState();
  Object.entries(workoutState.exerciseHistory || {}).forEach(([exerciseId, entries]) => {
    (entries || []).forEach(entry => {
      const exercise = typeof findExerciseById === 'function'
        ? (findExerciseById(exerciseId) || { id: exerciseId, name: exerciseId })
        : { id: exerciseId, name: exerciseId };
      const normalized = normalizeExerciseLog(entry, exercise);
      const top = typeof getTopSet === 'function' ? getTopSet(normalized.sets) : null;
      const totalReps = typeof getTotalRepsFromSets === 'function' ? getTotalRepsFromSets(normalized.sets) : '';
      const totalVolume = typeof calculateSetBasedVolume === 'function' ? calculateSetBasedVolume(normalized.sets) : '';
      const pattern = typeof detectSetPattern === 'function' ? detectSetPattern(normalized.sets) : '';
      rows.push([
        entry.date || '',
        exercise.name || exerciseId,
        entry.workoutName || '',
        top ? `${top.weight || 0} x ${top.reps || 0}` : '',
        totalReps,
        totalVolume ?? '',
        pattern,
        normalized.completed ? 'Yes' : 'No',
        normalized.notes || ''
      ]);
    });
  });
  if (rows.length === 1) rows.push(['No exercise history yet','','','','','','','','']);
  return rows;
}

function exportToExcel() {
  // Build all data
  const allDayKeys = [...new Set(Object.keys(state.checked).map(k => k.split('_').slice(0,-1).join('_')))];

  // Sheet 1 — Daily Log
  const dailyRows = [['Date','Day','Breakfast','Lunch','Evening Snack','Pre-Workout','Dinner','Total Kcal','Total Protein (g)','Total Carbs (g)','Total Fat (g)','Meals Done']];

  // Collect all unique date keys from checked state
  const allKeys = Object.keys(state.checked);
  // Group by "day" (Mon, Tue etc) — we'll use the weekly tracker data
  // For a real month export, we'll use stored history if any, else weekly
  const dateMap = {};
  allKeys.forEach(k => {
    const parts = k.split('_');
    const mealId = parts[parts.length - 1];
    const dayKey = parts.slice(0, parts.length - 1).join('_');
    if (!dateMap[dayKey]) dateMap[dayKey] = {};
    dateMap[dayKey][mealId] = state.checked[k];
  });

  Object.keys(dateMap).sort().forEach(dayKey => {
    const meals = dateMap[dayKey];
    const doneMeals = state.meals.filter(m => meals[m.id]);
    const totalKcal = doneMeals.reduce((a,m)=>a+m.kcal,0);
    const totalPro  = doneMeals.reduce((a,m)=>a+m.protein,0);
    const totalCarbs= doneMeals.reduce((a,m)=>a+(m.carbs||0),0);
    const totalFat  = doneMeals.reduce((a,m)=>a+(m.fat||0),0);
    const row = [
      new Date().toLocaleDateString('en-IN'), // date approximation
      dayKey,
      meals['breakfast'] ? '✓' : '✗',
      meals['lunch']     ? '✓' : '✗',
      meals['snack']     ? '✓' : '✗',
      meals['preworkout']? '✓' : '✗',
      meals['dinner']    ? '✓' : '✗',
      totalKcal, totalPro, totalCarbs, totalFat, doneMeals.length
    ];
    dailyRows.push(row);
  });

  // Sheet 2 — Meal Details
  const mealRows = [['Meal','Time','Food Item','Quantity','Calories','Protein (g)','Notes']];
  state.meals.forEach(meal => {
    meal.foods.forEach((food, fi) => {
      mealRows.push([
        fi === 0 ? meal.name.replace(/^[^\w\s]*\s*/,'') : '',
        fi === 0 ? meal.timeLabel : '',
        food.name, food.qty, food.cal, food.pro,
        fi === 0 ? `Total: ${meal.kcal} kcal, ${meal.protein}g P, ${meal.carbs||0}g C, ${meal.fat||0}g F` : ''
      ]);
    });
    mealRows.push(['','','','','','','']); // spacer
  });

  // Sheet 3 — Water Log
  const waterRows = [['Date','Glasses','Litres','Goal Hit (8 glasses = 2L)']];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('water_')) {
      const glasses = parseInt(localStorage.getItem(key) || 0);
      waterRows.push([
        key.replace('water_', ''),
        glasses,
        (glasses * 0.25).toFixed(2),
        glasses >= 8 ? 'Yes ✓' : 'No ✗'
      ]);
    }
  }
  if (waterRows.length === 1) waterRows.push(['No water data yet','','','']);

// Sheet 4 — Missed Meal Reasons
const missedMealRows = [
  ['Date', 'Meal', 'Reason']
];

Object.entries(state.missedMeals).forEach(
  ([key, reason]) => {

    const parts = key.split('_');

    const date = parts[0];

    const mealId = parts.slice(1).join('_');

    const mealName =
      state.meals.find(
        m => m.id === mealId
      )?.name.replace(/^[^\w\s]*\s*/, '')
      || mealId;

    missedMealRows.push([
      date,
      mealName,
      reason
    ]);
  }
);

// Sheet 5 — Weight Log
const weightRows = [
  ['Date', 'Weight (kg)']
];

state.weightHistory.forEach(entry => {

  weightRows.push([
    entry.date,
    entry.weight
  ]);

});

  // Sheet 4 — Weekly Summary
  const weekSummaryRows = [['Week Day','Meals Done','Total Kcal','Total Protein (g)','Total Carbs (g)','Total Fat (g)','Perfect Day']];
  DAYS.forEach(day => {
    const doneMeals = state.meals.filter(m => !!state.checked[`${day}_${m.id}`]);
    weekSummaryRows.push([
      day,
      doneMeals.length,
      doneMeals.reduce((a,m)=>a+m.kcal,0),
      doneMeals.reduce((a,m)=>a+m.protein,0),
      doneMeals.reduce((a,m)=>a+(m.carbs||0),0),
      doneMeals.reduce((a,m)=>a+(m.fat||0),0),
      doneMeals.length === state.meals.length ? 'Yes ✓' : 'No'
    ]);
  });

  const workoutLogRows = getWorkoutExportRows();
  const exerciseHistoryRows = getExerciseHistoryExportRows();

  // Build XLSX using SheetJS via CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  script.onload = () => {
    const wb = XLSX.utils.book_new();

    const styleSheet = (ws) => {
      // Column widths
      ws['!cols'] = Array(15).fill({ wch: 18 });
      return ws;
    };

    const ws1 = styleSheet(XLSX.utils.aoa_to_sheet(dailyRows));
const ws2 = styleSheet(XLSX.utils.aoa_to_sheet(mealRows));
const ws3 = styleSheet(XLSX.utils.aoa_to_sheet(waterRows));
const ws4 = styleSheet(XLSX.utils.aoa_to_sheet(missedMealRows));
const ws5 = styleSheet(XLSX.utils.aoa_to_sheet(weightRows));
const ws6 = styleSheet(XLSX.utils.aoa_to_sheet(weekSummaryRows));
const ws7 = styleSheet(XLSX.utils.aoa_to_sheet(workoutLogRows));
const ws8 = styleSheet(XLSX.utils.aoa_to_sheet(exerciseHistoryRows));

XLSX.utils.book_append_sheet(wb, ws1, 'Daily Log');
XLSX.utils.book_append_sheet(wb, ws2, 'Meal Details');
XLSX.utils.book_append_sheet(wb, ws3, 'Water Log');
XLSX.utils.book_append_sheet(wb, ws4, 'Missed Reasons');
XLSX.utils.book_append_sheet(wb, ws5, 'Weight Log');
XLSX.utils.book_append_sheet(wb, ws6, 'Weekly Summary');
XLSX.utils.book_append_sheet(wb, ws7, 'Workout Logs');
XLSX.utils.book_append_sheet(wb, ws8, 'Exercise History');


    const date = new Date().toLocaleDateString('en-IN').replace(/\//g,'-');
    XLSX.writeFile(wb, `BulkDiet_Export_${date}.xlsx`);
    showToast('✅ Excel downloaded!');
  };
  script.onerror = () => {
    showToast('⚠️ Failed to load export library. Try CSV instead.');
  };
  document.head.appendChild(script);
}

function exportToCSV() {
  // Export daily log as CSV fallback
  const lines = [['Day','Breakfast','Lunch','Snack','Pre-WO','Dinner','Kcal','Protein','Carbs','Fat'].join(',')];
  DAYS.forEach(day => {
    const doneMeals = state.meals.filter(m => !!state.checked[`${day}_${m.id}`]);
    lines.push([
      day,
      state.checked[`${day}_breakfast`]   ? 1 : 0,
      state.checked[`${day}_lunch`]        ? 1 : 0,
      state.checked[`${day}_snack`]        ? 1 : 0,
      state.checked[`${day}_preworkout`]   ? 1 : 0,
      state.checked[`${day}_dinner`]       ? 1 : 0,
      doneMeals.reduce((a,m)=>a+m.kcal,0),
      doneMeals.reduce((a,m)=>a+m.protein,0),
      doneMeals.reduce((a,m)=>a+(m.carbs||0),0),
      doneMeals.reduce((a,m)=>a+(m.fat||0),0),
    ].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `BulkDiet_${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.csv`;
  a.click();
  showToast('✅ CSV downloaded!');
}
