// =========================================================================
// [COMPONENT: js/auth.js] ĐĂNG NHẬP, ĐĂNG XUẤT & ĐỔI MẬT KHẨU
// =========================================================================
(function (global) {
  var Core = global.AppCore;

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

    if (global.AppStatsRole && global.AppStatsRole.applyRoleLabelsAndVisibility) {
      global.AppStatsRole.applyRoleLabelsAndVisibility();
    }

    var loadTeamsFn = (global.AppTeams && global.AppTeams.loadTeams)
      ? global.AppTeams.loadTeams()
      : Promise.resolve();

    loadTeamsFn.then(function () {
      if (global.AppTabs && global.AppTabs.loadDashboardData) {
        return global.AppTabs.loadDashboardData();
      }
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
      if (!client) return setLoginMsg("Chưa khởi tạo được kết nối Supabase.", true);

      var codeInput = document.getElementById("loginUserInput").value.trim().toUpperCase();
      var passInput = document.getElementById("loginPasswordInput").value;
      if (!codeInput || !passInput) return setLoginMsg("Vui lòng nhập mã nhân viên và mật khẩu.", true);

      setLoginMsg("Đang kiểm tra tài khoản...", false);
      client
        .from("profiles")
        .select("*")
        .eq("employee_code", codeInput)
        .eq("is_active", true)
        .maybeSingle()
        .then(function (res) {
          if (res.error) return setLoginMsg("Lỗi truy vấn: " + res.error.message, true);
          var staff = res.data;
          if (!staff) return setLoginMsg("Không tìm thấy mã nhân viên hoặc tài khoản đã bị khóa.", true);
          if (passInput !== (staff.auth_password || "12345")) return setLoginMsg("Sai mật khẩu.", true);

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
      if (p1 !== p2) return alert("Mật khẩu nhập lại không khớp.");

      client
        .from("profiles")
        .update({ auth_password: p1, must_change_password: false })
        .eq("id", global.currentStaff.id)
        .select()
        .single()
        .then(function (res) {
          if (res.error) return alert("Lỗi đổi mật khẩu: " + res.error.message);
          global.currentStaff = res.data;
          changePassForm.reset();
          if (passModal) passModal.classList.remove("open");
          alert("Đã cập nhật mật khẩu thành công.");
          if (global.AppTabs && global.AppTabs.loadDashboardData) global.AppTabs.loadDashboardData();
        });
    });
  }

  global.AppAuth = {
    showLoginView: showLoginView,
    showAppView: showAppView
  };
})(window);
