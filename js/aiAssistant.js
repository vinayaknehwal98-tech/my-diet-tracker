// --- X COACH ASSISTANT ---
let aiHistory = [];
let startupCoachBriefShown = false;

const COACH_NAME = 'X';
const X_COACH_GREETING = "I'm X. I’ll track your calories, protein, water, and missed meals. No fake bulk.";
const coachProfile = {
  name: 'Vinayak',
  goal: 'bulk / visible transformation',
  calorieTarget: 3320,
  proteinTarget: 149,
  carbsTarget: 415,
  fatTarget: 72,
  dietStyle: 'vegetarian + eggs',
  gymTime: '8 PM',
  preferredFoods: ['eggs', 'roti', 'banana', 'oats', 'peanut butter', 'whey', 'dal', 'rice'],
  avoidDaily: ['soya chunks'],
  wheyLimit: '1 scoop/day'
};

function openAI() {
  document.getElementById('aiDrawer').classList.add('open');
  const messages = document.getElementById('aiMessages');
  const oldMessageCached = /screw\s+up/i.test(messages.textContent);

  if (oldMessageCached) {
    messages.innerHTML = '';
    aiHistory = [];
  }

  if (!messages.hasChildNodes() || oldMessageCached) {
    addCoachMessage(X_COACH_GREETING);
  }

  setTimeout(() => document.getElementById('aiInput').focus(), 300);
}

function closeAI() {
  document.getElementById('aiDrawer').classList.remove('open');
}

document.getElementById('aiDrawer').addEventListener('click', function(e) {
  if (e.target === this) closeAI();
});

