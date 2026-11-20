// =========================================================================
// [COMPONENT: js/staff-crud.js] QUẢN LÝ NHÂN SỰ & THÔNG TIN CÁ NHÂN
// =========================================================================
(function (global) {
  var Core = global.AppCore;

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
          if (res.error) return alert("Lỗi cập nhật nhân viên: " + res.error.message);
          if (editModal) editModal.classList.remove("open");
          if (global.AppTabs && global.AppTabs.loadDashboardData) global.AppTabs.loadDashboardData();
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
