// =========================================================================
// [FILE: js/core.js] TIỆN ÍCH CỐT LÕI, KẾT NỐI SUPABASE & PHÂN QUYỀN
// Chứa các hàm dùng chung cho mọi module khác.
// =========================================================================
(function (global) {
  var now = new Date();
  var todayStr = now.toISOString().slice(0, 10);
  var monthStr = todayStr.slice(0, 7);

  var workDateEl = document.getElementById("workDate");
  var workMonthEl = document.getElementById("workMonth");

  if (workDateEl && !workDateEl.value) workDateEl.value = todayStr;
  if (workMonthEl && !workMonthEl.value) workMonthEl.value = monthStr;

  function initClient() {
    if (global.supabaseClient) return global.supabaseClient;
    var url = (typeof SUPABASE_URL !== "undefined" && SUPABASE_URL) ||
      (global.SUPABASE_CONFIG && global.SUPABASE_CONFIG.url) || "";
    var key = (typeof SUPABASE_ANON_KEY !== "undefined" && SUPABASE_ANON_KEY) ||
      (global.SUPABASE_CONFIG && global.SUPABASE_CONFIG.anonKey) || "";
    if (global.supabase && typeof global.supabase.createClient === "function" && url && key) {
      global.supabaseClient = global.supabase.createClient(url, key);
    }
    return global.supabaseClient || null;
  }

  function getSelectedDate() {
    return (workDateEl && workDateEl.value) ? workDateEl.value : todayStr;
  }

  function getSelectedMonth() {
    return (workMonthEl && workMonthEl.value) ? workMonthEl.value : monthStr;
  }

  function parsePositiveInt(val, fallback) {
    var num = Number(val);
    if (Number.isInteger(num) && num >= 1) return num;
    var fb = Number(fallback);
    return (Number.isInteger(fb) && fb >= 1) ? fb : 1;
  }

  function normalizeJobTitle(staff) {
    if (!staff) return "Học việc";
    if (staff.job_title === "Chính thức" || staff.job_title === "Học việc") {
      return staff.job_title;
    }
    return Number(staff.experience_years || 0) >= 3 ? "Chính thức" : "Học việc";
  }

  function expFromJobTitle(jobTitle) {
    return jobTitle === "Chính thức" ? 4 : 0.5;
  }

  function isShiftLeader() {
    return Boolean(global.currentStaff && global.currentStaff.role === "shift_leader");
  }

  function getVisibleStaffList() {
    var all = (global.rosterState && global.rosterState.staffList) || [];
    if (isShiftLeader()) return all;
    if (!global.currentStaff) return [];
    return all.filter(function (s) {
      return s.id === global.currentStaff.id;
    });
  }

  function makeTextCell(txt, bold) {
    var td = document.createElement("td");
    if (bold) {
      var st = document.createElement("strong");
      st.textContent = txt;
      td.appendChild(st);
    } else {
      td.textContent = txt;
    }
    return td;
  }

  global.AppCore = {
    todayStr: todayStr,
    monthStr: monthStr,
    workDateEl: workDateEl,
    workMonthEl: workMonthEl,
    getClient: initClient,
    getSelectedDate: getSelectedDate,
    getSelectedMonth: getSelectedMonth,
    parsePositiveInt: parsePositiveInt,
    normalizeJobTitle: normalizeJobTitle,
    expFromJobTitle: expFromJobTitle,
    isShiftLeader: isShiftLeader,
    getVisibleStaffList: getVisibleStaffList,
    makeTextCell: makeTextCell
  };
})(window);