function addAIMsg(role, text) {
  const el = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  div.textContent = text;
  div.style.whiteSpace = 'pre-line';
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

function addCoachMessage(text) {
  const msg = addAIMsg('assistant', text);
  aiHistory.push({ role: 'assistant', content: text });
  if (aiHistory.length > 20) aiHistory = aiHistory.slice(-16);
  return msg;
}

function getTodayExtras() {
  return (state.extraMeals || []).filter(e => e.date === todayKey());
}

function getCoachTargets() {
  return {
    kcal: state.meals.reduce((a, m) => a + m.kcal, 0) || coachProfile.calorieTarget,
    protein: state.meals.reduce((a, m) => a + m.protein, 0) || coachProfile.proteinTarget,
    carbs: state.meals.reduce((a, m) => a + (m.carbs || 0), 0) || coachProfile.carbsTarget,
    fat: state.meals.reduce((a, m) => a + (m.fat || 0), 0) || coachProfile.fatTarget
  };
}

function getCoachContext() {
  const doneMeals = state.meals.filter(m => isMealDone(m.id));
  const extras = getTodayExtras();
  const totals = getCoachTargets();
  const consumed = {
    kcal: doneMeals.reduce((a, m) => a + m.kcal, 0) + extras.reduce((a, e) => a + (e.kcal || 0), 0),
    protein: doneMeals.reduce((a, m) => a + m.protein, 0) + extras.reduce((a, e) => a + (e.protein || 0), 0),
    carbs: doneMeals.reduce((a, m) => a + (m.carbs || 0), 0) + extras.reduce((a, e) => a + (e.carbs || 0), 0),
    fat: doneMeals.reduce((a, m) => a + (m.fat || 0), 0) + extras.reduce((a, e) => a + (e.fat || 0), 0)
  };
  const missedMeals = state.meals.filter(m => isMealMissed(m) && !isMealDone(m.id));
  const pendingMeals = state.meals.filter(m => !isMealDone(m.id));
  return {
    doneMeals,
    extras,
    totals,
    consumed,
    remaining: {
      kcal: Math.max(0, totals.kcal - consumed.kcal),
      protein: Math.max(0, totals.protein - consumed.protein),
      carbs: Math.max(0, totals.carbs - consumed.carbs),
      fat: Math.max(0, totals.fat - consumed.fat)
    },
    missedMeals,
    pendingMeals,
    water: getWaterCount(),
    waterGoal: getRemindersState().waterGoalGlasses || 8
  };
}

function getRemainingMacros() {
  return getCoachContext().remaining;
}

function getMealConsistency() {
  const done = state.meals.filter(m => isMealDone(m.id)).length;
  const total = state.meals.length || 1;
  return { done, total, percent: Math.round((done / total) * 100) };
}

function getCoachDailyReport() {
  const ctx = getCoachContext();
  const consistency = getMealConsistency();
  const kcalScore = Math.min(40, Math.round((ctx.consumed.kcal / ctx.totals.kcal) * 40));
  const proteinScore = Math.min(30, Math.round((ctx.consumed.protein / ctx.totals.protein) * 30));
  const mealScore = Math.min(20, Math.round((consistency.done / consistency.total) * 20));
  const waterScore = Math.min(10, Math.round((ctx.water / ctx.waterGoal) * 10));
  const score = Math.min(100, kcalScore + proteinScore + mealScore + waterScore);
  const mainProblem = ctx.missedMeals.length
    ? `missed ${ctx.missedMeals.map(m => cleanMealName(m.name)).join(', ')}`
    : ctx.remaining.protein > 25
      ? 'protein is behind'
      : ctx.remaining.kcal > 700
        ? 'calories are behind'
        : ctx.water < ctx.waterGoal
          ? 'water is behind'
          : 'stay on schedule';
  return {
    score,
    calories: macroStatus(ctx.consumed.kcal, ctx.totals.kcal),
    protein: macroStatus(ctx.consumed.protein, ctx.totals.protein),
    water: ctx.water >= ctx.waterGoal ? 'good' : ctx.water >= Math.ceil(ctx.waterGoal / 2) ? 'decent' : 'poor',
    mainProblem,
    nextAction: getNextMealSuggestion(false),
    context: ctx
  };
}

function macroStatus(value, target) {
  const pct = target ? value / target : 0;
  if (pct >= 0.95) return 'good';
  if (pct >= 0.7) return 'decent';
  return 'low';
}

function cleanMealName(name) {
  return String(name || '').replace(/^[^\w\s]*\s*/, '').trim();
}

function mealTimeToMinutes(meal) {
  const val = String(meal?.timeVal || '').trim();
  let match = val.match(/^(\d{1,2}):(\d{2})$/);
  if (match) return (Number(match[1]) * 60) + Number(match[2]);

  const label = String(meal?.timeLabel || '').trim();
  match = label.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return 24 * 60;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = String(match[3] || '').toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return (hour * 60) + minute;
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getNextPendingMeal() {
  const pending = state.meals.filter(m => !isMealDone(m.id));
  const currentMinutes = getCurrentMinutes();
  const upcomingPendingMeals = pending
    .filter(m => mealTimeToMinutes(m) >= currentMinutes)
    .sort((a, b) => mealTimeToMinutes(a) - mealTimeToMinutes(b));
  const nextMeal = upcomingPendingMeals[0] || null;
  const lastMealMinutes = getLastMealMinutes();
  const lateDay = currentMinutes > lastMealMinutes || currentMinutes >= (21 * 60 + 30);
  console.log('X time context', { currentMinutes, nextMeal, lateDay });
  return nextMeal;
}

function getLastMealMinutes() {
  return Math.max(...state.meals.map(mealTimeToMinutes).filter(Number.isFinite), 0);
}

function isLateDay() {
  const currentMinutes = getCurrentMinutes();
  return currentMinutes > getLastMealMinutes() || currentMinutes >= (21 * 60 + 30);
}

function getFoodCombo(remaining, mode = '') {
  const parts = [];
  if (remaining.protein > 35) parts.push('1 scoop whey', '2 eggs', 'dal');
  else if (remaining.protein > 20) parts.push('2 eggs', 'dal');
  else parts.push('2 eggs');

  if (remaining.kcal > 900) parts.push('2 roti', 'banana + peanut butter shake');
  else if (remaining.kcal > 500) parts.push('2 roti', 'banana shake');
  else parts.push('banana');

  if (mode.includes('eggs and roti')) return '2 eggs + 3 roti. Add curd or milk if available.';
  if (mode.includes('full')) return 'banana + peanut butter shake, then 2 eggs later. Liquid calories first.';
  return [...new Set(parts)].join(' + ');
}

function getNextMealSuggestion(includePrefix = true, mode = '') {
  const ctx = getCoachContext();
  const combo = getFoodCombo(ctx.remaining, mode);
  const nextMeal = getNextPendingMeal();
  const prefix = includePrefix ? `${COACH_NAME}: ` : '';
  if (!nextMeal || isLateDay()) {
    return `${prefix}You're ${ctx.remaining.kcal} kcal and ${ctx.remaining.protein}g protein short. Day is late. Do Bulk Rescue: banana + peanut butter shake + 2 eggs + roti/dal. Tomorrow starts with Breakfast.`;
  }
  const mealLine = ` Next scheduled meal: ${cleanMealName(nextMeal.name)} at ${fmt12(nextMeal.timeVal)}.`;
  return `${prefix}You're ${ctx.remaining.kcal} kcal and ${ctx.remaining.protein}g protein short. Eat ${combo}. No random snacking.${mealLine}`;
}

function getMissedMealRecovery(detail = '') {
  const ctx = getCoachContext();
  const missed = ctx.missedMeals.length
    ? ctx.missedMeals.map(m => cleanMealName(m.name)).join(', ')
    : detail || 'no meal confirmed missed yet';
  if (isLateDay()) {
    return `${COACH_NAME}: Late-day recovery: don't force a full breakfast/lunch now. Take liquid calories first: banana + peanut butter shake. Add 2 eggs if possible. Small dal/rice or 1-2 roti only if hungry. Tomorrow fix the first missed meal.`;
  }
  const combo = getFoodCombo(ctx.remaining, detail.toLowerCase());
  return `${COACH_NAME}: Recovery plan: ${missed}. Add ${combo}. Drink 500ml water now. Log it when done, not later.`;
}

function getEndOfDayReport() {
  const report = getCoachDailyReport();
  const missed = report.context.missedMeals.map(m => cleanMealName(m.name)).join(', ') || 'none';
  const verdict = report.score >= 85 ? 'bulk-worthy' : report.score >= 70 ? 'not bad, but not locked in' : 'not good enough for visible transformation';
  return `${COACH_NAME}: Day result: ${report.score}/100. ${verdict}. Calories: ${report.calories}. Protein: ${report.protein}. Missed meals: ${missed}. Tomorrow's fix: finish the first pending meal on time.`;
}

function getWeeklyCoachReview() {
  const mealIds = state.meals.map(m => m.id);
  const counts = {};
  let done = 0;
  let possible = 0;
  DAYS.forEach((day, idx) => {
    const dateKey = weekDayDateKey(idx);
    mealIds.forEach(id => {
      possible++;
      if (state.checked[`${dateKey}_${id}`]) done++;
      else counts[id] = (counts[id] || 0) + 1;
    });
  });
  const consistency = possible ? Math.round((done / possible) * 100) : 0;
  const worstId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const worstMeal = state.meals.find(m => m.id === worstId);
  return `${COACH_NAME}: Weekly review: ${done}/${possible} meals completed. Consistency: ${consistency}%. Main leak: ${worstMeal ? cleanMealName(worstMeal.name) : 'none yet'}. Weekly fix: make that meal smaller if needed, but zero skipping.`;
}

function getBulkRescuePlan(detail = '') {
  const ctx = getCoachContext();
  if (ctx.remaining.kcal <= 700 && ctx.remaining.protein <= 25) {
    return `${COACH_NAME}: No rescue needed yet. Stay on schedule and finish the next meal.`;
  }
  const full = detail.toLowerCase().includes('full');
  if (isLateDay()) {
    const nightPlan = full
      ? ['Banana + peanut butter shake', '2 eggs only if you can handle it', 'curd or milk before sleep']
      : ['Banana + peanut butter shake', '2 eggs', 'Small dal/rice or 1-2 roti if hungry'];
    return `${COACH_NAME}: Night Rescue:\n1. ${nightPlan[0]}\n2. ${nightPlan[1]}\n3. ${nightPlan[2]}\nMinimum target: reduce the damage, not force 3000 kcal at midnight. Tomorrow starts with Breakfast.`;
  }
  const plan = full
    ? ['banana + peanut butter shake', '2 eggs later', 'curd or milk before sleep']
    : ['2 banana + peanut butter shake', '2 eggs', '1 roti with dal'];
  if (ctx.remaining.protein > 25) plan.push('keep whey to 1 scoop max');
  return `${COACH_NAME}: Bulk Rescue Mode. You're ${ctx.remaining.kcal} kcal and ${ctx.remaining.protein}g protein short. Do this:\n1. ${plan[0]}\n2. ${plan[1]}\n3. ${plan[2]}\nThis is the minimum rescue. Don't sleep under target.`;
}

function getStartupCoachBrief() {
  const ctx = getCoachContext();
  const missedNames = ctx.missedMeals.map(m => cleanMealName(m.name));
  const next = getNextPendingMeal();
  if (isLateDay()) {
    if (ctx.doneMeals.length === 0 && state.meals.length > 0) {
      return `${COACH_NAME}: No pretending - today is a 0/100 so far. Don't eat breakfast now. Do a small night rescue if you can, then restart tomorrow with Breakfast.`;
    }
    if (ctx.remaining.kcal > 500 || ctx.remaining.protein > 20 || missedNames.length) {
      return `${COACH_NAME}: Day is almost over. ${missedNames.length ? `You missed ${missedNames.join(', ')}. ` : ''}You're ${ctx.remaining.kcal} kcal / ${ctx.remaining.protein}g protein short. Do Night Rescue: banana + peanut butter shake, 2 eggs, dal/rice or roti. Tomorrow, breakfast is the first fix.`;
    }
  }
  if (missedNames.length || ctx.remaining.kcal > 500 || ctx.remaining.protein > 20) {
    const combo = getFoodCombo(ctx.remaining);
    return `${COACH_NAME}: ${missedNames.length ? `You missed ${missedNames.join(', ')} and ` : ''}you're ${ctx.remaining.kcal} kcal / ${ctx.remaining.protein}g protein short.${next ? ` Next meal: ${cleanMealName(next.name)} at ${fmt12(next.timeVal)}.` : ''} Fix with ${combo}.`;
  }
  return next
    ? `${COACH_NAME}: Good start. Stay on schedule - next meal is ${cleanMealName(next.name)} at ${fmt12(next.timeVal)}.`
    : `${COACH_NAME}: Good work. All meals are checked. Keep water on target.`;
}

function showStartupCoachBrief() {
  if (startupCoachBriefShown || sessionStorage.getItem('xStartupBriefDismissed') === '1') return;
  startupCoachBriefShown = true;
  const existing = document.getElementById('coachStartupBrief');
  if (existing) existing.remove();
  const brief = document.createElement('div');
  brief.id = 'coachStartupBrief';
  brief.className = 'coach-startup-brief';
  brief.innerHTML = `
    <div class="coach-brief-title">X Check-in</div>
    <div class="coach-brief-message">${escapeCoachHtml(getStartupCoachBrief())}</div>
    <div class="coach-brief-actions">
      <button onclick="openCoachFromBrief()">Open X</button>
      <button onclick="dismissStartupCoachBrief()">Dismiss</button>
    </div>
  `;
  document.body.appendChild(brief);

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification('X Check-in', { body: getStartupCoachBrief() }); } catch(e) {}
  }
}

