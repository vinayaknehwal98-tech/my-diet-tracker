// --- AI FOOD SCAN V2 / SNAP MEAL LOGGING ---
// All AI estimates are normalized, shown as an editable preview, and only saved after explicit confirmation.
const AI_FOOD_SCAN_WORKER_URL = 'https://blue-poetry-b2ac.vinayaknehwal98.workers.dev';
let snapContext = { mealId: null, mealName: null };
let snapIdentified = null;
let snapDescDebounce = null;
let snapImageData = null;

function triggerSnapInput(type) {
  const id = type === 'camera' ? 'snapFileInputCamera' : 'snapFileInputGallery';
  const input = document.getElementById(id);
  if (input) input.click();
}

function openSnapModal(mealId, mealName) {
  snapContext = { mealId: mealId || null, mealName: mealName || null };
  snapIdentified = null;
  snapImageData = null;
  clearTimeout(snapDescDebounce);

  document.getElementById('snapFileInputCamera').value = '';
  document.getElementById('snapFileInputGallery').value = '';
  document.getElementById('snapDescArea').value = '';
  document.getElementById('snapDescArea').placeholder = 'Or describe what you ate...';
  document.getElementById('snapPreviewImg').removeAttribute('src');
  document.getElementById('snapPreviewImg').style.display = 'none';
  document.getElementById('snapDropZone').style.display = 'block';
  document.getElementById('snapResult').style.display = 'none';
  document.getElementById('snapActions').style.display = 'none';
  document.getElementById('snapDropIcon').textContent = '\uD83D\uDCF7';
  document.getElementById('snapDropTitle').textContent = 'How do you want to add the photo?';
  document.getElementById('snapActionButtons').innerHTML = '';
  setSnapStatus('', '');

  const title = mealId ? 'Swapped: ' + (mealName || mealId) : '\uD83D\uDCF8 I Ate This';
  const sub = mealId
    ? 'Scan or describe what you ate instead. Review the estimate before saving.'
    : 'Scan or describe an extra meal. Review the estimate before saving.';
  document.getElementById('snapModalTitle').textContent = title;
  document.getElementById('snapModalSub').textContent = sub;
  document.getElementById('snapModal').classList.add('open');
}

function closeSnapModal() {
  document.getElementById('snapModal').classList.remove('open');
  snapIdentified = null;
  snapImageData = null;
  clearTimeout(snapDescDebounce);
}

document.getElementById('snapModal').addEventListener('click', function(e) {
  if (e.target === this) closeSnapModal();
});

async function handleSnapFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const img = document.getElementById('snapPreviewImg');
  img.src = URL.createObjectURL(file);
  img.style.display = 'block';
  document.getElementById('snapDropZone').style.display = 'none';
  document.getElementById('snapDescArea').placeholder = 'Add any extra details (optional)...';
  document.getElementById('snapResult').style.display = 'none';
  document.getElementById('snapActions').style.display = 'none';
  setSnapStatus('loading', 'Analyzing food...');

  try {
    snapImageData = await compressSnapImage(file);
    console.log('AI Food Scan compressed image:', {
      mime: snapImageData.mime,
      width: snapImageData.width,
      height: snapImageData.height,
      approxBytes: Math.round((snapImageData.b64.length * 3) / 4)
    });
    await estimateSnapMeal();
  } catch (err) {
    console.error('AI Food Scan image compression failed:', err);
    snapImageData = null;
    setSnapStatus('error', 'Could not read this image. Try another photo or describe the meal.');
  }
}

function compressSnapImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not load image file'));
      image.onload = () => {
        const maxSize = 768;
        const scale = Math.min(1, maxSize / image.width, maxSize / image.height);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not prepare image canvas'));
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        resolve({
          b64: dataUrl.split(',')[1] || '',
          mime: 'image/jpeg',
          width,
          height
        });
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function onSnapDescInput(el) {
  clearTimeout(snapDescDebounce);
  const val = el.value.trim();
  if (!val && !snapImageData) return;
  document.getElementById('snapResult').style.display = 'none';
  document.getElementById('snapActions').style.display = 'none';
  snapDescDebounce = setTimeout(() => estimateSnapMeal(), snapImageData ? 1100 : 750);
}

function setSnapStatus(type, msg) {
  const el = document.getElementById('snapStatus');
  el.className = 'import-status' + (type ? ' visible ' + type : '');
  el.textContent = msg;
}

async function estimateSnapMeal() {
  const desc = document.getElementById('snapDescArea').value.trim();
  if (!desc && !snapImageData) {
    setSnapStatus('error', 'Add a photo or type what you ate first.');
    return null;
  }

  setSnapStatus('loading', snapImageData ? 'Analyzing food photo...' : 'Estimating macros...');

  try {
    const result = await estimateSnapMealWithWorker(desc, snapImageData);
    renderSnapResult(result);
    setSnapStatus('success', 'Review the estimate before saving.');
    return result;
  } catch (err) {
    console.error('AI Food Scan estimate failed:', err);
    if (snapImageData) {
      if (desc) {
        const fallback = estimateSnapMealLocally(desc);
        if (fallback.kcal > 20) {
          fallback.needsReview = true;
          renderSnapResult(fallback);
          setSnapStatus('success', 'Used text fallback because photo scan failed. Review before saving.');
          return fallback;
        }
      }

      document.getElementById('snapResult').style.display = 'none';
      document.getElementById('snapActions').style.display = 'none';
      setSnapStatus('error', "Photo scan failed. Add a short description like 'burger + fries' and try again.");
      return null;
    }

    const fallback = estimateSnapMealLocally(desc);
    if (isSnapInvalidEstimate(fallback) && hasSnapFoodText(desc)) {
      document.getElementById('snapResult').style.display = 'none';
      document.getElementById('snapActions').style.display = 'none';
      setSnapStatus('error', "AI could not estimate this food. Try a clearer description like 'burger + fries'.");
      return null;
    }

    fallback.needsReview = true;
    renderSnapResult(fallback);
    setSnapStatus('error', 'AI scan used local fallback. Please review before saving.');
    return fallback;
  }
}

async function estimateSnapMealWithWorker(desc, imageData) {
  const runWorkerEstimate = async (retry) => {
    const prompt = imageData
      ? `You are AI Food Scan v2 for a diet tracker.
Identify the food(s) visible in this real food image${desc ? ` using this user note as extra context: "${desc}"` : ''}.
Estimate approximate calories, protein, carbs, and fat using realistic restaurant / household portions.
Do not return zeros unless there is clearly no food visible.
${retry ? 'This is a real food image. You must estimate approximate calories and macros. Do not return zeros unless the image has no food.' : ''}

If the image looks like burger + fries, estimate approximately:
- burger: 450 kcal, 22g protein, 40g carbs, 22g fat
- fries: 350 kcal, 5g protein, 45g carbs, 18g fat

Return ONLY valid JSON in this exact shape:
{
  "name": "Burger with fries",
  "emoji": "🍽️",
  "kcal": 800,
  "protein": 27,
  "carbs": 85,
  "fat": 40,
  "items": [
    { "name": "Burger", "qty": "1 burger", "cal": 450, "pro": 22 },
    { "name": "Fries", "qty": "1 serving", "cal": 350, "pro": 5 }
  ],
  "confidence": "medium",
  "needsReview": true
}
Use the numbers above only as format examples unless the food is actually burger + fries.`
      : `You are AI Food Scan v2 for a diet tracker.
Estimate the meal from the text${desc ? `: "${desc}"` : ''}.
Return ONLY valid JSON in this exact shape:
{
  "name": "Paneer rice bowl",
  "emoji": "single food emoji",
  "kcal": 650,
  "protein": 25,
  "carbs": 75,
  "fat": 28,
  "items": [
    { "name": "Paneer curry", "qty": "1 cup", "cal": 320, "pro": 18 },
    { "name": "Rice", "qty": "1.5 cups cooked", "cal": 330, "pro": 7 }
  ],
  "confidence": "low|medium|high",
  "needsReview": true
}
Use the numbers above only as format examples, not as the answer. Estimate realistic Indian household portions when exact quantity is unclear. Set needsReview true for uncertain estimates.`;

  const content = imageData
    ? [
        { type: 'image', source: { type: 'base64', media_type: imageData.mime, data: imageData.b64 } },
        { type: 'text', text: prompt }
      ]
    : prompt;

  const model = imageData ? 'google/gemma-3-27b-it:free' : 'llama-3.1-8b-instant';
  console.log('AI Food Scan model used:', model);
  console.log('AI Food Scan imageData exists:', !!imageData);

  const res = await fetch(AI_FOOD_SCAN_WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: imageData ? 1200 : 450,
      messages: [{ role: 'user', content }]
    })
  });

  console.log('AI Food Scan response status:', res.status);
  if (!res.ok) throw new Error('Worker ' + res.status);
  const data = await res.json();
  const raw = extractSnapWorkerText(data);
  let parsed;
  try {
    parsed = parseSnapJson(raw);
  } catch (parseErr) {
    console.log('AI Food Scan raw Worker response:', raw);
    throw parseErr;
  }
  const result = normalizeSnapMeal(parsed, desc);
  if (!imageData && isSnapInvalidEstimate(result) && hasSnapFoodText(desc)) {
    const fallback = estimateSnapMealLocally(desc);
    if (!isSnapInvalidEstimate(fallback)) return fallback;
  }
  validateSnapMealEstimate(result, imageData, desc);
  return result;
  };

  try {
    return await runWorkerEstimate(false);
  } catch (err) {
    if (!imageData) throw err;
    return await runWorkerEstimate(true);
  }
}

