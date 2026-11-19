let currentUser = null;
let currentProfile = null;

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('appSection').classList.add('hidden');
    return null;
  }
  currentUser = session.user;
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error) {
    alert('Lỗi tải hồ sơ: ' + error.message);
    return null;
  }

  currentProfile = profile || { full_name: currentUser.email, role: 'shift_leader' };
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('appSection').classList.remove('hidden');

  const isLeader = currentProfile.role === 'shift_leader';
  document.getElementById('userInfoBadge').textContent =
    `${currentProfile.full_name} — ${isLeader ? 'Ca trưởng (Toàn quyền nhập liệu)' : 'Nhân viên (Chỉ xem)'}`;

  if (!isLeader) {
    document.getElementById('shiftLeaderPanel').classList.add('hidden');
  } else {
    document.getElementById('shiftLeaderPanel').classList.remove('hidden');
  }
  return currentProfile;
}

async function loginWithEmail(email, password) {
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await checkSession();
}

async function logoutUser() {
  await supabaseClient.auth.signOut();
  location.reload();
}