function dismissStartupCoachBrief() {
  sessionStorage.setItem('xStartupBriefDismissed', '1');
  const brief = document.getElementById('coachStartupBrief');
  if (brief) brief.remove();
}

function openCoachFromBrief() {
  dismissStartupCoachBrief();
  openAI();
}

function escapeCoachHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function getFoodScanCoachNote(meal) {
  const name = String(meal?.name || '').toLowerCase();
  const kcal = Number(meal?.kcal) || 0;
  const protein = Number(meal?.protein) || 0;
  if (name.includes('burger') || name.includes('fries') || kcal >= 700 && protein < 30) {
    return `${COACH_NAME}: Good for calories, weak for protein. Add 2 eggs later or the protein target suffers.`;
  }
  if (protein >= 25) return `${COACH_NAME}: Good. This actually helps the bulk.`;
  if (kcal < 250) return `${COACH_NAME}: Too small. This won't move your weight.`;
  return `${COACH_NAME}: Logged. Now balance the rest of the day around protein.`;
}

function handleCoachQuickAction(action, detail = '') {
  console.log('X quick action:', action);
  const map = {
    eat_now: () => getNextMealSuggestion(true, detail),
    judge_day: () => getEndOfDayReport(),
    recover_missed: () => getMissedMealRecovery(detail),
    weekly_review: () => getWeeklyCoachReview(),
    bulk_rescue: () => getBulkRescuePlan(detail)
  };
  const text = map[action] ? map[action]() : getNextMealSuggestion(true, detail);
  addCoachMessage(text);
  return text;
}

