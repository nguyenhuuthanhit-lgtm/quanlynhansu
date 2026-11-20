// =========================================================================
// [COMPONENT: js/tabs.js] CHUYỂN TAB, TẢI DỮ LIỆU & KHỞI ĐỘNG ỨNG DỤNG
// =========================================================================
(function (global) {
  var Core = global.AppCore;

  function loadDashboardData() {
    if (!Core || !Core.getClient()) return Promise.resolve();
    var date = Core.getSelectedDate();
    var task = (typeof global.fetchDailySchedule === "function")
      ? global.fetchDailySchedule(date)
      : Promise.resolve();

    return Promise.resolve(task).then(function () {
      if (global.AppDayRest && global.AppDayRest.syncSlotsToRosters) {
        global.AppDayRest.syncSlotsToRosters(date);
      }
      if (global.AppStaffCrud && global.AppStaffCrud.renderMyPersonalCard) {
        global.AppStaffCrud.renderMyPersonalCard();
      }
      if (global.AppStaffCrud && global.AppStaffCrud.renderStaffList) {
        global.AppStaffCrud.renderStaffList();
      }
      if (global.AppDaySlots && global.AppDaySlots.renderPositionSlotSelectorsAndCards) {
        global.AppDaySlots.renderPositionSlotSelectorsAndCards();
      }
      if (global.AppDayRest && global.AppDayRest.renderDaySchedule) {
        global.AppDayRest.renderDaySchedule();
      }
      if (global.AppStatsRole && global.AppStatsRole.refreshStatsWithFallback) {
        return global.AppStatsRole.refreshStatsWithFallback();
      }
      if (global.AppStatsRole && global.AppStatsRole.renderPanelStats) {
        global.AppStatsRole.renderPanelStats();
      }
    });
  }

  function loadMonthTab() {
    if (!Core || !Core.getClient()) return Promise.resolve();
    var ym = Core.getSelectedMonth();
    var task = (typeof global.fetchMonthlySchedule === "function")
      ? global.fetchMonthlySchedule(ym)
      : Promise.resolve();

    return Promise.resolve(task).then(function () {
      if (global.AppMonthSchedule && global.AppMonthSchedule.renderMonthSchedule) {
        global.AppMonthSchedule.renderMonthSchedule();
      }
      if (global.AppStatsRole && global.AppStatsRole.refreshStatsWithFallback) {
        return global.AppStatsRole.refreshStatsWithFallback();
      }
      if (global.AppStatsRole && global.AppStatsRole.renderPanelStats) {
        global.AppStatsRole.renderPanelStats();
      }
    });
  }

  global.loadDashboardData = loadDashboardData;
  global.loadMonthTab = loadMonthTab;

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
        if (targetId === "tabMonth") loadMonthTab();
        else loadDashboardData();
      });
    })(tabButtons[t]);
  }

  if (Core && Core.workDateEl) {
    Core.workDateEl.addEventListener("change", function () {
      loadDashboardData();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      var client = Core ? Core.getClient() : null;
      var savedId = sessionStorage.getItem("loggedInStaffId");
      if (client && savedId && global.AppAuth) {
        client
          .from("profiles")
          .select("*")
          .eq("id", savedId)
          .eq("is_active", true)
          .maybeSingle()
          .then(function (res) {
            if (res && res.data) global.AppAuth.showAppView(res.data);
            else global.AppAuth.showLoginView();
          });
      } else if (global.AppAuth) {
        global.AppAuth.showLoginView();
      }
    }, 50);
  });

  global.AppTabs = {
    loadDashboardData: loadDashboardData,
    loadMonthTab: loadMonthTab
  };
})(window);
