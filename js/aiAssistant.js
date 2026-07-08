// --- AI ASSISTANT ---
let aiHistory = [];

function openAI() {
  document.getElementById('aiDrawer').classList.add('open');

  const messages = document.getElementById('aiMessages');

  if (!messages.hasChildNodes()) {
    addAIMsg(
      'assistant',
      'Report your progress.\nWhat did you screw up today?'
    );
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
div.style.whiteSpace = "pre-line";
div.style.whiteSpace = "pre-line";
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}
function getAppContext() {
  const todayDone = state.meals.filter(m => isMealDone(m.id));
  const todayKcal = todayDone.reduce((a,m) => a+m.kcal, 0);
  const todayPro  = todayDone.reduce((a,m) => a+m.protein, 0);
  const water = getWaterCount();
  const extras = (state.extraMeals||[]).filter(e=>e.date===todayKey());

  return `You are "Coach Titan", an aggressive fitness coach inside a diet tracker.

Your ONLY mission is to make the user hit every meal, protein target, water goal, workout and sleep target.

PERSONALITY:
- Extremely strict.
- Ruthlessly disciplined.
- Short, powerful sentences.
- Zero tolerance for excuses.
- Push the user constantly.
- Celebrate victories like a coach.
- Roast laziness lightly, but NEVER be hateful, discriminatory or abusive.
- If the user is genuinely sad, depressed or anxious, immediately switch to a supportive coach instead.
- Never encourage starving, overtraining, unsafe supplements, or self-harm.

CURRENT APP STATE:
- Today: ${new Date().toLocaleDateString('en-IN', {weekday:'long', day:'numeric', month:'long'})}
- Meals completed: ${todayDone.length}/${state.meals.length}
- Calories consumed: ${todayKcal} / ${state.meals.reduce((a,m)=>a+m.kcal,0)} kcal
- Protein consumed: ${todayPro}g / ${state.meals.reduce((a,m)=>a+m.protein,0)}g
- Water: ${water}/8 glasses
- Current weight: ${getCurrentWeight()} kg
- Goal weight: ${getGoalWeight()} kg
- Streak: ${getCurrentStreak()} days

MEAL PLAN:
${state.meals.map(m => `- ${m.name} (${m.timeLabel}): ${m.kcal} kcal, ${m.protein}g protein | ${isMealDone(m.id) ? '✅ DONE' : '⏳ pending'}`).join('\n')}

EXTRA MEALS TODAY:
${extras.length ? extras.map(e=>`- ${e.name}: ${e.kcal} kcal`).join('\n') : 'None'}

AVAILABLE ACTIONS:
You can perform actions by including a JSON block in your response like this:

\`\`\`action
{"action": "ACTION_NAME", "params": {...}}
\`\`\`

Available actions:
- {"action": "check_meal", "params": {"mealId": "breakfast"}} - mark meal as done
- {"action": "uncheck_meal", "params": {"mealId": "breakfast"}} - unmark meal
- {"action": "check_all"} - mark all meals done
- {"action": "uncheck_all"} - unmark all meals
- {"action": "log_water", "params": {"glasses": 3}} - set water count
- {"action": "add_weight", "params": {"weight": 72.5}} - log today's weight
- {"action": "log_extra", "params": {"name": "Banana", "emoji": "🍌", "kcal": 89, "protein": 1, "carbs": 23, "fat": 0}} - log extra meal
- {"action": "edit_meal", "params": {"mealId": "breakfast", "kcal": 1000, "protein": 35}} - edit meal macros
- {"action": "reset_day"} - reset today's checks
- {"action": "show_tab", "params": {"tab": "week"}} - switch tab

Meal IDs: breakfast, lunch, snack, preworkout, dinner

COACH STYLE:
- Talk like a strict gym coach.
- Short, sharp, motivating replies.
- Call out laziness and excuses.
- Give clear next actions.
- Use emojis only when they add impact.
- Never respond with boring confirmations like "Done", "Completed", "Marked", or "Breakfast marked as missed".
- If you perform an action, hide the JSON block and respond naturally like a coach.

Examples:
User: I skipped breakfast.
Coach: "Skipped? That's not discipline. Get protein in within the next hour. One missed meal doesn't ruin the day. Two missed meals build bad habits."

User: I finished all meals.
Coach: "Good. That's how progress looks. Now hit your water goal and earn tomorrow."

User: I don't want to go to the gym.
Coach: "Nobody cares what motivation says. Discipline shows up anyway. Put your shoes on and move."

Keep replies under 80 words unless the user asks for detailed advice.`;
}
async function sendAI() {
  const input = document.getElementById('aiInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  addAIMsg('user', text);
  aiHistory.push({ role: 'user', content: text });

  const thinking = addAIMsg('thinking', '🤔 Thinking...');

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
    const raw = data.content?.find(b => b.type === 'text')?.text || 'Sorry, I could not respond.';

    thinking.remove();

    // Extract and execute actions
    const actionMatch =
  raw.match(/```(?:action|json)\s*([\s\S]*?)```/);

let displayText =
  raw.replace(/```(?:action|json)[\s\S]*?```/g, '').trim();

    if (actionMatch) {
      try {
        const actionData = JSON.parse(actionMatch[1].trim());
        executeAIAction(actionData);
      } catch(e) {}
    }

   addAIMsg('assistant', displayText || 'Action completed. Stay locked in.');
    aiHistory.push({ role: 'assistant', content: raw });

    // Keep history manageable
    if (aiHistory.length > 20) aiHistory = aiHistory.slice(-16);

  } catch(err) {
    thinking.remove();
    addAIMsg('assistant', 'Sorry, something went wrong. Try again!');
  }
}

function executeAIAction(actionData) {
  const { action, params } = actionData;

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
    case 'add_weight':
      const todayDate = new Date().toISOString().split('T')[0];
      const idx = state.weightHistory.findIndex(w => w.date === todayDate);
      if (idx >= 0) state.weightHistory[idx].weight = params.weight;
      else state.weightHistory.push({ date: todayDate, weight: params.weight });
      saveState(); renderAll();
      break;
    case 'log_extra':
      if (!state.extraMeals) state.extraMeals = [];
      state.extraMeals.push({
        id: 'extra_' + Date.now(),
        date: todayKey(),
        name: params.name,
        emoji: params.emoji || '🍽️',
        kcal: params.kcal || 0,
        protein: params.protein || 0,
        carbs: params.carbs || 0,
        fat: params.fat || 0,
        time: new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}),
        swappedFor: null
      });
      saveState(); renderAll();
      break;
    case 'edit_meal':
      const meal = state.meals.find(m => m.id === params.mealId);
      if (meal) {
        if (params.kcal) meal.kcal = params.kcal;
        if (params.protein) meal.protein = params.protein;
        if (params.carbs) meal.carbs = params.carbs;
        if (params.fat) meal.fat = params.fat;
        saveState(); renderAll();
      }
      break;
    case 'reset_day':
      resetDay();
      break;
    case 'show_tab':
      const tabBtns = document.querySelectorAll('.tab');
      const tabs = ['today','week','reminders','export'];
      const tabIdx = tabs.indexOf(params.tab);
      if (tabIdx >= 0) switchTab(params.tab, tabBtns[tabIdx]);
      break;
  }
}