function extractSnapWorkerText(data) {
  if (typeof data === 'string') return data;
  if (typeof data?.response === 'string') return data.response;
  if (typeof data?.text === 'string') return data.text;
  if (typeof data?.content === 'string') return data.content;
  if (Array.isArray(data?.content)) {
    return data.content.map(b => typeof b === 'string' ? b : (b.text || '')).join('\n');
  }
  if (Array.isArray(data?.choices)) {
    return data.choices.map(c => c.message?.content || c.text || '').join('\n');
  }
  return JSON.stringify(data || {});
}

function parseSnapJson(raw) {
  const cleaned = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON estimate');
  return JSON.parse(match[0]);
}

function normalizeSnapMeal(input, desc) {
  const source = input && typeof input === 'object' ? input : {};
  const itemSource = Array.isArray(source.items) ? source.items : [];
  const items = itemSource.map(item => ({
    name: String(item.name || item.food || 'Food').trim() || 'Food',
    qty: String(item.qty || item.quantity || item.amount || '1 serving').trim() || '1 serving',
    cal: snapNumber(item.cal ?? item.kcal ?? item.calories, 0),
    pro: snapNumber(item.pro ?? item.protein, 0)
  }));

  if (!items.length && (source.description || desc)) {
    items.push({
      name: String(source.description || desc).slice(0, 80),
      qty: 'estimated serving',
      cal: snapNumber(source.kcal ?? source.calories, 0),
      pro: snapNumber(source.protein ?? source.pro ?? source.proteins, 0)
    });
  }

  const confidence = ['low', 'medium', 'high'].includes(String(source.confidence).toLowerCase())
    ? String(source.confidence).toLowerCase()
    : 'medium';

  return {
    name: String(source.name || source.title || 'Estimated meal').trim() || 'Estimated meal',
    emoji: String(source.emoji || '\uD83C\uDF7D\uFE0F').trim() || '\uD83C\uDF7D\uFE0F',
    kcal: snapNumber(source.kcal ?? source.calories, items.reduce((a, i) => a + i.cal, 0)),
    protein: snapNumber(source.protein ?? source.pro ?? source.proteins, items.reduce((a, i) => a + i.pro, 0)),
    carbs: snapNumber(source.carbs ?? source.carbohydrates, 0),
    fat: snapNumber(source.fat ?? source.fats, 0),
    items,
    confidence,
    needsReview: source.needsReview !== false
  };
}