function getLocalCoachResponse(text) {
  const t = text.toLowerCase();
  if (t.includes('what should i eat now')) return getNextMealSuggestion();
  if (t.includes('judge my day')) return getEndOfDayReport();
  if (t.includes('weekly review')) return getWeeklyCoachReview();
  if (t.includes('recover') || t.includes('i missed')) return getMissedMealRecovery(text);
  if (t.includes('feel full')) return getBulkRescuePlan('full');
  if (t.includes('only have eggs and roti')) return getNextMealSuggestion(true, 'eggs and roti');
  if (t.includes('plan my remaining day')) return `${getNextMealSuggestion()}\n${getMissedMealRecovery(text)}`;
  if (t.includes('before gym')) return `${COACH_NAME}: Before gym at ${coachProfile.gymTime}: banana + peanut butter or oats, then water. Keep it digestible.`;
  if (t.includes('after gym')) return `${COACH_NAME}: After gym: whey if unused, then dal/rice or eggs/roti. Protein first, calories second.`;
  if (t.includes('protein left')) return `${COACH_NAME}: ${getRemainingMacros().protein}g protein left. Hit it with eggs, dal, curd, or one whey scoop.`;
  if (t.includes('calories left')) return `${COACH_NAME}: ${getRemainingMacros().kcal} kcal left. Use banana, peanut butter, roti, rice, milk. No empty excuses.`;
  if (t.includes('bulk rescue')) return getBulkRescuePlan(text);
  return null;
}

