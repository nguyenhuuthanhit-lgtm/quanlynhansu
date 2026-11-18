// auth-rbac.js
const AuthManager = {
    currentUser: null,
    currentProfile: null,

    async init() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            this.currentUser = session.user;
            await this.loadProfile();
            return true;
        }
        return false;
    },

    async login(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        this.currentUser = data.user;
        await this.loadProfile();
        return this.currentProfile;
    },

    async logout() {
        await supabaseClient.auth.signOut();
        this.currentUser = null;
        this.currentProfile = null;
        window.location.reload();
    },

    async loadProfile() {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*, teams(name)')
            .eq('id', this.currentUser.id)
            .single();
        if (error) throw error;
        this.currentProfile = data;
        return data;
    },

    // Kiểm tra quyền hạn chi tiết (Ca trưởng mặc định có toàn quyền)
    hasPermission(permKey) {
        if (!this.currentProfile) return false;
        if (this.currentProfile.role === 'shift_leader') return true;
        return Boolean(this.currentProfile.permissions?.[permKey]);
    }
};
