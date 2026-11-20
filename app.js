(function () {
  var now = new Date();
  var todayStr = now.toISOString().slice(0, 10);
  var monthStr = todayStr.slice(0, 7);

  var workDateEl = document.getElementById("workDate");
  var workMonthEl = document.getElementById("workMonth");

  if (workDateEl && !workDateEl.value) workDateEl.value = todayStr;
  if (workMonthEl && !workMonthEl.value) workMonthEl.value = monthStr;

  var teamsList = [];
  var daySlotsByDate = {};

  function initClient() {
    if (window.supabaseClient) return window.supabaseClient;
    var url = (typeof SUPABASE_URL !== "undefined" && SUPABASE_URL) ||
      (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || "";
    var key = (typeof SUPABASE_ANON_KEY !== "undefined" && SUPABASE_ANON_KEY) ||
      (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.anonKey) || "";
    if (window.supabase && typeof window.supabase.createClient === "function" && url && key) {
      window.supabaseClient = window.supabase.createClient(url, key);
    }
    return window.supabaseClient || null;
  }

  function getClient() {
    return initClient();
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
    if (staff.job_title === "Chính thức" || staff.job_title === "Học việc") {
      return staff.job_title;
    }
    return Number(staff.experience_years || 0) >= 3 ? "Chính thức" : "Học việc";
  }

  function expFromJobTitle(jobTitle) {
    return jobTitle === "Chính thức" ? 4 : 0.5;
  }

  function isShiftLeader() {
    return Boolean(window.currentStaff && window.currentStaff.role === "shift_leader");
  }

  function getVisibleStaffList() {
    var all = (window.rosterState && window.rosterState.staffList) || [];
    if (isShiftLeader()) return all;
    if (!window.currentStaff) return [];
    return all.filter(function (s) {
      return s.id === window.currentStaff.id;
    });
  }

  function saveTeamsLocal(list) {
    try {
      localStorage.setItem("airport_teams_v4", JSON.stringify(list));
    } catch (e) {}
  }

  function readTeamsLocal() {
    try {
      var raw = JSON.parse(localStorage.getItem("airport_teams_v4") || "null");
      if (Array.isArray(raw)) return raw;
    } catch (e) {}
    return [];
  }

  function loadTeams() {
    var client = getClient();
    var localList = readTeamsLocal();

    if (!client) {
      teamsList = localList;
      renderTeamSelectors();
      renderTeamManageList();
      return Promise.resolve(teamsList);
    }

    return client
      .from("teams")
      .select("*")
      .order("id", { ascending: true })
      .then(function (res) {
        if (!res.error && Array.isArray(res.data)) {
          teamsList = res.data.length > 0 ? res.data : localList;
          if (res.data.length > 0) saveTeamsLocal(teamsList);
        } else {
          teamsList = localList;
        }
        renderTeamSelectors();
        renderTeamManageList();
        return teamsList;
      })
      .catch(function () {
        teamsList = localList;
        renderTeamSelectors();
        renderTeamManageList();
        return teamsList;
      });
  }

  function getTeamNameById(groupId) {
    for (var i = 0; i < teamsList.length; i++) {
      if (String(teamsList[i].id) === String(groupId)) {
        return teamsList[i].name || "Chưa đặt tên tổ";
      }
    }
    return "Chưa phân tổ";
  }

  function renderTeamSelectors() {
    var ids = ["shiftGroupInput", "editShiftGroup"];
    for (var sIdx = 0; sIdx < ids.length; sIdx++) {
      var sel = document.getElementById(ids[sIdx]);
      if (!sel) continue;
      var currentVal = sel.value;
      sel.innerHTML = "";
      for (var i = 0; i < teamsList.length; i++) {
        var opt = document.createElement("option");
        opt.value = String(parsePositiveInt(teamsList[i].id, i + 1));
        opt.textContent = teamsList[i].name + (teamsList[i].note ? " (" + teamsList[i].note + ")" : "");
        sel.appendChild(opt);
      }
      if (currentVal) {
        for (var k = 0; k < sel.options.length; k++) {
          if (sel.options[k].value === String(currentVal)) {
            sel.value = String(currentVal);
            break;
          }
        }
      }
      if (!sel.value && sel.options.length > 0) {
        sel.value = sel.options[0].value;
      }
    }
  }

  function renderTeamManageList() {
    var container = document.getElementById("teamListContainer");
    if (!container) return;
    container.innerHTML = "";

    if (!teamsList.length) {
      container.innerHTML = "<div class='small-muted'>Chưa có tổ / nhóm nào. Hãy thêm tổ mới ở trên.</div>";
      return;
    }

    for (var i = 0; i < teamsList.length; i++) {
      (function (t) {
        var row = document.createElement("div");
        row.className = "team-item";

        var info = document.createElement("div");
        info.innerHTML = "<strong>" + (t.name || "Chưa đặt tên tổ") + "</strong>" +
          (t.note ? " <span class='small-muted'>- " + t.note + "</span>" : "");

        var btns = document.createElement("div");
        btns.className = "action-btns";

        var btnEdit = document.createElement("button");
        btnEdit.type = "button";
        btnEdit.className = "btn-primary btn-sm";
        btnEdit.textContent = "Sửa";
        btnEdit.addEventListener("click", function () {
          openEditTeamModal(t);
        });

        var btnDel = document.createElement("button");
        btnDel.type = "button";
        btnDel.className = "btn-danger btn-sm";
        btnDel.textContent = "Xóa";
        btnDel.addEventListener("click", function () {
          if (!confirm("Xóa " + (t.name || "tổ này") + "?")) return;

          var applyRemove = function () {
            teamsList = teamsList.filter(function (item) {
              return String(item.id) !== String(t.id);
            });
            saveTeamsLocal(teamsList);
            renderTeamSelectors();
            renderTeamManageList();
            renderStaffList();
          };

          var client = getClient();
          if (client) {
            client.from("teams").delete().eq("id", t.id).then(function (res) {
              if (res.error) {
                alert("Lỗi xóa tổ trên DB: " + res.error.message);
                return;
              }
              applyRemove();
            });
          } else {
            applyRemove();
          }
        });

        btns.appendChild(btnEdit);
        btns.appendChild(btnDel);
        row.appendChild(info);
        row.appendChild(btns);
        container.appendChild(row);
      })(teamsList[i]);
    }
  }

  var addTeamForm = document.getElementById("addTeamForm");
  if (addTeamForm) {
    addTeamForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!isShiftLeader()) return alert("Chỉ Ca trưởng mới được thêm tổ / nhóm.");
      var nameEl = document.getElementById("newTeamName");
      var noteEl = document.getElementById("newTeamNote");
      var name = nameEl ? nameEl.value.trim() : "";
      var note = noteEl ? noteEl.value.trim() : "";
      if (!name) return;

      var client = getClient();
      if (client) {
        client
          .from("teams")
          .insert({ name: name, note: note })
          .select()
          .single()
          .then(function (res) {
            if (res.error) {
              alert("Lỗi thêm tổ: " + res.error.message);
              return;
            }
            if (res.data) {
              teamsList.push(res.data);
              saveTeamsLocal(teamsList);
              addTeamForm.reset();
              renderTeamSelectors();
              renderTeamManageList();
            }
          });
      } else {
        var maxId = teamsList.reduce(function (m, item) {
          return Math.max(m, parsePositiveInt(item.id, 0));
        }, 0);
        teamsList.push({ id: maxId + 1, name: name, note: note });
        saveTeamsLocal(teamsList);
        addTeamForm.reset();
        renderTeamSelectors();
        renderTeamManageList();
      }
    });
  }

  var editTeamModal = document.getElementById("editTeamModal");
  var btnCloseTeamModal = document.getElementById("btnCloseTeamModal");
  if (btnCloseTeamModal) {
    btnCloseTeamModal.addEventListener("click", function () {
      if (editTeamModal) editTeamModal.classList.remove("open");
    });
  }

  function openEditTeamModal(team) {
    document.getElementById("editTeamId").value = team.id;
    document.getElementById("editTeamName").value = team.name || "";
    document.getElementById("editTeamNote").value = team.note || "";
    if (editTeamModal) editTeamModal.classList.add("open");
  }

  var editTeamForm = document.getElementById("editTeamForm");
  if (editTeamForm) {
    editTeamForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = parsePositiveInt(document.getElementById("editTeamId").value, 1);
      var name = document.getElementById("editTeamName").value.trim();
      var note = document.getElementById("editTeamNote").value.trim();
      if (!name) return;

      var applyLocalUpdate = function () {
        for (var i = 0; i < teamsList.length; i++) {
          if (Number(teamsList[i].id) === id) {
            teamsList[i].name = name;
            teamsList[i].note = note;
          }
        }
        saveTeamsLocal(teamsList);
        if (editTeamModal) editTeamModal.classList.remove("open");
        renderTeamSelectors();
        renderTeamManageList();
        renderStaffList();
      };

      var client = getClient();
      if (client) {
        client.from("teams").update({ name: name, note: note }).eq("id", id).then(function (res) {
          if (res.error) {
            alert("Lỗi cập nhật tổ: " + res.error.message);
            return;
          }
          applyLocalUpdate();
        });
      } else {
        applyLocalUpdate();
      }
    });
  }

  function getDaySlots(dateStr) {
    if (!daySlotsByDate[dateStr]) {
      try {
        var raw = JSON.parse(localStorage.getItem("dayPositionSlots_" + dateStr) || "null");
        daySlotsByDate[dateStr] = Array.isArray(raw) ? raw : [];
      } catch (e) {
        daySlotsByDate[dateStr] = [];
      }
    }
    return daySlotsByDate[dateStr];
  }

  function saveDaySlots(dateStr) {
    var slots = getDaySlots(dateStr);
    try {
      localStorage.setItem("dayPositionSlots_" + dateStr, JSON.stringify(slots));
    } catch (e) {}
    syncSlotsToRosters(dateStr);
  }

  function timeToMinutes(hhmm) {
    if (!hhmm || hhmm.indexOf(":") === -1) return null;
    var parts = hhmm.split(":");
    var h = Number(parts[0]);
    var m = Number(parts[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  function minutesToTime(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function getStaffWorkSlots(staffId, dateStr) {
    var slots = getDaySlots(dateStr);
    var matched = [];
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      var list = s.staffIds || [];
      if (list.indexOf(staffId) !== -1) {
        matched.push(s);
      }
    }
    matched.sort(function (a, b) {
      var ma = timeToMinutes(a.start);
      var mb = timeToMinutes(b.start);
      if (ma === null) return 1;
      if (mb === null) return -1;
      return ma - mb;
    });
    return matched;
  }

  function computeRestPeriods(workSlots) {
    if (!workSlots || workSlots.length <= 1) return [];
    var rests = [];
    for (var i = 0; i < workSlots.length - 1; i++) {
      var prevEnd = timeToMinutes(workSlots[i].end);
      var nextStart = timeToMinutes(workSlots[i + 1].start);
      if (prevEnd !== null && nextStart !== null && nextStart > prevEnd) {
        rests.push(minutesToTime(prevEnd) + "-" + minutesToTime(nextStart));
      }
    }
    return rests;
  }

  function syncSlotsToRosters(dateStr) {
    if (typeof window.getOrCreateRoster !== "function") return;
    var allStaff = (window.rosterState && window.rosterState.staffList) || [];
    for (var i = 0; i < allStaff.length; i++) {
      var st = allStaff[i];
      var rec = window.getOrCreateRoster(st.id, dateStr);
      var mySlots = getStaffWorkSlots(st.id, dateStr);
      var rests = computeRestPeriods(mySlots);

      rec.shift_1 = mySlots[0] ? (mySlots[0].position + " (" + mySlots[0].start + "-" + mySlots[0].end + ")") : "";
      rec.shift_2 = mySlots[1] ? (mySlots[1].position + " (" + mySlots[1].start + "-" + mySlots[1].end + ")") : "";
      rec.extra_shifts = [];
      for (var j = 2; j < mySlots.length; j++) {
        rec.extra_shifts.push(mySlots[j].position + " (" + mySlots[j].start + "-" + mySlots[j].end + ")");
      }
      rec.break_off_slots = rests;
      if (mySlots.length > 0) {
        rec.work_hours = mySlots[0].start + "-" + mySlots[mySlots.length - 1].end;
      }
    }
  }

  function isOffDay(staffId, rec) {
    var leaves = (window.rosterState && window.rosterState.leavesByStaff) || {};
    return Boolean((rec && rec.is_day_off) || leaves[staffId]);
  }

  function renderPanelStats() {
    var allStaff = (window.rosterState && window.rosterState.staffList) || [];
    var total = allStaff.length;
    var oldCount = 0;
    var newCount = 0;
    var offTodayCount = 0;
    var date = getSelectedDate();

    for (var i = 0; i < allStaff.length; i++) {
      var s = allStaff[i];
      if (normalizeJobTitle(s) === "Chính thức") {
        oldCount++;
      } else {
        newCount++;
      }
      var rec = (window.rosterState && window.rosterState.rostersByStaff)
        ? window.rosterState.rostersByStaff[s.id]
        : null;
      if (!rec && typeof window.getOrCreateRoster === "function") {
        rec = window.getOrCreateRoster(s.id, date);
      }
      if (isOffDay(s.id, rec)) {
        offTodayCount++;
      }
    }

    var workTodayCount = Math.max(0, total - offTodayCount);

    var elTotal = document.getElementById("statTotalStaff");
    var elNew = document.getElementById("statNewStaff");
    var elOld = document.getElementById("statOldStaff");
    var elWork = document.getElementById("statWorkToday");
    var elOff = document.getElementById("statOffToday");

    if (elTotal) elTotal.textContent = String(total);
    if (elNew) elNew.textContent = String(newCount);
    if (elOld) elOld.textContent = String(oldCount);
    if (elWork) elWork.textContent = String(workTodayCount);
    if (elOff) elOff.textContent = String(offTodayCount);
  }

  function getMonthShiftDir(staff, ym) {
    var map = (window.rosterState && window.rosterState.monthShiftDirs) || {};
    if (map[staff.id]) return map[staff.id];
    return staff.base_shift_type || "DEP";
  }

  function setMonthShiftDir(staff, ym, dir) {
    if (!window.rosterState.monthShiftDirs) window.rosterState.monthShiftDirs = {};
    window.rosterState.monthShiftDirs[staff.id] = dir;
    try {
      localStorage.setItem("monthShiftDirs_" + ym, JSON.stringify(window.rosterState.monthShiftDirs));
    } catch (e) {}

    var client = getClient();
    if (client && isShiftLeader()) {
      client.from("profiles").update({ base_shift_type: dir }).eq("id", staff.id).then(function () {});
    }
  }

  function applyRoleLabelsAndVisibility() {
    var leader = isShiftLeader();

    var tabBtn1 = document.getElementById("tabBtn1");
    var tabBtn2 = document.getElementById("tabBtn2");
    var tabBtn3 = document.getElementById("tabBtn3");
    if (tabBtn1) tabBtn1.textContent = leader ? "1. Thông tin nhân sự" : "1. Thông tin cá nhân";
    if (tabBtn2) tabBtn2.textContent = leader ? "2. Cắt lịch trong ngày" : "2. Vị trí trong ngày";
    if (tabBtn3) tabBtn3.textContent = leader ? "3. Cắt lịch trong tháng" : "3. Lịch làm / OFF trong tháng";

    var teamCard = document.getElementById("teamManageCard");
    var formCard = document.getElementById("staffFormCard");
    var myCard = document.getElementById("myPersonalCard");
    var staffTableCard = document.getElementById("staffTableCard");
    if (teamCard) teamCard.style.display = leader ? "block" : "none";
    if (formCard) formCard.style.display = leader ? "block" : "none";
    if (myCard) myCard.style.display = leader ? "none" : "block";
    if (staffTableCard) staffTableCard.style.display = leader ? "block" : "none";

    var dayTitle = document.getElementById("daySectionTitle");
    var dayControls = document.getElementById("dayCutControls");
    var btnSaveAll = document.getElementById("btnSaveAllRosters");
    if (dayTitle) dayTitle.textContent = leader ? "Cắt Lịch Trong Ngày" : "Vị Trí Trong Ngày";
    if (dayControls) dayControls.style.display = leader ? "block" : "none";
    if (btnSaveAll) btnSaveAll.style.display = leader ? "inline-block" : "none";

    var monthTitle = document.getElementById("monthSectionTitle");
    var monthHint = document.getElementById("monthHintText");
    if (monthTitle) monthTitle.textContent = leader ? "Cắt Lịch Trong Tháng" : "Lịch Làm / OFF Trong Tháng";
    if (monthHint) {
      monthHint.textContent = leader
        ? "Chọn Hướng ca (DEP / ARR) cho từng nhân sự trong tháng và bấm vào từng ngày (01..31) để chuyển giữa Ngày làm (xanh) và Ngày OFF (đỏ)."
        : "Xem hướng ca (DEP / ARR), danh sách ngày làm và ngày OFF của bạn trong tháng.";
    }
  }

  function setLoginMsg(msg, isErr) {
    var el = document.getElementById("loginMsg");
    if (!el) return;
    el.textContent = msg || "";
    el.style.color = isErr ? "#b91c1c" : "#0f4c81";
  }

  function showLoginView() {
    var loginSec = document.getElementById("loginSection");
    var appSec = document.getElementById("appSection");
    if (loginSec) loginSec.style.display = "flex";
    if (appSec) appSec.style.display = "none";
  }

  function showAppView(staffRec) {
    window.currentStaff = staffRec;
    var loginSec = document.getElementById("loginSection");
    var appSec = document.getElementById("appSection");
    if (loginSec) loginSec.style.display = "none";
    if (appSec) appSec.style.display = "block";

    var infoEl = document.getElementById("currentUserInfo");
    if (infoEl) {
      var roleLabel = staffRec.role === "shift_leader" ? "Ca trưởng" : "Nhân viên";
      infoEl.textContent = (staffRec.employee_code || "") + " - " + (staffRec.full_name || "") + " (" + roleLabel + ")";
    }

    applyRoleLabelsAndVisibility();

    loadTeams().then(function () {
      return window.loadDashboardData();
    }).then(function () {
      if (staffRec.must_change_password) {
        openChangePassModal("Bạn đang đăng nhập lần đầu bằng mật khẩu mặc định 12345. Vui lòng đổi mật khẩu mới.");
      }
    });
  }

  var loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var client = getClient();
      if (!client) {
        setLoginMsg("Chưa khởi tạo được kết nối Supabase.", true);
        return;
      }
      var codeInput = document.getElementById("loginUserInput").value.trim().toUpperCase();
      var passInput = document.getElementById("loginPasswordInput").value;
      if (!codeInput || !passInput) {
        setLoginMsg("Vui lòng nhập mã nhân viên và mật khẩu.", true);
        return;
      }

      setLoginMsg("Đang kiểm tra tài khoản...", false);
      client
        .from("profiles")
        .select("*")
        .eq("employee_code", codeInput)
        .eq("is_active", true)
        .maybeSingle()
        .then(function (res) {
          if (res.error) {
            setLoginMsg("Lỗi truy vấn: " + res.error.message, true);
            return;
          }
          var staff = res.data;
          if (!staff) {
            setLoginMsg("Không tìm thấy mã nhân viên hoặc tài khoản đã bị khóa.", true);
            return;
          }
          var expectedPass = staff.auth_password || "12345";
          if (passInput !== expectedPass) {
            setLoginMsg("Sai mật khẩu.", true);
            return;
          }
          sessionStorage.setItem("loggedInStaffId", staff.id);
          setLoginMsg("", false);
          showAppView(staff);
        });
    });
  }

  var btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", function () {
      sessionStorage.removeItem("loggedInStaffId");
      window.currentStaff = null;
      showLoginView();
    });
  }

  var passModal = document.getElementById("changePassModal");
  function openChangePassModal(hintText) {
    var hintEl = document.getElementById("changePassHint");
    if (hintEl && hintText) hintEl.textContent = hintText;
    if (passModal) passModal.classList.add("open");
  }

  var btnOpenChangePass = document.getElementById("btnOpenChangePass");
  if (btnOpenChangePass) {
    btnOpenChangePass.addEventListener("click", function () {
      openChangePassModal("Nhập mật khẩu mới cho tài khoản của bạn.");
    });
  }

  var btnClosePassModal = document.getElementById("btnClosePassModal");
  if (btnClosePassModal) {
    btnClosePassModal.addEventListener("click", function () {
      if (passModal) passModal.classList.remove("open");
    });
  }

  var changePassForm = document.getElementById("changePassForm");
  if (changePassForm) {
    changePassForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var client = getClient();
      if (!client || !window.currentStaff) return;

      var p1 = document.getElementById("newPassInput").value;
      var p2 = document.getElementById("confirmPassInput").value;
      if (p1 !== p2) {
        alert("Mật khẩu nhập lại không khớp.");
        return;
      }

      client
        .from("profiles")
        .update({
          auth_password: p1,
          must_change_password: false
        })
        .eq("id", window.currentStaff.id)
        .select()
        .single()
        .then(function (res) {
          if (res.error) {
            alert("Lỗi đổi mật khẩu: " + res.error.message);
            return;
          }
          window.currentStaff = res.data;
          changePassForm.reset();
          if (passModal) passModal.classList.remove("open");
          alert("Đã cập nhật mật khẩu thành công.");
          window.loadDashboardData();
        });
    });
  }

  var tabButtons = document.querySelectorAll(".tab-btn");
  var tabPanels = document.querySelectorAll(".tab-panel");
  for (var t = 0; t < tabButtons.length; t++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-tab");
        for (var i = 0; i < tabButtons.length; i++) {
          tabButtons[i].classList.toggle("active", tabButtons[i] === btn);
        }
        for (var j = 0; j < tabPanels.length; j++) {
          tabPanels[j].classList.toggle("active", tabPanels[j].id === targetId);
        }
        if (targetId === "tabMonth") {
          loadMonthTab();
        } else {
          window.loadDashboardData();
        }
      });
    })(tabButtons[t]);
  }

  window.loadDashboardData = function () {
    if (!getClient()) return Promise.resolve();
    var date = getSelectedDate();
    var task = (typeof window.fetchDailySchedule === "function")
      ? window.fetchDailySchedule(date)
      : Promise.resolve();

    return task.then(function () {
      syncSlotsToRosters(date);
      renderPanelStats();
      renderMyPersonalCard();
      renderStaffList();
      renderPositionSlotSelectorsAndCards();
      renderDaySchedule();
    });
  };

  function loadMonthTab() {
    if (!getClient()) return Promise.resolve();
    var ym = getSelectedMonth();
    var task = (typeof window.fetchMonthlySchedule === "function")
      ? window.fetchMonthlySchedule(ym)
      : Promise.resolve();

    return task.then(function () {
      renderPanelStats();
      renderMonthSchedule();
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

  function renderMyPersonalCard() {
    var grid = document.getElementById("myPersonalGrid");
    var s = window.currentStaff;
    if (!grid || !s) return;
    grid.innerHTML =
      '<div class="info-box"><div class="small-muted">Mã nhân viên</div><strong>' + (s.employee_code || "") + '</strong></div>' +
      '<div class="info-box"><div class="small-muted">Họ và tên</div><strong>' + (s.full_name || "") + '</strong></div>' +
      '<div class="info-box"><div class="small-muted">Chức danh</div><strong>' + normalizeJobTitle(s) + '</strong></div>' +
      '<div class="info-box"><div class="small-muted">Tổ / Nhóm ca</div><strong>' + getTeamNameById(s.shift_group) + '</strong></div>';
  }

  var editModal = document.getElementById("editStaffModal");
  var btnCloseEditModal = document.getElementById("btnCloseEditModal");
  if (btnCloseEditModal) {
    btnCloseEditModal.addEventListener("click", function () {
      if (editModal) editModal.classList.remove("open");
    });
  }

  function openEditStaffModal(staff) {
    renderTeamSelectors();
    document.getElementById("editStaffId").value = staff.id;
    document.getElementById("editEmpCode").value = staff.employee_code || "";
    document.getElementById("editFullName").value = staff.full_name || "";
    document.getElementById("editJobTitle").value = normalizeJobTitle(staff);
    document.getElementById("editShiftGroup").value = String(parsePositiveInt(staff.shift_group, 1));
    document.getElementById("editRole").value = staff.role || "staff";
    if (editModal) editModal.classList.add("open");
  }

  var editStaffForm = document.getElementById("editStaffForm");
  if (editStaffForm) {
    editStaffForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var client = getClient();
      if (!client) return;

      var id = document.getElementById("editStaffId").value;
      var code = document.getElementById("editEmpCode").value.trim().toUpperCase();
      var name = document.getElementById("editFullName").value.trim();
      var jobTitle = document.getElementById("editJobTitle").value;
      var group = parsePositiveInt(document.getElementById("editShiftGroup").value, 1);
      var role = document.getElementById("editRole").value || "staff";

      client
        .from("profiles")
        .update({
          employee_code: code,
          full_name: name,
          job_title: jobTitle,
          experience_years: expFromJobTitle(jobTitle),
          shift_group: group,
          role: role
        })
        .eq("id", id)
        .then(function (res) {
          if (res.error) {
            alert("Lỗi cập nhật nhân viên: " + res.error.message);
            return;
          }
          if (editModal) editModal.classList.remove("open");
          window.loadDashboardData();
        });
    });
  }

  function renderStaffList() {
    var tbody = document.getElementById("staffListBody");
    if (!tbody || !window.rosterState) return;
    tbody.innerHTML = "";
    var list = window.rosterState.staffList || [];
    var canManage = isShiftLeader();

    for (var i = 0; i < list.length; i++) {
      (function (s) {
        var tr = document.createElement("tr");
        tr.appendChild(makeTextCell(s.employee_code || "", true));
        tr.appendChild(makeTextCell(s.full_name || "", false));
        tr.appendChild(makeTextCell(normalizeJobTitle(s), false));
        tr.appendChild(makeTextCell(getTeamNameById(s.shift_group), false));
        tr.appendChild(makeTextCell(s.must_change_password ? "Chưa đổi" : "Đã đổi", false));

        var actTd = document.createElement("td");
        if (canManage) {
          var box = document.createElement("div");
          box.className = "action-btns";

          var btnEdit = document.createElement("button");
          btnEdit.type = "button";
          btnEdit.className = "btn-primary btn-sm";
          btnEdit.textContent = "Sửa";
          btnEdit.addEventListener("click", function () {
            openEditStaffModal(s);
          });

          var btnReset = document.createElement("button");
          btnReset.type = "button";
          btnReset.className = "btn-warning btn-sm";
          btnReset.textContent = "Reset 12345";
          btnReset.addEventListener("click", function () {
            if (!confirm("Reset mật khẩu của " + s.full_name + " về 12345?")) return;
            getClient()
              .from("profiles")
              .update({ auth_password: "12345", must_change_password: true })
              .eq("id", s.id)
              .then(function (res) {
                if (res.error) return alert("Lỗi reset mật khẩu: " + res.error.message);
                alert("Đã reset mật khẩu về 12345.");
                window.loadDashboardData();
              });
          });

          var btnDel = document.createElement("button");
          btnDel.type = "button";
          btnDel.className = "btn-danger btn-sm";
          btnDel.textContent = "Xóa";
          btnDel.addEventListener("click", function () {
            if (!confirm("Xóa nhân viên " + s.full_name + " (" + s.employee_code + ")?")) return;
            getClient()
              .from("profiles")
              .delete()
              .eq("id", s.id)
              .then(function (res) {
                if (res.error) return alert("Lỗi xóa nhân viên: " + res.error.message);
                window.loadDashboardData();
              });
          });

          box.appendChild(btnEdit);
          box.appendChild(btnReset);
          box.appendChild(btnDel);
          actTd.appendChild(box);
        } else {
          actTd.textContent = "-";
        }
        tr.appendChild(actTd);
        tbody.appendChild(tr);
      })(list[i]);
    }
  }

  var staffForm = document.getElementById("staffForm");
  if (staffForm) {
    staffForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var client = getClient();
      if (!client) return alert("Chưa kết nối Supabase");

      var code = document.getElementById("empCode").value.trim().toUpperCase();
      var name = document.getElementById("fullName").value.trim();
      var jobTitle = document.getElementById("empJobTitle").value;
      var group = parsePositiveInt(document.getElementById("shiftGroupInput").value, 1);
      var role = document.getElementById("roleInput").value || "staff";

      if (!code || !name) return alert("Nhập đủ Mã NV và Tên nhân sự");

      client
        .from("profiles")
        .insert({
          employee_code: code,
          full_name: name,
          job_title: jobTitle,
          experience_years: expFromJobTitle(jobTitle),
          shift_group: group,
          base_shift_type: "DEP",
          role: role,
          auth_password: "12345",
          must_change_password: true,
          is_active: true
        })
        .then(function (res) {
          if (res.error) {
            alert("Lỗi thêm nhân viên: " + res.error.message);
            return;
          }
          staffForm.reset();
          renderTeamSelectors();
          window.loadDashboardData();
        });
    });
  }

  function getStaffNameById(staffId) {
    var list = (window.rosterState && window.rosterState.staffList) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === staffId) return list[i].full_name || list[i].employee_code || "";
    }
    return "";
  }

  function renderPositionSlotSelectorsAndCards() {
    var date = getSelectedDate();
    var slots = getDaySlots(date);
    var staffList = (window.rosterState && window.rosterState.staffList) || [];

    var slotSel = document.getElementById("assignSlotSelect");
    var staffSel = document.getElementById("assignStaffSelect");
    var container = document.getElementById("positionSlotsContainer");

    if (slotSel) {
      var prevSlot = slotSel.value;
      slotSel.innerHTML = "";
      for (var i = 0; i < slots.length; i++) {
        var opt = document.createElement("option");
        opt.value = slots[i].id;
        opt.textContent = slots[i].position + " (" + slots[i].start + " - " + slots[i].end + ")";
        slotSel.appendChild(opt);
      }
      if (prevSlot) slotSel.value = prevSlot;
    }

    if (staffSel) {
      staffSel.innerHTML = "";
      for (var j = 0; j < staffList.length; j++) {
        var sOpt = document.createElement("option");
        sOpt.value = staffList[j].id;
        sOpt.textContent = (staffList[j].full_name || "") + " - " + normalizeJobTitle(staffList[j]);
        staffSel.appendChild(sOpt);
      }
    }

    if (!container) return;
    container.innerHTML = "";

    if (!slots.length) {
      container.innerHTML = "<div class='small-muted'>Chưa có vị trí &amp; khung giờ làm việc nào cho ngày " + date + ".</div>";
      return;
    }

    for (var k = 0; k < slots.length; k++) {
      (function (slot) {
        var card = document.createElement("div");
        card.className = "slot-card";

        var head = document.createElement("div");
        head.className = "slot-header";

        var titleEl = document.createElement("div");
        titleEl.innerHTML = "<strong>" + slot.position + "</strong> <span class='small-muted'>(" +
          slot.start + " - " + slot.end + ")</span>";

        var btnDelSlot = document.createElement("button");
        btnDelSlot.type = "button";
        btnDelSlot.className = "btn-danger btn-sm";
        btnDelSlot.textContent = "Xóa khung";
        btnDelSlot.addEventListener("click", function () {
          daySlotsByDate[date] = getDaySlots(date).filter(function (item) {
            return item.id !== slot.id;
          });
          saveDaySlots(date);
          renderPositionSlotSelectorsAndCards();
          renderDaySchedule();
        });

        head.appendChild(titleEl);
        head.appendChild(btnDelSlot);
        card.appendChild(head);

        var chipsWrap = document.createElement("div");
        var assigned = slot.staffIds || [];
        if (!assigned.length) {
          chipsWrap.innerHTML = "<span class='small-muted'>Chưa có nhân viên nào ở vị trí này.</span>";
        } else {
          for (var a = 0; a < assigned.length; a++) {
            (function (stId) {
              var chip = document.createElement("span");
              chip.className = "assigned-chip";
              var txt = document.createElement("span");
              txt.textContent = getStaffNameById(stId);
              var xBtn = document.createElement("button");
              xBtn.type = "button";
              xBtn.textContent = "×";
              xBtn.title = "Bỏ nhân viên khỏi vị trí";
              xBtn.addEventListener("click", function () {
                slot.staffIds = (slot.staffIds || []).filter(function (id) { return id !== stId; });
                saveDaySlots(date);
                renderPositionSlotSelectorsAndCards();
                renderDaySchedule();
              });
              chip.appendChild(txt);
              chip.appendChild(xBtn);
              chipsWrap.appendChild(chip);
            })(assigned[a]);
          }
        }
        card.appendChild(chipsWrap);
        container.appendChild(card);
      })(slots[k]);
    }
  }

  var addPositionSlotForm = document.getElementById("addPositionSlotForm");
  if (addPositionSlotForm) {
    addPositionSlotForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!isShiftLeader()) return;
      var pos = document.getElementById("slotPositionInput").value.trim();
      var start = document.getElementById("slotStartInput").value;
      var end = document.getElementById("slotEndInput").value;
      var date = getSelectedDate();

      if (!pos || !start || !end) return alert("Nhập đủ vị trí làm việc và khoảng thời gian làm.");

      var slots = getDaySlots(date);
      slots.push({
        id: "slot_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        position: pos,
        start: start,
        end: end,
        staffIds: []
      });
      saveDaySlots(date);
      document.getElementById("slotPositionInput").value = "";
      renderPositionSlotSelectorsAndCards();
      renderDaySchedule();
    });
  }

  var btnAddStaffToSlot = document.getElementById("btnAddStaffToSlot");
  if (btnAddStaffToSlot) {
    btnAddStaffToSlot.addEventListener("click", function () {
      if (!isShiftLeader()) return;
      var date = getSelectedDate();
      var slots = getDaySlots(date);
      var slotId = document.getElementById("assignSlotSelect").value;
      var staffId = document.getElementById("assignStaffSelect").value;

      if (!slotId || !staffId) return alert("Vui lòng tạo vị trí/khung giờ trước và chọn nhân viên.");

      var targetSlot = null;
      for (var i = 0; i < slots.length; i++) {
        if (slots[i].id === slotId) {
          targetSlot = slots[i];
          break;
        }
      }
      if (!targetSlot) return;

      if (!Array.isArray(targetSlot.staffIds)) targetSlot.staffIds = [];
      if (targetSlot.staffIds.indexOf(staffId) === -1) {
        targetSlot.staffIds.push(staffId);
      }

      saveDaySlots(date);
      renderPositionSlotSelectorsAndCards();
      renderDaySchedule();
    });
  }

  function renderDaySchedule() {
    var tbody = document.getElementById("scheduleBody");
    if (!tbody || !window.rosterState) return;
    tbody.innerHTML = "";

    var date = getSelectedDate();
    var list = getVisibleStaffList();

    for (var i = 0; i < list.length; i++) {
      (function (staff) {
        var rec = typeof window.getOrCreateRoster === "function"
          ? window.getOrCreateRoster(staff.id, date)
          : null;
        var off = isOffDay(staff.id, rec);
        var mySlots = getStaffWorkSlots(staff.id, date);
        var rests = computeRestPeriods(mySlots);

        var tr = document.createElement("tr");
        tr.appendChild(makeTextCell(staff.full_name || "", true));
        tr.appendChild(makeTextCell(normalizeJobTitle(staff), false));

        var workTd = document.createElement("td");
        if (off) {
          workTd.innerHTML = "<span class='badge-off'>OFF CẢ NGÀY</span>";
        } else if (mySlots.length > 0) {
          var lines = [];
          for (var sIdx = 0; sIdx < mySlots.length; sIdx++) {
            var sl = mySlots[sIdx];
            lines.push("<strong>" + sl.position + "</strong>: " + sl.start + " - " + sl.end);
          }
          workTd.innerHTML = lines.join("<br>");
        } else {
          workTd.textContent = "Nghỉ ngơi tại chỗ";
        }
        tr.appendChild(workTd);

        var restTd = document.createElement("td");
        if (off) {
          restTd.textContent = "Nghỉ cả ngày";
        } else if (rests.length > 0) {
          restTd.innerHTML = "<strong>" + rests.join(", ") + "</strong>";
        } else if (mySlots.length > 0) {
          restTd.textContent = "Không có khoảng nghỉ giữa ca";
        } else {
          restTd.textContent = "Nghỉ ngơi tại chỗ";
        }
        tr.appendChild(restTd);

        tbody.appendChild(tr);
      })(list[i]);
    }
  }

  var btnCutDayOff = document.getElementById("btnCutDayOff");
  if (btnCutDayOff) {
    btnCutDayOff.addEventListener("click", function () {
      if (!isShiftLeader()) return;
      var client = getClient();
      if (!client) return;
      var staffId = document.getElementById("assignStaffSelect").value;
      var date = getSelectedDate();
      if (!staffId) return;

      client
        .from("leave_requests")
        .insert({
          staff_id: staffId,
          leave_date: date,
          reason: "Ca trưởng cắt OFF cả ngày",
          status: "approved",
          approved_by: (window.currentStaff && window.currentStaff.id) ? window.currentStaff.id : null
        })
        .then(function () {
          var rec = window.getOrCreateRoster(staffId, date);
          rec.is_day_off = true;
          if (typeof window.upsertSingleRoster === "function") {
            return window.upsertSingleRoster(rec);
          }
        })
        .then(function () {
          window.loadDashboardData();
        });
    });
  }

  var btnSaveAll = document.getElementById("btnSaveAllRosters");
  if (btnSaveAll) {
    btnSaveAll.addEventListener("click", function () {
      if (!isShiftLeader()) return;
      var date = getSelectedDate();
      syncSlotsToRosters(date);
      saveDaySlots(date);

      var mapObj = (window.rosterState && window.rosterState.rostersByStaff) || {};
      var keys = Object.keys(mapObj);
      var chain = Promise.resolve();
      for (var i = 0; i < keys.length; i++) {
        (function (rec) {
          chain = chain.then(function () {
            if (typeof window.upsertSingleRoster === "function") {
              return window.upsertSingleRoster(rec);
            }
          });
        })(mapObj[keys[i]]);
      }
      chain.then(function () {
        renderPanelStats();
        alert("Đã lưu lịch ngày " + date);
      }).catch(function (err) {
        alert("Lỗi lưu lịch: " + err.message);
      });
    });
  }

  if (workDateEl) {
    workDateEl.addEventListener("change", function () {
      window.loadDashboardData();
    });
  }

  function renderMonthSchedule() {
    var tbody = document.getElementById("monthScheduleBody");
    if (!tbody || !window.rosterState) return;
    tbody.innerHTML = "";

    var leader = isShiftLeader();
    var ym = getSelectedMonth();
    var parts = ym.split("-");
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var totalDays = new Date(y, m, 0).getDate();

    var staffList = getVisibleStaffList();
    var mRosters = window.rosterState.monthRosters || [];
    var mLeaves = window.rosterState.monthLeaves || [];

    for (var i = 0; i < staffList.length; i++) {
      (function (staff) {
        var offSet = {};
        for (var rIdx = 0; rIdx < mRosters.length; rIdx++) {
          var r = mRosters[rIdx];
          if (r.staff_id === staff.id && r.is_day_off) {
            offSet[r.shift_date] = true;
          }
        }
        for (var lIdx = 0; lIdx < mLeaves.length; lIdx++) {
          var l = mLeaves[lIdx];
          if (l.staff_id === staff.id && l.status !== "rejected") {
            offSet[l.leave_date] = true;
          }
        }

        var workDays = [];
        var offDays = [];
        var box = document.createElement("div");
        box.className = "month-days-box";

        for (var d = 1; d <= totalDays; d++) {
          (function (dayNum) {
            var dd = String(dayNum).padStart(2, "0");
            var fullDate = ym + "-" + dd;
            var isOff = !!offSet[fullDate];

            if (isOff) {
              offDays.push(dd);
            } else {
              workDays.push(dd);
            }

            var chip = document.createElement("button");
            chip.type = "button";
            chip.className = "day-chip " + (isOff ? "day-off" : "day-work") + (leader ? "" : " readonly");
            chip.textContent = dd;
            chip.title = fullDate + (isOff ? " (OFF)" : " (Làm)");

            if (leader) {
              chip.addEventListener("click", function () {
                var client = getClient();
                if (!client) return;
                var nextOff = !isOff;
                client
                  .from("daily_rosters")
                  .upsert({
                    staff_id: staff.id,
                    shift_date: fullDate,
                    duty_type: nextOff ? "OFF" : "NORMAL",
                    is_day_off: nextOff
                  }, { onConflict: "staff_id,shift_date" })
                  .then(function (res) {
                    if (res.error) return alert("Lỗi cập nhật ngày: " + res.error.message);
                    loadMonthTab();
                  });
              });
            }
            box.appendChild(chip);
          })(d);
        }

        var tr = document.createElement("tr");
        tr.appendChild(makeTextCell(staff.full_name || "", true));
        tr.appendChild(makeTextCell(normalizeJobTitle(staff), false));

        var dirTd = document.createElement("td");
        var currentDir = getMonthShiftDir(staff, ym);
        if (leader) {
          var selDir = document.createElement("select");
          selDir.className = "inline-select";
          var optDep = document.createElement("option");
          optDep.value = "DEP";
          optDep.textContent = "DEP";
          var optArr = document.createElement("option");
          optArr.value = "ARR";
          optArr.textContent = "ARR";
          selDir.appendChild(optDep);
          selDir.appendChild(optArr);
          selDir.value = currentDir;
          selDir.addEventListener("change", function () {
            setMonthShiftDir(staff, ym, selDir.value);
          });
          dirTd.appendChild(selDir);
        } else {
          dirTd.textContent = currentDir;
        }
        tr.appendChild(dirTd);

        var workTd = document.createElement("td");
        workTd.innerHTML = "<strong>" + workDays.length + " ngày</strong><br><span class='small-muted'>" +
          (workDays.length ? workDays.join(", ") : "-") + "</span>";
        tr.appendChild(workTd);

        var offTd = document.createElement("td");
        offTd.innerHTML = "<strong>" + offDays.length + " ngày</strong><br><span class='small-muted'>" +
          (offDays.length ? offDays.join(", ") : "-") + "</span><br>";
        offTd.appendChild(box);
        tr.appendChild(offTd);

        tbody.appendChild(tr);
      })(staffList[i]);
    }
  }

  var btnReloadMonth = document.getElementById("btnReloadMonth");
  if (btnReloadMonth) {
    btnReloadMonth.addEventListener("click", loadMonthTab);
  }
  if (workMonthEl) {
    workMonthEl.addEventListener("change", loadMonthTab);
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      var client = getClient();
      var savedId = sessionStorage.getItem("loggedInStaffId");
      if (client && savedId) {
        client
          .from("profiles")
          .select("*")
          .eq("id", savedId)
          .eq("is_active", true)
          .maybeSingle()
          .then(function (res) {
            if (res && res.data) {
              showAppView(res.data);
            } else {
              showLoginView();
            }
          });
      } else {
        showLoginView();
      }
    }, 50);
  });
})();
