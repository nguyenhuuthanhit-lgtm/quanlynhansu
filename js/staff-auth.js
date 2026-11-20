// =========================================================================
// [FILE: js/staff-auth.js] ĐĂNG NHẬP, ĐỔI MK, THỐNG KÊ, NHÂN SỰ & ĐIỀU PHỐI
// Điều phối tải dữ liệu giữa các tab và quản lý danh sách nhân sự.
// =========================================================================
(function (global) {
  var Core = global.AppCore;

  function isOffDay(staffId, rec) {
    var leaves = (global.rosterState && global.rosterState.leavesByStaff) || {};
    return Boolean((rec && rec.is_day_off) || leaves[staffId]);
  }

  function renderPanelStats() {
    var allStaff = (global.rosterState && global.rosterState.staffList) || [];
    var total = allStaff.length;
    var oldCount = 0;
    var newCount = 0;
    var offTodayCount = 0;
    var date = Core.getSelectedDate();

    for (var i = 0; i < allStaff.length; i++) {
      var s = allStaff[i];
      if (Core.normalizeJobTitle(s) === "Chính thức") {
        oldCount++;
      } else {
        newCount++;
      }
      var rec = (global.rosterState && global.rosterState.rostersByStaff)
        ? global.rosterState.rostersByStaff[s.id]
        : null;
      if (!rec && typeof global.getOrCreateRoster === "function") {
        rec = global.getOrCreateRoster(s.id, date);
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

  function applyRoleLabelsAndVisibility() {
    var leader = Core.isShiftLeader();

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
    global.currentStaff = staffRec;
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

    var loadTeamsFn = (global.AppTeams && global.AppTeams.loadTeams)
      ? global.AppTeams.loadTeams()
      : Promise.resolve();

    loadTeamsFn.then(function () {
      return global.loadDashboardData();
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
      var client = Core.getClient();
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
      global.currentStaff = null;
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
      var client = Core.getClient();
      if (!client || !global.currentStaff) return;

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
        .eq("id", global.currentStaff.id)
        .select()
        .single()
        .then(function (res) {
          if (res.error) {
            alert("Lỗi đổi mật khẩu: " + res.error.message);
            return;
          }
          global.currentStaff = res.data;
          changePassForm.reset();
          if (passModal) passModal.classList.remove("open");
          alert("Đã cập nhật mật khẩu thành công.");
          global.loadDashboardData();
        });
    });
  }

  function renderMyPersonalCard() {
    var grid = document.getElementById("myPersonalGrid");
    var s = global.currentStaff;
    if (!grid || !s) return;
    var teamName = (global.AppTeams && global.AppTeams.getTeamNameById)
      ? global.AppTeams.getTeamNameById(s.shift_group)
      : "";
    grid.innerHTML =
      '<div class="info-box"><div class="small-muted">Mã nhân viên</div><strong>' + (s.employee_code || "") + '</strong></div>' +
      '<div class="info-box"><div class="small-muted">Họ và tên</div><strong>' + (s.full_name || "") + '</strong></div>' +
      '<div class="info-box"><div class="small-muted">Chức danh</div><strong>' + Core.normalizeJobTitle(s) + '</strong></div>' +
      '<div class="info-box"><div class="small-muted">Tổ / Nhóm ca</div><strong>' + teamName + '</strong></div>';
  }

  var editModal = document.getElementById("editStaffModal");
  var btnCloseEditModal = document.getElementById("btnCloseEditModal");
  if (btnCloseEditModal) {
    btnCloseEditModal.addEventListener("click", function () {
      if (editModal) editModal.classList.remove("open");
    });
  }

  function openEditStaffModal(staff) {
    if (global.AppTeams && global.AppTeams.renderTeamSelectors) {
      global.AppTeams.renderTeamSelectors();
    }
    document.getElementById("editStaffId").value = staff.id;
    document.getElementById("editEmpCode").value = staff.employee_code || "";
    document.getElementById("editFullName").value = staff.full_name || "";
    document.getElementById("editJobTitle").value = Core.normalizeJobTitle(staff);
    document.getElementById("editShiftGroup").value = String(Core.parsePositiveInt(staff.shift_group, 1));
    document.getElementById("editRole").value = staff.role || "staff";
    if (editModal) editModal.classList.add("open");
  }

  var editStaffForm = document.getElementById("editStaffForm");
  if (editStaffForm) {
    editStaffForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var client = Core.getClient();
      if (!client) return;

      var id = document.getElementById("editStaffId").value;
      var code = document.getElementById("editEmpCode").value.trim().toUpperCase();
      var name = document.getElementById("editFullName").value.trim();
      var jobTitle = document.getElementById("editJobTitle").value;
      var group = Core.parsePositiveInt(document.getElementById("editShiftGroup").value, 1);
      var role = document.getElementById("editRole").value || "staff";

      client
        .from("profiles")
        .update({
          employee_code: code,
          full_name: name,
          job_title: jobTitle,
          experience_years: Core.expFromJobTitle(jobTitle),
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
          global.loadDashboardData();
        });
    });
  }

  function renderStaffList() {
    var tbody = document.getElementById("staffListBody");
    if (!tbody || !global.rosterState) return;
    tbody.innerHTML = "";
    var list = global.rosterState.staffList || [];
    var canManage = Core.isShiftLeader();

    for (var i = 0; i < list.length; i++) {
      (function (s) {
        var teamName = (global.AppTeams && global.AppTeams.getTeamNameById)
          ? global.AppTeams.getTeamNameById(s.shift_group)
          : "";

        var tr = document.createElement("tr");
        tr.appendChild(Core.makeTextCell(s.employee_code || "", true));
        tr.appendChild(Core.makeTextCell(s.full_name || "", false));
        tr.appendChild(Core.makeTextCell(Core.normalizeJobTitle(s), false));
        tr.appendChild(Core.makeTextCell(teamName, false));
        tr.appendChild(Core.makeTextCell(s.must_change_password ? "Chưa đổi" : "Đã đổi", false));

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
            Core.getClient()
              .from("profiles")
              .update({ auth_password: "12345", must_change_password: true })
              .eq("id", s.id)
              .then(function (res) {
                if (res.error) return alert("Lỗi reset mật khẩu: " + res.error.message);
                alert("Đã reset mật khẩu về 12345.");
                global.loadDashboardData();
              });
          });

          var btnDel = document.createElement("button");
          btnDel.type = "button";
          btnDel.className = "btn-danger btn-sm";
          btnDel.textContent = "Xóa";
          btnDel.addEventListener("click", function () {
            if (!confirm("Xóa nhân viên " + s.full_name + " (" + s.employee_code + ")?")) return;
            Core.getClient()
              .from("profiles")
              .delete()
              .eq("id", s.id)
              .then(function (res) {
                if (res.error) return alert("Lỗi xóa nhân viên: " + res.error.message);
                global.loadDashboardData();
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
      var client = Core.getClient();
      if (!client) return alert("Chưa kết nối Supabase");

      var code = document.getElementById("empCode").value.trim().toUpperCase();
      var name = document.getElementById("fullName").value.trim();
      var jobTitle = document.getElementById("empJobTitle").value;
      var group = Core.parsePositiveInt(document.getElementById("shiftGroupInput").value, 1);
      var role = document.getElementById("roleInput").value || "staff";

      if (!code || !name) return alert("Nhập đủ Mã NV và Tên nhân sự");

      client
        .from("profiles")
        .insert({
          employee_code: code,
          full_name: name,
          job_title: jobTitle,
          experience_years: Core.expFromJobTitle(jobTitle),
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
          if (global.AppTeams && global.AppTeams.renderTeamSelectors) {
            global.AppTeams.renderTeamSelectors();
          }
          global.loadDashboardData();
        });
    });
  }

  function loadMonthTab() {
    if (!Core.getClient()) return Promise.resolve();
    var ym = Core.getSelectedMonth();
    var task = (typeof global.fetchMonthlySchedule === "function")
      ? global.fetchMonthlySchedule(ym)
      : Promise.resolve();

    return task.then(function () {
      renderPanelStats();
      if (global.AppMonthSchedule && global.AppMonthSchedule.renderMonthSchedule) {
        global.AppMonthSchedule.renderMonthSchedule();
      }
    });
  }

  global.loadDashboardData = function () {
    if (!Core.getClient()) return Promise.resolve();
    var date = Core.getSelectedDate();
    var task = (typeof global.fetchDailySchedule === "function")
      ? global.fetchDailySchedule(date)
      : Promise.resolve();

    return task.then(function () {
      if (global.AppDaySchedule && global.AppDaySchedule.syncSlotsToRosters) {
        global.AppDaySchedule.syncSlotsToRosters(date);
      }
      renderPanelStats();
      renderMyPersonalCard();
      renderStaffList();
      if (global.AppDaySchedule && global.AppDaySchedule.renderPositionSlotSelectorsAndCards) {
        global.AppDaySchedule.renderPositionSlotSelectorsAndCards();
      }
      if (global.AppDaySchedule && global.AppDaySchedule.renderDaySchedule) {
        global.AppDaySchedule.renderDaySchedule();
      }
    });
  };

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
          global.loadDashboardData();
        }
      });
    })(tabButtons[t]);
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      var client = Core.getClient();
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

  global.AppStaff = {
    renderStaffList: renderStaffList,
    renderPanelStats: renderPanelStats,
    loadMonthTab: loadMonthTab
  };
})(window);