function getAppContext() {
  const ctx = getCoachContext();
  return `You are X, a strict but helpful bulking coach inside a diet tracker.

COACH MEMORY:
- User: ${coachProfile.name}
- Goal: ${coachProfile.goal}
- Targets: ${ctx.totals.kcal} kcal, ${ctx.totals.protein}g protein, ${ctx.totals.carbs}g carbs, ${ctx.totals.fat}g fat
- Diet style: ${coachProfile.dietStyle}
- Gym time: ${coachProfile.gymTime}
- Preferred foods: ${coachProfile.preferredFoods.join(', ')}
- Avoid daily: ${coachProfile.avoidDaily.join(', ')}
- Whey limit: ${coachProfile.wheyLimit}

CURRENT APP STATE:
- Today: ${new Date().toLocaleDateString('en-IN', {weekday:'long', day:'numeric', month:'long'})}
- Meals completed: ${ctx.doneMeals.length}/${state.meals.length}
- Calories consumed: ${ctx.consumed.kcal} / ${ctx.totals.kcal} kcal
- Protein consumed: ${ctx.consumed.protein}g / ${ctx.totals.protein}g
- Water: ${ctx.water}/${ctx.waterGoal} glasses
- Current weight: ${getCurrentWeight()} kg
- Goal weight: ${getGoalWeight()} kg
- Streak: ${getCurrentStreak()} days
- Missed meals: ${ctx.missedMeals.map(m => cleanMealName(m.name)).join(', ') || 'none'}

MEAL PLAN:
${state.meals.map(m => `- ${m.name} (${m.timeLabel}): ${m.kcal} kcal, ${m.protein}g protein | ${isMealDone(m.id) ? 'DONE' : 'pending'}`).join('\n')}

EXTRA MEALS TODAY:
${ctx.extras.length ? ctx.extras.map(e=>`- ${e.name}: ${e.kcal} kcal, ${e.protein || 0}g protein`).join('\n') : 'None'}

STYLE:
- Call yourself X only.
- Strict, direct, useful.
- Give exact next actions.
- Never use any previous coach name.
- Keep replies under 80 words unless asked for detail.`;
}