function validateSnapMealEstimate(result, imageData, desc) {
  if (!imageData && !hasSnapFoodText(desc)) return;
  if (isSnapInvalidEstimate(result)) {
    throw new Error('Invalid zero estimate');
  }
}

function isSnapInvalidEstimate(result) {
  const items = Array.isArray(result?.items) ? result.items : [];
  return snapNumber(result?.kcal, 0) <= 20 || !items.length || items.every(item => snapNumber(item.cal, 0) <= 0);
}

function hasSnapFoodText(desc) {
  return /[a-zA-Z]/.test(String(desc || ''));
}

function snapNumber(value, fallback) {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function estimateSnapMealLocally(desc) {
  const text = String(desc || '').toLowerCase();
  const foods = [
    { keys: ['banana'], name: 'Banana', emoji: '\uD83C\uDF4C', qty: '1 medium', cal: 105, pro: 1, carbs: 27, fat: 0 },
    { keys: ['egg', 'anda'], name: 'Egg', emoji: '\uD83E\uDD5A', qty: '1 large', cal: 78, pro: 6, carbs: 1, fat: 5 },
    { keys: ['roti', 'chapati', 'phulka'], name: 'Roti', emoji: '\uD83E\uDED3', qty: '1 medium', cal: 120, pro: 4, carbs: 22, fat: 3 },
    { keys: ['rice', 'chawal'], name: 'Rice', emoji: '\uD83C\uDF5A', qty: '1 cup cooked', cal: 205, pro: 4, carbs: 45, fat: 0 },
    { keys: ['dal', 'daal'], name: 'Dal', emoji: '\uD83E\uDD63', qty: '1 cup', cal: 180, pro: 12, carbs: 28, fat: 4 },
    { keys: ['oats', 'oatmeal'], name: 'Oats', emoji: '\uD83E\uDD63', qty: '40 g', cal: 150, pro: 5, carbs: 27, fat: 3 },
    { keys: ['peanut butter', 'pb'], name: 'Peanut butter', emoji: '\uD83E\uDD5C', qty: '1 tbsp', cal: 95, pro: 4, carbs: 3, fat: 8 },
    { keys: ['whey', 'protein powder'], name: 'Whey protein', emoji: '\uD83E\uDD64', qty: '1 scoop', cal: 120, pro: 24, carbs: 3, fat: 2 },
    { keys: ['milk', 'doodh'], name: 'Milk', emoji: '\uD83E\uDD5B', qty: '250 ml', cal: 150, pro: 8, carbs: 12, fat: 8 },
    { keys: ['curd', 'yogurt', 'dahi'], name: 'Curd', emoji: '\uD83E\uDD63', qty: '1 cup', cal: 100, pro: 6, carbs: 8, fat: 5 },
    { keys: ['almond', 'badam'], name: 'Almonds', emoji: '\uD83C\uDF30', qty: '10 pieces', cal: 70, pro: 3, carbs: 3, fat: 6 },
    { keys: ['walnut', 'akhrot'], name: 'Walnuts', emoji: '\uD83C\uDF30', qty: '4 halves', cal: 90, pro: 2, carbs: 2, fat: 9 },
    { keys: ['burger', 'cheeseburger', 'hamburger'], name: 'Burger', emoji: '\uD83C\uDF54', qty: '1 burger', cal: 450, pro: 22, carbs: 40, fat: 22 },
    { keys: ['fries', 'french fries', 'chips'], name: 'Fries', emoji: '\uD83C\uDF5F', qty: '1 serving', cal: 350, pro: 5, carbs: 45, fat: 18 }
  ];

  const items = [];
  foods.forEach(food => {
    if (!food.keys.some(k => text.includes(k))) return;
    const count = detectSnapFoodCount(text, food.keys) || 1;
    items.push({
      name: food.name,
      qty: count > 1 ? `${count} x ${food.qty}` : food.qty,
      cal: food.cal * count,
      pro: food.pro * count,
      carbs: food.carbs * count,
      fat: food.fat * count,
      emoji: food.emoji
    });
  });

  if (!items.length) {
    return normalizeSnapMeal({
      name: desc || 'Food photo',
      emoji: '\uD83C\uDF7D\uFE0F',
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      items: [{ name: desc || 'Food', qty: 'needs review', cal: 0, pro: 0 }],
      confidence: 'low',
      needsReview: true
    }, desc);
  }

  return normalizeSnapMeal({
    name: items.length === 1 ? items[0].name : 'Estimated meal',
    emoji: items[0].emoji || '\uD83C\uDF7D\uFE0F',
    kcal: items.reduce((a, i) => a + i.cal, 0),
    protein: items.reduce((a, i) => a + i.pro, 0),
    carbs: items.reduce((a, i) => a + i.carbs, 0),
    fat: items.reduce((a, i) => a + i.fat, 0),
    items,
    confidence: 'low',
    needsReview: true
  }, desc);
}

function detectSnapFoodCount(text, keys) {
  for (const key of keys) {
    const re = new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:x\\s*)?(?:' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?)');
    const match = text.match(re);
    if (match) return Math.max(1, Math.round(Number(match[1])));
  }
  return null;
}

