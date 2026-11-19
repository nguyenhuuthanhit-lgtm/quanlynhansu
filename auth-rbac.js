(function () {
  function setLoginStatus(msg, isError = false) {
    let statusEl = document.getElementById('loginStatusMsg');
    if (!statusEl) {
      const form = document.getElementById('loginForm');
      if (!form) return;
      statusEl = document.createElement('div');
      statusEl.id = 'loginStatusMsg';
      statusEl.style.marginTop = '10px';
      statusEl.style.fontSize = '0.85rem';
      statusEl.style.textAlign = 'center';
      form.appendChild(statusEl);
    }
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#c0392b' : '#0f4c81';
  }

  function getSupabaseConfig() {
    const url =
      (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) ||
      (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) ||
      '';
    const key =
      (typeof SUPABASE_ANON_KEY !== 'undefined' && SUPABASE_ANON_KEY) ||
      (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.anonKey) ||
      '';
    return { url, key };
  }

  let supabaseClient = null;
  window.currentUser = null;
  window.currentProfile = null;

  function showLogin() {
    const loginSec = document.getElementById('loginSection');
    const appSec = document.getElementById('appSection');
    if (loginSec) loginSec.style.display = 'flex';
    if (appSec) appSec.style.display = 'none';
  }

  function showApp() {
    const loginSec = document.getElementById('loginSection');
    const appSec = document.getElementById('appSection');
    if (loginSec) loginSec.style.display = 'none';
    if (appSec) appSec.style.display = 'block';
  }

  async function loadUserProfile(user) {
    setLoginStatus('Đang kiểm tra hồ sơ tài khoản...');
    let profileData = null;

    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('Cảnh báo khi đọc profiles:', error.message);
      } else {
        profileData = data;
      }
    } catch (err) {
      console.warn('Lỗi truy vấn profiles:', err);
    }

    window.currentUser = user;
    window.currentProfile = profileData || {
      id: user.id,
      full_name: user.email,
      role: 'shift_leader'
    };

    const infoEl = document.getElementById('currentUserInfo');
    if (infoEl) {
      const roleText = window.currentProfile.role === 'shift_leader' ? 'Ca trưởng' : 'Nhân viên';
      infoEl.textContent = `Tài khoản: ${window.currentProfile.full_name || user.email} (${roleText})`;
    }

    showApp();
    setLoginStatus('');

    if (typeof window.loadDashboardData === 'function') {
      await window.loadDashboardData();
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const { url, key } = getSupabaseConfig();

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      setLoginStatus('Lỗi: Chưa tải được thư viện Supabase JS. Kiểm tra kết nối mạng.', true);
      return;
    }

    if (!url || !key) {
      setLoginStatus('Lỗi: Thiếu SUPABASE_URL hoặc SUPABASE_ANON_KEY trong config.js.', true);
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(url, key);
      window.supabaseClient = supabaseClient;
    } catch (err) {
      setLoginStatus('Lỗi khởi tạo Supabase: ' + err.message, true);
      return;
    }

    // Kiểm tra phiên đăng nhập hiện có
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (!error && session && session.user) {
        await loadUserProfile(session.user);
      } else {
        showLogin();
      }
    } catch (err) {
      showLogin();
      setLoginStatus('Không kiểm tra được phiên cũ: ' + err.message, true);
    }

    // Xử lý submit form đăng nhập
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('loginEmail');
        const passInput = document.getElementById('loginPassword');
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passInput ? passInput.value : '';

        if (!email || !password) {
          setLoginStatus('Vui lòng nhập đầy đủ Email và Mật khẩu.', true);
          return;
        }

        setLoginStatus('Đang đăng nhập...');
        try {
          const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
          });

          if (error) {
            setLoginStatus('Đăng nhập thất bại: ' + error.message, true);
            return;
          }

          if (data && data.user) {
            await loadUserProfile(data.user);
          } else {
            setLoginStatus('Không nhận được thông tin người dùng sau khi đăng nhập.', true);
          }
        } catch (err) {
          setLoginStatus('Lỗi kết nối khi đăng nhập: ' + err.message, true);
        }
      });
    }

    // Xử lý đăng xuất
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        if (supabaseClient) {
          await supabaseClient.auth.signOut();
        }
        showLogin();
        setLoginStatus('Đã đăng xuất.');
      });
    }
  });
})();