async function sendAI() {
  const input = document.getElementById('aiInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  addAIMsg('user', text);
  aiHistory.push({ role: 'user', content: text });

  const local = getLocalCoachResponse(text);
  if (local) {
    addCoachMessage(local);
    return;
  }

  const thinking = addAIMsg('thinking', 'Thinking...');

  try {
    const res = await fetch('https://blue-poetry-b2ac.vinayaknehwal98.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openrouter/free',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: getAppContext() },
          ...aiHistory
        ]
      })
    });

    const data = await res.json();
    const raw = data.content?.find(b => b.type === 'text')?.text || 'I could not respond. Use the quick buttons and execute the plan.';

    thinking.remove();
    const actionMatch = raw.match(/```(?:action|json)\s*([\s\S]*?)```/);
    const displayText = raw.replace(/```(?:action|json)[\s\S]*?```/g, '').trim();

    if (actionMatch) {
      try { executeAIAction(JSON.parse(actionMatch[1].trim())); } catch(e) {}
    }

    addCoachMessage(displayText || 'Action done. Stay locked in.');
  } catch(err) {
    thinking.remove();
    addCoachMessage('Worker failed. Local coach still works: hit calories, hit protein, drink water, complete the next meal.');
  }
}

function executeAIAction(actionData) {
  const { action, params = {} } = actionData;

  switch(action) {
    case 'check_meal':
      state.checked[`${todayKey()}_${params.mealId}`] = true;
      saveState(); renderAll();
      break;
    case 'uncheck_meal':
      delete state.checked[`${todayKey()}_${params.mealId}`];
      saveState(); renderAll();
      break;
    case 'check_all':
      state.meals.forEach(m => { state.checked[`${todayKey()}_${m.id}`] = true; });
      saveState(); renderAll();
      break;
    case 'uncheck_all':
      state.meals.forEach(m => { delete state.checked[`${todayKey()}_${m.id}`]; });
      saveState(); renderAll();
      break;
    case 'log_water':
      localStorage.setItem(todayWaterKey(), Math.min(12, Math.max(0, params.glasses)));
      updateWaterUI();
      break;
    case 'add_weight': {
      const todayDate = new Date().toISOString().split('T')[0];
      const idx = state.weightHistory.findIndex(w => w.date === todayDate);
      if (idx >= 0) state.weightHistory[idx].weight = params.weight;
      else state.weightHistory.push({ date: todayDate, weight: params.weight });
      saveState(); renderAll();
      break;
    }
    case 'log_extra':
      if (!state.extraMeals) state.extraMeals = [];
      state.extraMeals.push({
        id: 'extra_' + Date.now(),
        date: todayKey(),
        name: params.name,
        emoji: params.emoji || '???',
        kcal: params.kcal || 0,
        protein: params.protein || 0,
        carbs: params.carbs || 0,
        fat: params.fat || 0,
        time: new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}),
        swappedFor: null
      });
      saveState(); renderAll();
      break;
    case 'edit_meal': {
      const meal = state.meals.find(m => m.id === params.mealId);
      if (meal) {
        if (params.kcal) meal.kcal = params.kcal;
        if (params.protein) meal.protein = params.protein;
        if (params.carbs) meal.carbs = params.carbs;
        if (params.fat) meal.fat = params.fat;
        saveState(); renderAll();
      }
      break;
    }
    case 'reset_day':
      resetDay();
      break;
    case 'show_tab': {
      const tabBtns = document.querySelectorAll('.tab');
      const tabs = ['today','week','reminders','export'];
      const tabIdx = tabs.indexOf(params.tab);
      if (tabIdx >= 0) switchTab(params.tab, tabBtns[tabIdx]);
      break;
    }
  }
}