function renderSnapResult(result) {
  snapIdentified = normalizeSnapMeal(result, document.getElementById('snapDescArea').value.trim());
  const container = document.getElementById('snapResult');
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:60px 1fr 82px;gap:8px;margin-bottom:10px;">
      <input id="snapEditEmoji" value="${escapeSnapAttr(snapIdentified.emoji)}" aria-label="Emoji" style="width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px;font-family:var(--font);font-size:18px;text-align:center;">
      <input id="snapEditName" value="${escapeSnapAttr(snapIdentified.name)}" aria-label="Meal name" style="min-width:0;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px;font-family:var(--font);font-weight:700;">
      <input id="snapEditKcal" type="number" min="0" value="${snapIdentified.kcal}" aria-label="Calories" style="width:100%;background:var(--bg);color:var(--accent);border:1px solid var(--border);border-radius:8px;padding:8px;font-family:var(--font);font-weight:800;text-align:right;">
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px;">
      <label style="font-size:11px;color:var(--muted);">Protein<input id="snapEditProtein" type="number" min="0" value="${snapIdentified.protein}" style="width:100%;margin-top:4px;background:var(--bg);color:var(--accent2);border:1px solid var(--border);border-radius:8px;padding:8px;font-family:var(--font);"></label>
      <label style="font-size:11px;color:var(--muted);">Carbs<input id="snapEditCarbs" type="number" min="0" value="${snapIdentified.carbs}" style="width:100%;margin-top:4px;background:var(--bg);color:var(--yellow);border:1px solid var(--border);border-radius:8px;padding:8px;font-family:var(--font);"></label>
      <label style="font-size:11px;color:var(--muted);">Fat<input id="snapEditFat" type="number" min="0" value="${snapIdentified.fat}" style="width:100%;margin-top:4px;background:var(--bg);color:var(--green);border:1px solid var(--border);border-radius:8px;padding:8px;font-family:var(--font);"></label>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">Confidence: ${snapIdentified.confidence} ${snapIdentified.needsReview ? '· review needed' : ''}</div>
    <table class="food-table" style="margin-top:4px;">
      <thead><tr><th>Food</th><th>Qty</th><th>Cal</th><th>Pro</th></tr></thead>
      <tbody>
        ${snapIdentified.items.map(item => `
          <tr>
            <td>${escapeSnapHtml(item.name)}</td>
            <td>${escapeSnapHtml(item.qty)}</td>
            <td>${item.cal}</td>
            <td>${item.pro}g</td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;
  container.style.display = 'block';
  renderSnapActionButtons();
}

function renderSnapActionButtons() {
  const btns = document.getElementById('snapActionButtons');
  btns.innerHTML = '';

  state.meals.forEach(m => {
    const mealLabel = m.name.replace(/^[^\w\s]*\s*/, '');
    const btn = document.createElement('button');
    btn.className = 'snap-action-btn' + (m.id === snapContext.mealId ? ' primary' : '');
    btn.innerHTML = `${m.emoji} Swapped my <b>${escapeSnapHtml(mealLabel)}</b> with this`;
    btn.onclick = () => logSnapAsSwap(m.id);
    btns.appendChild(btn);
  });

  const extraBtn = document.createElement('button');
  extraBtn.className = 'snap-action-btn primary';
  extraBtn.innerHTML = '<b>+ Add as extra meal</b> (outside my plan)';
  extraBtn.onclick = () => logSnapAsExtra();
  btns.appendChild(extraBtn);
  document.getElementById('snapActions').style.display = 'block';
}

function readSnapPreviewEdits() {
  if (!snapIdentified) return null;
  return normalizeSnapMeal({
    ...snapIdentified,
    name: document.getElementById('snapEditName')?.value || snapIdentified.name,
    emoji: document.getElementById('snapEditEmoji')?.value || snapIdentified.emoji,
    kcal: document.getElementById('snapEditKcal')?.value ?? snapIdentified.kcal,
    protein: document.getElementById('snapEditProtein')?.value ?? snapIdentified.protein,
    carbs: document.getElementById('snapEditCarbs')?.value ?? snapIdentified.carbs,
    fat: document.getElementById('snapEditFat')?.value ?? snapIdentified.fat
  }, document.getElementById('snapDescArea').value.trim());
}

function logSnapAsExtra() {
  logSnapEntryFromPreview(null);
}

function logSnapAsSwap(mealId) {
  logSnapEntryFromPreview(mealId);
}

function logSnapEntryFromPreview(swapMealId) {
  const food = readSnapPreviewEdits();
  if (!food) {
    setSnapStatus('error', 'Estimate the meal before saving.');
    return;
  }

  const swapMeal = swapMealId ? state.meals.find(m => m.id === swapMealId) : null;
  const swapMealName = swapMeal ? swapMeal.name.replace(/^[^\w\s]*\s*/, '') : null;
  if (!state.extraMeals) state.extraMeals = [];

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  state.extraMeals.push({
    id: 'extra_' + Date.now(),
    date: todayKey(),
    name: food.name,
    emoji: food.emoji || '\uD83C\uDF7D\uFE0F',
    kcal: food.kcal,
    protein: food.protein,
    carbs: food.carbs || 0,
    fat: food.fat || 0,
    items: food.items,
    confidence: food.confidence,
    needsReview: food.needsReview,
    time: timeStr,
    swappedFor: swapMealName,
    swapMealId: swapMealId || null
  });

  if (swapMealId) {
    state.checked[todayKey() + '_' + swapMealId] = true;
  }

  saveState();
  closeSnapModal();
  renderAll();
  if (typeof window.getFoodScanCoachNote === 'function' && typeof window.addCoachMessage === 'function') {
    window.addCoachMessage(window.getFoodScanCoachNote(food));
  }
  showToast(swapMealName ? `Logged swap for ${swapMealName} - ${food.kcal} kcal added` : `Extra meal logged - ${food.kcal} kcal added`);
}

function escapeSnapHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeSnapAttr(value) {
  return escapeSnapHtml(value).replace(/`/g, '&#96;');
}

// Backward-compatible wrappers for any older inline calls/bookmarks.
async function identifyFoodFromImage(b64, mime, extraDesc) {
  snapImageData = { b64, mime: mime || 'image/jpeg' };
  if (extraDesc) document.getElementById('snapDescArea').value = extraDesc;
  return estimateSnapMeal();
}

async function identifyFoodFromText(desc) {
  document.getElementById('snapDescArea').value = desc || '';
  return estimateSnapMeal();
}

function showSnapResult(food) {
  renderSnapResult(food);
}

function removeExtra(id) {
  if (!state.extraMeals) return;
  state.extraMeals = state.extraMeals.filter(e => e.id !== id);
  saveState();
  renderAll();
}
