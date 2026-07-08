// --- FIREBASE ---
firebase.initializeApp({
  apiKey: "AIzaSyDuc449HUPShaU5wBP9CFDU_eREh8n0gsU",
  authDomain: "diet-tracker-5142c.firebaseapp.com",
  projectId: "diet-tracker-5142c",
  storageBucket: "diet-tracker-5142c.firebasestorage.app",
  messagingSenderId: "737243616902",
  appId: "1:737243616902:web:e0c5ddc889f16ec09f6307"
});

const messaging = firebase.messaging();
const VAPID_KEY = 'BPOR0SuL2cNUDicnm7Dcs6z-g7VAYoZZ5ZHlvuUcvYTKADc4FN4cTS-PGujmTdTsWv8rKOI1ga5LHcANEE2tZcY';

async function getFCMToken() {
  try {
    console.log("Starting FCM token generation...");

    const reg = await navigator.serviceWorker.register("./firebase-messaging-sw.js", {
      scope: "./"
    });

    console.log("Using Firebase Messaging SW:", reg);

    const token = await firebase.messaging().getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg
    });

    console.log("FCM Token:", token);

    if (token) {
      localStorage.setItem("fcmToken", token);
    }

    return token;
  } catch (err) {
    console.error("FCM TOKEN ERROR:", err);
    return null;
  }
}

  async function syncScheduleToCloudflare() {
  try {
    const token = localStorage.getItem("fcmToken") || await getFCMToken();
    if (!token) {
      console.warn("No FCM token found. Schedule not synced.");
      return;
    }

    const rs = getRemindersState();

    const res = await fetch("https://diet-push.vinayaknehwal98.workers.dev/schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token,
        meals: state.meals,
        remindBefore: rs.remindBefore || [15, 10, 5],
        alarmAtTime: rs.alarmAtTime !== false,
        timezone: "Asia/Kolkata"
      })
    });

    const data = await res.json();
    console.log("Cloudflare schedule sync:", data);
    return data;
  } catch (err) {
    console.error("Cloudflare schedule sync failed:", err);
  }
}
  
// Handle foreground messages
messaging.onMessage((payload) => {
  console.log('Foreground message:', payload);
  const { title, body, mealId } = payload.data || {};
  if (mealId) startAudioAlarm(mealId);
  else showToast(title || '🔔 Reminder');
});
  


// --- INIT REMINDERS ON LOAD ---
function initReminders() {
  if (!NOTIF_SUPPORTED || Notification.permission !== 'granted') return;
  const rs = getRemindersState();
  if (!rs.mealsOn && !rs.waterOn) return;
  // Wait for SW controller to be ready
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(() => {
      if (rs.mealsOn) scheduleMealReminders();
      if (rs.waterOn) startWaterReminders(rs.waterInterval);
    });
  } else {
    if (rs.mealsOn) scheduleMealReminders();
    if (rs.waterOn) startWaterReminders(rs.waterInterval);
  }
}

setInterval(() => {

  state.meals.forEach(meal => {
    ensureMissedMealReason(meal);
  });

  saveState();

}, 60000);

function exposeGlobals() {
  Object.assign(window, {
    state,
    renderAll,
    renderToday,
    renderWeek,
    renderReminders,
    renderExport,
    updateMacros,
    switchTab,
    toggleExpand,
    toggleWeek,
    openModal,
    closeModal,
    addFoodRow,
    saveModal,
    toggleMealDone,
    saveMissReason,
    resetDay,
    exportToExcel,
    exportToCSV,
    handleEnableNotif,
    handleMealToggle,
    handleWaterToggle,
    handleWaterInterval,
    setWaterGoal,
    logWater,
    updateWaterUI,
    snoozeAlarm,
    doneAlarm,
    toggleReminderChip,
    toggleAlarmAtTime,
    openSnapModal,
    closeSnapModal,
    triggerSnapInput,
    handleSnapFile,
    compressSnapImage,
    onSnapDescInput,
    estimateSnapMeal,
    renderSnapResult,
    logSnapAsExtra,
    logSnapAsSwap,
    identifyFoodFromImage,
    identifyFoodFromText,
    showSnapResult,
    removeExtra,
    openImportModal,
    closeImportModal,
    handleImportDrop,
    handleImportFile,
    onPasteInput,
    applyImport,
    openAI,
    closeAI,
    sendAI,
    executeAIAction,
    editCurrentWeight,
    editStartWeight,
    editGoalWeight,
    addWeightEntry,
    showLoserModal,
    closeLoserModal,
    showMissionModal,
    closeMissionModal,
    showQuitModal,
    closeQuitModal,
    unlockContract,
    quitAnyway,
    lockContract
  });
}


// --- INIT ---
exposeGlobals();
renderAll();
initReminders();
