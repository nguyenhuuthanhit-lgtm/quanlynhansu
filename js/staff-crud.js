// =========================================================================
// [COMPONENT: js/staff-crud.js] QUẢN LÝ NHÂN SỰ & THÔNG TIN CÁ NHÂN
// =========================================================================
(function (global) {
  var Core = global.AppCore;

  function getStaffGroupValue(staff) {
    if (!staff) return "";
    if (staff.shift_group !== null && staff.shift_group !== undefined && String(staff.shift_group).trim() !== "") {
      return String(staff.shift_group).trim();
    }
    if (staff.team_id !== null && staff.team_id !== undefined && String(staff.team_id).trim() !== "") {
      return String(staff.team_id).trim();
    }
    return "";
  }

  function toSafeIntegerGroup(selectedValue) {
    if (global.AppTeams && typeof global.AppTeams.getTeamNumberById === "function") {
      var mapped = global.AppTeams.getTeamNumberById(selectedValue);
      if (Number.isInteger(mapped) && mapped >= 1) return mapped;
    }
    var n = Number(selectedValue);
    if (Number.isInteger(n) && n >= 1) return n;
    return null;
  }

  function renderMyPersonalCard() {
    var grid = document.getElementById("myPersonalGrid");
    var s = global.currentStaff;
    if (!grid || !s) return;
    var teamName = (global.AppTeams && global.AppTeams.getTeamNameById)
      ? global.AppTeams.getTeamNameById(getStaffGroupValue(s))
      : "Chưa phân tổ";
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
    document.getElementById("editStaffId").value = String(staff.id || "");
    document.getElementById("editEmpCode").value = staff.employee_code || "";
    document.getElementById("editFullName").value = staff.full_name || "";
    document.getElementById("editJobTitle").value = Core.normalizeJobTitle(staff);

    var selGroup = document.getElementById("editShiftGroup");
    var currentNum = toSafeIntegerGroup(getStaffGroupValue(staff));

    if (selGroup) {
      var matched = false;
      for (var i = 0; i < selGroup.options.length; i++) {
        var optVal = selGroup.options[i].value;
        if (currentNum !== null && toSafeIntegerGroup(optVal) === currentNum) {
          selGroup.value = optVal;
          matched = true;
          break;
        }
      }
      if (!matched && selGroup.options.length > 0) {
        selGroup.value = selGroup.options[0].value;
      }
    }

    document.getElementById("editRole").value = staff.role || "staff";
    if (editModal) editModal.classList.add("open");
  }

  var editStaffForm = document.getElementById("editStaffForm");
  if (editStaffForm) {
    editStaffForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var client = Core && typeof Core.getClient === "function" ? Core.getClient() : null;
      if (!client) return alert("Chưa kết nối Supabase");

      var id = String(document.getElementById("editStaffId").value || "").trim();
      var code = document.getElementById("editEmpCode").value.trim().toUpperCase();
      var name = document.getElementById("editFullName").value.trim();
      var jobTitle = document.getElementById("editJobTitle").value;
      var groupRaw = String(document.getElementById("editShiftGroup").value || "").trim();
      var role = document.getElementById("editRole").value || "staff";

      if (!id || !code || !name) return alert("Vui lòng nhập đủ Mã NV và Họ tên.");

      var groupInt = toSafeIntegerGroup(groupRaw);

      client
        .from("profiles")
        .update({
          employee_code: code,
          full_name: name,
          job_title: jobTitle,
          experience_years: Core.expFromJobTitle(jobTitle),
          shift_group: groupInt,
          role: role
        })
        .eq("id", id)
        .select()
        .then(function (res) {
          if (res.error) {
            return alert("Lỗi cập nhật nhân viên: " + res.error.message);
          }
          if (global.rosterState && Array.isArray(global.rosterState.staffList)) {
            for (var i = 0; i < global.rosterState.staffList.length; i++) {
              if (String(global.rosterState.staffList[i].id) === id) {
                global.rosterState.staffList[i] = Object.assign({}, global.rosterState.staffList[i], {
                  employee_code: code,
                  full_name: name,
                  job_title: jobTitle,
                  experience_years: Core.expFromJobTitle(jobTitle),
                  shift_group: groupInt,
                  role: role
                });
              }
            }
          }
          if (editModal) editModal.classList.remove("open");
          renderStaffList();
          if (global.AppTabs && global.AppTabs.loadDashboardData) global.AppTabs.loadDashboardData();
        });
    });
  }

  function renderStaffList() {
    var tbody = document.getElementById("staffListBody");
    if (!tbody || !global.rosterState) return;
    tbody.innerHTML = "";
    var list = global.rosterState.staffList || [];
    var canManage = Core && typeof Core.isShiftLeader === "function" ? Core.isShiftLeader() : false;

    for (var i = 0; i < list.length; i++) {
      (function (s) {
        var groupVal = getStaffGroupValue(s);
        var teamName = (global.AppTeams && global.AppTeams.getTeamNameById)
          ? global.AppTeams.getTeamNameById(groupVal)
          : "Chưa phân tổ";

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
          btnEdit.addEventListener("click", function () { openEditStaffModal(s); });

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
                if (global.AppTabs && global.AppTabs.loadDashboardData) global.AppTabs.loadDashboardData();
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
                if (global.AppTabs && global.AppTabs.loadDashboardData) global.AppTabs.loadDashboardData();
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
      var client = Core && typeof Core.getClient === "function" ? Core.getClient() : null;
      if (!client) return alert("Chưa kết nối Supabase");

      var code = document.getElementById("empCode").value.trim().toUpperCase();
      var name = document.getElementById("fullName").value.trim();
      var jobTitle = document.getElementById("empJobTitle").value;
      var groupRaw = String(document.getElementById("shiftGroupInput").value || "").trim();
      var role = document.getElementById("roleInput").value || "staff";

      if (!code || !name) return alert("Nhập đủ Mã NV và Tên nhân sự");

      client
        .from("profiles")
        .insert({
          employee_code: code,
          full_name: name,
          job_title: jobTitle,
          experience_years: Core.expFromJobTitle(jobTitle),
          shift_group: toSafeIntegerGroup(groupRaw),
          base_shift_type: "DEP",
          role: role,
          auth_password: "12345",
          must_change_password: true,
          is_active: true
        })
        .select()
        .then(function (res) {
          if (res.error) return alert("Lỗi thêm nhân viên: " + res.error.message);
          staffForm.reset();
          if (global.AppTeams && global.AppTeams.renderTeamSelectors) global.AppTeams.renderTeamSelectors();
          if (global.AppTabs && global.AppTabs.loadDashboardData) global.AppTabs.loadDashboardData();
        });
    });
  }

  global.AppStaffCrud = {
    renderMyPersonalCard: renderMyPersonalCard,
    renderStaffList: renderStaffList
  };
})(window);