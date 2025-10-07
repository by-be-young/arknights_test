// 认证相关功能
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;

        const supabase = window.getSupabase();
        if (!supabase) {
            console.log('等待 Supabase 初始化...');
            setTimeout(() => this.init(), 100);
            return;
        }

        try {
            // 检查当前会话
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;

            if (session) {
                this.currentUser = session.user;
                await this.loadUserProfile();
            }
            this.updateUI();
            this.isInitialized = true;
            console.log('认证管理器初始化完成');
        } catch (error) {
            console.error('认证初始化失败:', error);
        }
    }

    async loadUserProfile() {
        const supabase = window.getSupabase();
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', this.currentUser.id)
            .single();

        if (data && !error) {
            this.currentUser.profile = data;
        } else if (error) {
            console.error('加载用户资料失败:', error);
        }
    }

    async register(username, password) {
        try {
            const supabase = window.getSupabase();

            // 首先检查用户名是否已存在
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .single();

            if (existingUser && !checkError) {
                throw new Error('用户名已存在');
            }

            // 使用邮箱格式注册（Supabase 要求邮箱）
            const email = `${username}@qq.com`;

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
            });

            if (authError) throw authError;

            // 检查是否是第一个用户（管理员）
            const { data: userCount, error: countError } = await supabase
                .from('users')
                .select('id', { count: 'exact' });

            const isAdmin = !countError && userCount.length === 0;

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

            if (profileError) {
                // 如果创建资料失败，删除认证用户
                await supabase.auth.admin.deleteUser(authData.user.id);
                throw profileError;
            }

            this.currentUser = authData.user;
            await this.loadUserProfile();
            this.updateUI();

            return {
                success: true,
                message: '注册成功' + (isAdmin ? '，您已成为管理员' : ''),
                isAdmin: isAdmin
            };
        } catch (error) {
            console.error('注册失败:', error);
            return {
                success: false,
                message: error.message || '注册失败，请重试'
            };
        }
    }

    async login(username, password) {
        try {
            const supabase = window.getSupabase();
            const email = `${username}@qq.com`;

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            this.currentUser = data.user;
            await this.loadUserProfile();
            this.updateUI();

            return { success: true };
        } catch (error) {
            console.error('登录失败:', error);
            return {
                success: false,
                message: error.message || '用户名或密码错误'
            };
        }
    }

    async logout() {
        const supabase = window.getSupabase();
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

    getUsername() {
        return this.currentUser?.profile?.username || '用户';
    }

    updateUI() {
        // 给 Vue 一点时间来更新DOM
        setTimeout(() => {
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
                        <span>${this.getUsername()}</span>
                        ${this.isAdmin() ? '<span class="admin-badge" style="background: #FF7043; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-left: 8px;">管理员</span>' : ''}
                    `;
                });
            } else {
                authElements.forEach(el => el.style.display = 'none');
                unauthElements.forEach(el => el.style.display = 'block');
                adminElements.forEach(el => el.style.display = 'none');
            }
        }, 100);
    }
}

// 创建全局认证管理器实例
window.authManager = new AuthManager();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        window.authManager.init();
    }, 500);
});