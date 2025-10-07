// 认证相关功能
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        // 检查当前会话
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            this.currentUser = session.user;
            await this.loadUserProfile();
        }
        this.updateUI();
    }

    async loadUserProfile() {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', this.currentUser.id)
            .single();

        if (data && !error) {
            this.currentUser.profile = data;
        }
    }

    async register(username, password) {
        try {
            // 首先检查用户名是否已存在
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .single();

            if (existingUser) {
                throw new Error('用户名已存在');
            }

            // 注册用户
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: `${username}@doctor-assessment.com`, // 使用虚拟邮箱
                password: password,
            });

            if (authError) throw authError;

            // 检查是否是第一个用户（管理员）
            const { data: userCount } = await supabase
                .from('users')
                .select('id', { count: 'exact' });

            const isAdmin = userCount.length === 0;

            // 创建用户资料
            const { error: profileError } = await supabase
                .from('users')
                .insert([
                    {
                        id: authData.user.id,
                        username: username,
                        password_hash: password, // 注意：实际应用中应该哈希密码
                        is_admin: isAdmin
                    }
                ]);

            if (profileError) throw profileError;

            this.currentUser = authData.user;
            await this.loadUserProfile();
            this.updateUI();

            return { success: true, message: '注册成功' + (isAdmin ? '，您已成为管理员' : '') };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async login(username, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: `${username}@doctor-assessment.com`,
                password: password
            });

            if (error) throw error;

            this.currentUser = data.user;
            await this.loadUserProfile();
            this.updateUI();

            return { success: true };
        } catch (error) {
            return { success: false, message: '用户名或密码错误' };
        }
    }

    async logout() {
        await supabase.auth.signOut();
        this.currentUser = null;
        this.updateUI();
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    isAdmin() {
        return this.currentUser && this.currentUser.profile && this.currentUser.profile.is_admin;
    }

    updateUI() {
        const authElements = document.querySelectorAll('.auth-only');
        const unauthElements = document.querySelectorAll('.unauth-only');
        const adminElements = document.querySelectorAll('.admin-only');

        if (this.isLoggedIn()) {
            authElements.forEach(el => el.style.display = 'block');
            unauthElements.forEach(el => el.style.display = 'none');

            if (this.isAdmin()) {
                adminElements.forEach(el => el.style.display = 'block');
            } else {
                adminElements.forEach(el => el.style.display = 'none');
            }

            // 更新用户信息显示
            const userInfoElements = document.querySelectorAll('.user-info');
            userInfoElements.forEach(el => {
                el.innerHTML = `
                    <div class="user-avatar">
                        <i class="fas fa-user-md"></i>
                    </div>
                    <span>${this.currentUser.profile.username}</span>
                    ${this.isAdmin() ? '<span class="admin-badge">管理员</span>' : ''}
                `;
            });
        } else {
            authElements.forEach(el => el.style.display = 'none');
            unauthElements.forEach(el => el.style.display = 'block');
            adminElements.forEach(el => el.style.display = 'none');
        }
    }
}

// 创建全局认证管理器实例
window.authManager = new AuthManager();