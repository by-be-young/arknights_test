// Supabase 配置
const SUPABASE_URL = 'https://kfbtgndqlecpgknxtreo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmYnRnbmRxbGVjcGdrbnh0cmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTYzOTEsImV4cCI6MjA3NTMzMjM5MX0.AtOtnL-4jurWpuMuEbQCUcok6GVQ8QXzvNiTtOHNJeQ';

// 初始化 Supabase 客户端
function initSupabase() {
    if (typeof supabase !== 'undefined') {
        window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase 初始化成功');

        // 触发认证管理器初始化
        if (window.authManager) {
            window.authManager.init();
        }
    } else {
        console.error('Supabase 库未加载');
    }
}

// 如果 supabase 已经加载，立即初始化
if (typeof supabase !== 'undefined') {
    initSupabase();
} else {
    // 监听加载完成事件
    document.addEventListener('DOMContentLoaded', function () {
        // 给一点延迟确保库完全加载
        setTimeout(initSupabase, 100);
    });
}

// 提供全局访问方法
window.getSupabase = function () {
    return window._supabase;
};

window.SUPABASE_CONFIG = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY
};
