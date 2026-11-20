(function () {
  var now = new Date();
  var todayStr = now.toISOString().slice(0, 10);
  var monthStr = todayStr.slice(0, 7);

  var workDateEl = document.getElementById("workDate");
  var workMonthEl = document.getElementById("workMonth");

  if (workDateEl && !workDateEl.value) workDateEl.value = todayStr;
  if (workMonthEl && !workMonthEl.value) workMonthEl.value = monthStr;

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

    var formCard = document.getElementById("staffFormCard");
    if (formCard) {
      formCard.style.display = isShiftLeader() ? "block" : "none";
    }

    window.loadDashboardData().then(function () {
      if (staffRec.must_change_password) {
        openChangePassModal("Bạn đang đăng nhập lần đầu bằng mật khẩu mặc định 12345. Vui lòng đổi mật khẩu mới.");
      }
    });
  }

  // Đăng nhập bằng Mã NV + mật khẩu (mặc định 12345)
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

  // Đổi mật khẩu (lần đầu hoặc chủ động đổi)
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

  // Chuyển đổi 3 tab
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
      renderStaffList();
      renderStaffDropdown();
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

  // TAB 1: THÔNG TIN NHÂN SỰ (Thêm / Sửa / Xóa / Reset MK 12345)
  var editModal = document.getElementById("editStaffModal");
  var btnCloseEditModal = document.getElementById("btnCloseEditModal");
  if (btnCloseEditModal) {
    btnCloseEditModal.addEventListener("click", function () {
      if (editModal) editModal.classList.remove("open");
    });
  }

  function openEditStaffModal(staff) {
    document.getElementById("editStaffId").value = staff.id;
    document.getElementById("editEmpCode").value = staff.employee_code || "";
    document.getElementById("editFullName").value = staff.full_name || "";
    document.getElementById("editJobTitle").value = normalizeJobTitle(staff);
    document.getElementById("editShiftGroup").value = String(staff.shift_group || 1);
    document.getElementById("editBaseShift").value = staff.base_shift_type || "DEP";
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
      var group = Number(document.getElementById("editShiftGroup").value || 1);
      var baseShift = document.getElementById("editBaseShift").value || "DEP";
      var role = document.getElementById("editRole").value || "staff";

      client
        .from("profiles")
        .update({
          employee_code: code,
          full_name: name,
          job_title: jobTitle,
          experience_years: expFromJobTitle(jobTitle),
          shift_group: group,
          base_shift_type: baseShift,
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
        tr.appendChild(makeTextCell("Tổ " + (s.shift_group || 1), false));
        tr.appendChild(makeTextCell(s.base_shift_type || "DEP", false));
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
      var group = Number(document.getElementById("shiftGroupInput").value || 1);
      var baseShift = document.getElementById("baseShiftInput").value || "DEP";
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
          base_shift_type: baseShift,
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
          window.loadDashboardData();
        });
    });
  }

  // TAB 2: CẮT LỊCH TRONG NGÀY
  function isOffDay(staffId, rec) {
    var leaves = (window.rosterState && window.rosterState.leavesByStaff) || {};
    return Boolean((rec && rec.is_day_off) || leaves[staffId]);
  }

  function renderStaffDropdown() {
    var sel = document.getElementById("offStaffSelect");
    if (!sel || !window.rosterState) return;
    sel.innerHTML = "";
    var list = window.rosterState.staffList || [];

    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = (s.full_name || "") + " (" + normalizeJobTitle(s) + ")";
      sel.appendChild(opt);
    }
  }

  function renderDaySchedule() {
    var tbody = document.getElementById("scheduleBody");
    if (!tbody || !window.rosterState) return;
    tbody.innerHTML = "";

    var date = getSelectedDate();
    var list = window.rosterState.staffList || [];

    for (var i = 0; i < list.length; i++) {
      (function (staff) {
        var rec = window.getOrCreateRoster(staff.id, date);
        var off = isOffDay(staff.id, rec);
        var tr = document.createElement("tr");

        tr.appendChild(makeTextCell(staff.full_name || "", true));
        tr.appendChild(makeTextCell(normalizeJobTitle(staff), false));

        var timeTd = document.createElement("td");
        var timeInput = document.createElement("input");
        timeInput.type = "text";
        timeInput.value = off ? "OFF" : (rec.work_hours || "06:00-18:00");
        timeInput.disabled = off;
        timeInput.style.width = "120px";
        timeInput.addEventListener("change", function () {
          rec.work_hours = timeInput.value;
        });
        timeTd.appendChild(timeInput);
        tr.appendChild(timeTd);

        var posTd = document.createElement("td");
        var s1 = document.createElement("input");
        s1.type = "text";
        s1.placeholder = "Ca 1";
        s1.value = rec.shift_1 || "";
        s1.disabled = off;
        s1.style.width = "95px";
        s1.style.marginRight = "4px";
        s1.addEventListener("change", function () { rec.shift_1 = s1.value; });

        var s2 = document.createElement("input");
        s2.type = "text";
        s2.placeholder = "Ca 2";
        s2.value = rec.shift_2 || "";
        s2.disabled = off;
        s2.style.width = "95px";
        s2.style.marginRight = "4px";
        s2.addEventListener("change", function () { rec.shift_2 = s2.value; });

        posTd.appendChild(s1);
        posTd.appendChild(s2);

        var extraArr = rec.extra_shifts || [];
        for (var j = 0; j < extraArr.length; j++) {
          (function (idx) {
            var ex = document.createElement("input");
            ex.type = "text";
            ex.placeholder = "Ca " + (idx + 3);
            ex.value = extraArr[idx] || "";
            ex.disabled = off;
            ex.style.width = "85px";
            ex.style.marginLeft = "4px";
            ex.addEventListener("change", function () { rec.extra_shifts[idx] = ex.value; });
            posTd.appendChild(ex);
          })(j);
        }

        var addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "btn-primary btn-sm";
        addBtn.textContent = "+ Ca";
        addBtn.disabled = off;
        addBtn.style.marginLeft = "4px";
        addBtn.addEventListener("click", function () {
          if (!Array.isArray(rec.extra_shifts)) rec.extra_shifts = [];
          rec.extra_shifts.push("");
          renderDaySchedule();
        });
        posTd.appendChild(addBtn);
        tr.appendChild(posTd);

        var restTd = document.createElement("td");
        if (off) {
          var badge = document.createElement("span");
          badge.className = "badge-off";
          badge.textContent = "OFF CẢ NGÀY";
          restTd.appendChild(badge);
        } else {
          var slots = rec.break_off_slots || [];
          restTd.textContent = slots.length ? slots.join(", ") : "Không nghỉ";
        }
        tr.appendChild(restTd);

        var actTd = document.createElement("td");
        var btnOff = document.createElement("button");
        btnOff.type = "button";
        btnOff.className = "btn-warning btn-sm";
        btnOff.textContent = off ? "Mở làm lại" : "Cắt OFF";
        btnOff.addEventListener("click", function () {
          rec.is_day_off = !rec.is_day_off;
          var p = (typeof window.upsertSingleRoster === "function")
            ? window.upsertSingleRoster(rec)
            : Promise.resolve();
          p.then(renderDaySchedule);
        });
        actTd.appendChild(btnOff);
        tr.appendChild(actTd);

        tbody.appendChild(tr);
      })(list[i]);
    }
  }

  var btnCutTimeOff = document.getElementById("btnCutTimeOff");
  if (btnCutTimeOff) {
    btnCutTimeOff.addEventListener("click", function () {
      var client = getClient();
      if (!client) return;
      var staffId = document.getElementById("offStaffSelect").value;
      var start = document.getElementById("offStart").value;
      var end = document.getElementById("offEnd").value;
      var date = getSelectedDate();

      if (!staffId || !start || !end) return alert("Chọn nhân sự và nhập đủ giờ bắt đầu, kết thúc");

      var rec = window.getOrCreateRoster(staffId, date);
      if (!Array.isArray(rec.break_off_slots)) rec.break_off_slots = [];
      rec.break_off_slots.push(start + "-" + end);

      var p = (typeof window.upsertSingleRoster === "function")
        ? window.upsertSingleRoster(rec)
        : Promise.resolve();
      p.then(renderDaySchedule);
    });
  }

  var btnCutDayOff = document.getElementById("btnCutDayOff");
  if (btnCutDayOff) {
    btnCutDayOff.addEventListener("click", function () {
      var client = getClient();
      if (!client) return;
      var staffId = document.getElementById("offStaffSelect").value;
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
        alert("Đã lưu lịch ngày " + getSelectedDate());
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

  // TAB 3: CẮT LỊCH TRONG THÁNG
  function renderMonthSchedule() {
    var tbody = document.getElementById("monthScheduleBody");
    if (!tbody || !window.rosterState) return;
    tbody.innerHTML = "";

    var ym = getSelectedMonth();
    var parts = ym.split("-");
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var totalDays = new Date(y, m, 0).getDate();

    var staffList = window.rosterState.staffList || [];
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
            chip.className = "day-chip " + (isOff ? "day-off" : "day-work");
            chip.textContent = dd;
            chip.title = fullDate + (isOff ? " (OFF)" : " (Làm)");
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
            box.appendChild(chip);
          })(d);
        }

        var tr = document.createElement("tr");
        tr.appendChild(makeTextCell(staff.full_name || "", true));
        tr.appendChild(makeTextCell(normalizeJobTitle(staff), false));

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

  // Tự khôi phục phiên đăng nhập nếu đã lưu trong sessionStorage
  document.addEventListener("DOMContentLoaded", function () {
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
  });
})();