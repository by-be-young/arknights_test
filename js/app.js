new Vue({
    el: '#app',
    data: {
        currentPage: 'index',
        practiceMode: 'type',
        sidebarOpen: false,
        categories: {},
        wrongCategories: {},
        currentQuestion: null,
        currentQuestionIndex: 0,
        selectedOption: null,
        showAnswer: false,
        questionHistory: [],
        randomHistory: [],
        randomCurrentIndex: -1,
        questionMode: '', // 'practice', 'random', 'jump', 'training', 'wrong'
        jumpQuestionId: '',

        showSystemNotice: false,
        systemNoticeTab: 'tips',
        selectedVersion: {},
        updateVersions: [],
        systemTips: '',

        // 入职培训相关
        trainingQuestions: [],
        trainingRecords: {},

        // 错题辑录相关
        wrongQuestions: [],

        // 后端相关
        rawQuestions: [],
        showAuthModal: false,
        authMode: 'login',
        authUsername: '',
        authPassword: '',
        questionStats: {}, // 存储题目统计信息
        examStats: { totalAttempts: 0, averageScore: 0 }, // 考试统计


        searchKeyword: '',
        searchResults: [],
        // 全服游戏统计（用于 SPA 游戏首页）
        globalGameStats: {
            totalAttempts: 0,
            globalAccuracy: 0,
            globalAvgHintsCorrect: 0,
            topAnswer: { name: null, count: 0 }
        },
    },
    computed: {
        hasPrevQuestion() {
            if (this.questionMode === 'practice') {
                return this.currentQuestionIndex > 0;
            } else if (this.questionMode === 'random') {
                return this.randomCurrentIndex > 0;
            } else if (this.questionMode === 'jump') {
                return this.currentQuestion && this.currentQuestion.id > 1;
            } else if (this.questionMode === 'training') {
                return this.getPrevTrainingQuestion() !== null;
            } else if (this.questionMode === 'wrong') {
                return this.getPrevWrongQuestion() !== null;
            }
            return false;
        },
        hasNextQuestion() {
            if (this.questionMode === 'practice') {
                return this.currentQuestionIndex < this.rawQuestions.length - 1;
            } else if (this.questionMode === 'random') {
                return true;
            } else if (this.questionMode === 'jump') {
                return this.currentQuestion && this.currentQuestion.id < this.rawQuestions.length;
            } else if (this.questionMode === 'training') {
                return this.getNextTrainingQuestion() !== null;
            } else if (this.questionMode === 'wrong') {
                return this.getNextWrongQuestion() !== null;
            }
            return false;
        },
        // 添加回答正确性判断
        isAnswerCorrect() {
            return this.selectedOption === this.currentQuestion.answer;
        },
        // 错题统计
        averageDifficulty() {
            if (this.wrongQuestions.length === 0) return 0;
            const sum = this.wrongQuestions.reduce((total, id) => {
                const question = this.rawQuestions.find(q => q.id === id);
                return total + (question ? question.difficulty : 0);
            }, 0);
            return sum / this.wrongQuestions.length;
        },
        mostWrongType() {
            if (this.wrongQuestions.length === 0) return '无';
            const typeCount = {};
            this.wrongQuestions.forEach(id => {
                const question = this.rawQuestions.find(q => q.id === id);
                if (question) {
                    const typeText = this.getTypeText(question.type);
                    typeCount[typeText] = (typeCount[typeText] || 0) + 1;
                }
            });
            return Object.keys(typeCount).reduce((a, b) =>
                typeCount[a] > typeCount[b] ? a : b
            );
        }
    },
    watch: {
        practiceMode() {
            this.updateCategories();
        }
    },
    async mounted() {
        try {
            await this.loadQuestions();
            this.updateCategories();

            // 立即加载培训题目
            await this.loadTrainingQuestions();
            console.log('培训题目数量:', this.trainingQuestions.length);

            // 确保界面更新
            this.$forceUpdate();

            this.loadTrainingRecords();
            this.loadWrongQuestions();
            this.loadSystemData();
            this.loadExamStats();

            // 设置加载完成标志
            this.trainingQuestionsLoaded = true;

            // 点击侧边栏外部关闭侧边栏
            document.addEventListener('click', (event) => {
                const sidebar = document.querySelector('.sidebar');
                const menuToggle = document.querySelector('.mobile-menu-toggle');

                if (this.sidebarOpen &&
                    sidebar &&
                    menuToggle &&
                    !sidebar.contains(event.target) &&
                    !menuToggle.contains(event.target)) {
                    this.sidebarOpen = false;
                }
            });

            // 监听登录后的重定向标记（当用户在弹窗登录成功后，会设置 window._postAuthRedirect）
            setInterval(() => {
                try {
                    const redirect = window._postAuthRedirect;
                    const hasUser = window.authManager && window.authManager.currentUser;
                    if (redirect && hasUser) {
                        // 清除标记
                        window._postAuthRedirect = null;
                        // 兼容旧字符串 'game'
                        if (redirect === 'game') {
                            window.location.href = 'game.html';
                            return;
                        }
                        if (typeof redirect === 'object') {
                            if (redirect.type === 'page' && redirect.page) {
                                // 在 SPA 内部导航
                                this.goToPage(redirect.page);
                                if (redirect.page === 'question' && redirect.id) {
                                    this.goToQuestion(redirect.id, redirect.mode || 'practice');
                                }
                            } else if (redirect.type === 'open' && redirect.url) {
                                window.open(redirect.url, '_blank');
                            } else if (redirect.type === 'navigate' && redirect.url) {
                                window.location.href = redirect.url;
                            }
                        }
                    }
                } catch (e) {
                    // ignore
                }
            }, 500);

            // ========== 新增：解析 URL 参数，自动跳转到指定题目 ==========
            const urlParams = new URLSearchParams(window.location.search);
            const questionParam = urlParams.get('question');

            if (questionParam) {
                // 延迟执行，确保数据已完全加载
                setTimeout(() => {
                    if (questionParam.toString().toUpperCase().startsWith('G')) {
                        const trainingId = parseInt(questionParam.substring(1));
                        if (!isNaN(trainingId)) {
                            this.goToTrainingQuestion(trainingId);
                        }
                    } else {
                        const normalId = parseInt(questionParam);
                        if (!isNaN(normalId)) {
                            this.goToQuestion(normalId, 'practice');
                        }
                    }
                }, 300);
            }

            // 监听浏览器前进后退
            window.addEventListener('popstate', () => {
                const newParams = new URLSearchParams(window.location.search);
                const newQuestion = newParams.get('question');
                if (!newQuestion) {
                    // 如果 URL 没有参数，返回上一页
                    if (this.currentPage === 'question') {
                        this.goBackFromQuestion();
                    }
                }
            });
            // ========== 新增结束 ==========

        } catch (error) {
            console.error('应用初始化失败:', error);
        }
    },
    methods: {
        // 如果目标页面需要登录，调用此方法进行统一检查并显示登录弹窗
        requireLogin(redirect) {
            try {
                const isLoggedIn = window.authManager && window.authManager.isLoggedIn && window.authManager.isLoggedIn();
                if (isLoggedIn) return true;
                // 未登录：显示登录弹窗并记录重定向目标
                this.showAuthModal = true;
                this.authMode = 'login';
                window._postAuthRedirect = redirect || { type: 'page', page: 'index' };
                return false;
            } catch (e) {
                // 保守处理：如果发生异常则弹窗并阻止操作
                this.showAuthModal = true;
                this.authMode = 'login';
                window._postAuthRedirect = redirect || { type: 'page', page: 'index' };
                return false;
            }
        },
        // 执行搜索
        performSearch() {
            if (!this.searchKeyword.trim()) {
                this.searchResults = [];
                return;
            }

            const keyword = this.searchKeyword.toLowerCase().trim();
            this.searchResults = this.rawQuestions.filter(question => {
                // 检查关键词匹配
                const hasKeyword = question.keywords &&
                    question.keywords.some(kw =>
                        kw.toLowerCase().includes(keyword)
                    );

                // 检查题干匹配
                const inQuestion = question.question &&
                    question.question.toLowerCase().includes(keyword);

                return hasKeyword || inQuestion;
            });
        },

        // 截断过长的题干
        truncateQuestion(question) {
            // 移除HTML标签和换行符
            const text = question.replace(/<br>/g, ' ').replace(/<[^>]*>/g, '');
            return text.length > 120 ? text.substring(0, 120) + '...' : text;
        },

        // 跳转到搜索结果题目
        goToSearchResult(questionId) {
            this.goToQuestion(questionId, 'practice');
        },

        goToQuestion(questionId, mode) {
            // 进入题目页面也要求登录
            const ok = this.requireLogin({ type: 'page', page: 'question', id: questionId, mode });
            if (!ok) return;
            // 原有逻辑：加载并跳转
            const question = this.rawQuestions.find(q => q.id === questionId);
            if (question) {
                this.currentQuestion = {
                    ...question,
                    typeText: this.getTypeText(question.type),
                    difficultyText: this.getDifficultyText(question.difficulty),
                    resource: question.resource || '',
                    background: this.fmtQuestion(question.background || ''),
                    question: this.fmtQuestion(question.question),
                    options: question.options ? question.options.map(opt => opt || '') : ['', '', '', ''],
                    analysis: this.fmtQuestion(question.analysis)
                };

                if (mode === 'practice') {
                    this.currentQuestionIndex = this.rawQuestions.findIndex(q => q.id === questionId);
                } else if (mode === 'random') {
                    this.randomHistory.push(questionId);
                    this.randomCurrentIndex = this.randomHistory.length - 1;
                }

                this.questionMode = mode || 'practice';
                this.currentPage = 'question';
                this.selectedOption = null;
                this.showAnswer = false;

                window.history.pushState({}, '', `?question=${questionId}`);
            }
        },



        /* 新增：统一拉题库 */
        async loadQuestions() {
            if (!window.dbManager) return
            try {
                this.rawQuestions = await window.dbManager.getQuestions()
                // 如果其它文件也要用，继续挂到 window 供旧代码过渡
                window.questions = this.rawQuestions
            } catch (e) {
                console.error('题库加载失败', e)
                // 降级：仍然读取本地 questions.js（如有）
                if (window.questions) this.rawQuestions = window.questions
            }
        },

        fmtQuestion(str) {
            return (str || '')
                .replace(/\r\n/g, '\n')   // 统一换行符
                .replace(/\n/g, '<br>');  // 转成浏览器可见换行
        },

        toggleSidebar() {
            this.sidebarOpen = !this.sidebarOpen;
        },

        // 在页面跳转时重置搜索
        goToPage(page) {
            // 所有子页面（非首页）都需要登录
            if (page !== 'index') {
                const ok = this.requireLogin({ type: 'page', page });
                if (!ok) return;
            }

            this.currentPage = page;
            this.selectedOption = null;
            this.showAnswer = false;

            if (page === 'practice') {
                this.updateCategories();
            } else if (page === 'game') {
                // 加载全服统计
                this.loadGlobalGameStats();
            } else if (page === 'wrong') {
                this.updateWrongCategories();
            } else if (page === 'search') {
                // 进入搜索页面时重置搜索状态
                this.searchKeyword = '';
                this.searchResults = [];
            }
        },

        goToEditor(type) {
            const map = {
                questions: 'editor.html',
                training: 'training-editor.html'
            };
            const url = map[type];
            if (!url) return;
            const ok = this.requireLogin({ type: 'open', url });
            if (!ok) return;
            window.open(url, '_blank');
        },

        // 打开实际游戏页面（从 SPA 游戏主页或按钮），需登录
        startGameFromSPA() {
            const ok = this.requireLogin({ type: 'navigate', url: 'game.html' });
            if (!ok) return;
            window.location.href = 'game.html';
        },

        // 拉取全服游戏统计数据
        async loadGlobalGameStats() {
            try {
                const sb = window.getSupabase();
                if (!sb) return;
                // 拉取必要字段
                const { data, error } = await sb.from('game_history').select('attempts, correct_count, hints_used, answer_name');
                if (error) {
                    console.error('加载全服游戏统计失败', error);
                    return;
                }
                if (!data || data.length === 0) {
                    this.globalGameStats = { totalAttempts: 0, globalAccuracy: 0, globalAvgHintsCorrect: 0, topAnswer: { name: null, count: 0 } };
                    return;
                }
                const totalAttempts = data.reduce((s, r) => s + (r.attempts || 0), 0);
                const totalCorrect = data.reduce((s, r) => s + (r.correct_count || 0), 0);
                // 计算全服在答对时的平均提示数：仅统计正确的行的 hints_used
                const correctRows = data.filter(r => r.correct_count && r.hints_used !== null && r.hints_used !== undefined);
                const avgHints = correctRows.length ? (correctRows.reduce((s, r) => s + (r.hints_used || 0), 0) / correctRows.length) : 0;

                // 计算被答对最多的答案
                const answerCounts = {};
                data.forEach(r => {
                    if (r.correct_count && r.answer_name) {
                        answerCounts[r.answer_name] = (answerCounts[r.answer_name] || 0) + r.correct_count;
                    }
                });
                let topName = null, topCount = 0;
                Object.keys(answerCounts).forEach(name => {
                    if (answerCounts[name] > topCount) {
                        topCount = answerCounts[name];
                        topName = name;
                    }
                });

                this.globalGameStats.totalAttempts = totalAttempts;
                this.globalGameStats.globalAccuracy = totalAttempts ? (totalCorrect / totalAttempts) : 0;
                this.globalGameStats.globalAvgHintsCorrect = avgHints;
                this.globalGameStats.topAnswer = { name: topName, count: topCount };
            } catch (e) {
                console.error('loadGlobalGameStats 异常', e);
            }
        },

        // 获取题目统计信息
        async loadQuestionStats(questionId, questionType) {
            // 如果没有传递参数，使用当前题目的信息
            if (!questionId && this.currentQuestion) {
                questionId = this.currentQuestion.id;
            }
            if (!questionType) {
                questionType = this.questionMode === 'training' ? 'training' : 'normal';
            }

            if (!window.dbManager || !questionId || !questionType) {
                console.warn('无法加载题目统计: 缺少必要参数', { questionId, questionType });
                return;
            }

            try {
                console.log('加载题目统计:', { questionId, questionType });
                this.questionStats = await dbManager.getQuestionStats(questionId, questionType);
            } catch (error) {
                console.error('加载题目统计失败:', error);
            }
        },

        // 获取考试统计信息
        async loadExamStats() {
            if (!window.dbManager) return;

            try {
                this.examStats = await dbManager.getExamStats();
            } catch (error) {
                console.error('加载考试统计失败:', error);
            }
        },

        updateCategories() {
            const newCategories = {};

            if (this.practiceMode === 'type') {
                const typeNames = {
                    1: '干员调配与特性化决策',
                    2: '空间部署与极致化战术',
                    3: '效能审计与生态位界定',
                    4: '横向分析与竞争力评估',
                    5: '作战环境与档案类记录'
                };

                for (let i = 1; i <= 5; i++) {
                    const questions = this.rawQuestions.filter(q => q.type === i);
                    newCategories[`type_${i}`] = {
                        name: typeNames[i],
                        questions: questions,
                        isOpen: false
                    };
                }
            } else {
                const difficultyNames = {
                    1: '常识',
                    2: '基操',
                    3: '娴熟',
                    4: '明智',
                    5: '深邃'
                };

                for (let i = 1; i <= 5; i++) {
                    const questions = this.rawQuestions.filter(q => q.difficulty === i);
                    newCategories[`difficulty_${i}`] = {
                        name: difficultyNames[i],
                        questions: questions,
                        isOpen: false
                    };
                }
            }

            this.categories = newCategories;
        },

        updateWrongCategories() {
            const newCategories = {};
            const typeNames = {
                1: '干员调配与特性化决策',
                2: '空间部署与极致化战术',
                3: '效能审计与生态位界定',
                4: '横向分析与竞争力评估',
                5: '作战环境与档案类记录'
            };

            for (let i = 1; i <= 5; i++) {
                const questions = this.rawQuestions.filter(q =>
                    q.type === i && this.wrongQuestions.includes(q.id)
                );
                if (questions.length > 0) {
                    newCategories[`type_${i}`] = {
                        name: typeNames[i],
                        questions: questions,
                        isOpen: false
                    };
                }
            }

            this.wrongCategories = newCategories;
        },

        toggleCategory(key) {
            const updatedCategories = { ...this.categories };
            updatedCategories[key].isOpen = !updatedCategories[key].isOpen;

            Object.keys(updatedCategories).forEach(k => {
                if (k !== key) {
                    updatedCategories[k].isOpen = false;
                }
            });

            this.categories = updatedCategories;
        },

        toggleWrongCategory(key) {
            const updatedCategories = { ...this.wrongCategories };
            updatedCategories[key].isOpen = !updatedCategories[key].isOpen;

            Object.keys(updatedCategories).forEach(k => {
                if (k !== key) {
                    updatedCategories[k].isOpen = false;
                }
            });

            this.wrongCategories = updatedCategories;
        },

        // 修改 loadTrainingQuestions 方法，确保正确处理数据
        async loadTrainingQuestions() {
            if (!window.dbManager) {
                console.warn('dbManager 未初始化，无法加载培训题目');
                this.trainingQuestions = []; // 确保设置为空数组
                return;
            }

            try {
                const rawData = await window.dbManager.getTrainingQuestions();
                console.log('从数据库获取的培训题目:', rawData);

                if (!rawData || rawData.length === 0) {
                    console.warn('数据库返回的培训题目为空');
                    this.trainingQuestions = [];
                    return;
                }

                // 映射数据库字段到前端期望的格式
                this.trainingQuestions = rawData.map(item => ({
                    id: item.id,
                    question: item.question,
                    background: item.background || '',
                    options: item.options || ['', '', '', ''],
                    answer: item.answer,
                    analysis: item.analysis,
                    picture: item.picture || false,
                    resource: item.resource || ''  // 确保包含 resource 字段
                }));

                console.log('培训题目加载成功，共', this.trainingQuestions.length, '题');
                console.log('培训题目详情:', this.trainingQuestions);

                // 确保更新界面显示
                this.$forceUpdate();
            } catch (error) {
                console.error('加载培训题目失败:', error);
                // 设置空数组避免undefined错误
                this.trainingQuestions = [];
            }
        },

        // 同时修改 goToTrainingQuestion 方法，确保能正确处理题目
        goToTrainingQuestion(id) {
            // 进入培训题目需要登录
            const ok = this.requireLogin({ type: 'page', page: 'question', id: id, mode: 'training' });
            if (!ok) return;
            console.log('跳转到培训题目:', id, '可用题目:', this.trainingQuestions);

            this.questionMode = 'training';
            const question = this.trainingQuestions.find(q => q.id === id);
            if (question) {
                this.currentQuestion = {
                    ...question,
                    typeText: '入职培训',
                    difficultyText: '入门',
                    resource: question.resource || '',
                    background: this.fmtQuestion(question.background || ''),
                    question: this.fmtQuestion(question.question),
                    options: question.options ? question.options.map(opt => opt || '') : ['', '', '', ''],
                    analysis: this.fmtQuestion(question.analysis),
                    picture: question.picture || false
                };
                this.currentPage = 'question';
                this.selectedOption = null;
                this.showAnswer = false;
                window.history.pushState({}, '', `?question=G${id}`);

                console.log('成功加载题目:', this.currentQuestion);
            } else {
                console.error('未找到培训题目:', id, '可用题目ID:', this.trainingQuestions.map(q => q.id));
                alert('题目不存在！');
            }
        },

        goToWrongQuestion(id) {
            // 进入错题页面需要登录
            const ok = this.requireLogin({ type: 'page', page: 'question', id: id, mode: 'wrong' });
            if (!ok) return;
            this.questionMode = 'wrong';
            const question = this.rawQuestions.find(q => q.id === id);
            if (question) {
                this.currentQuestion = {
                    ...question,
                    typeText: this.getTypeText(question.type),
                    difficultyText: this.getDifficultyText(question.difficulty),
                    resource: question.resource || '',
                    background: this.fmtQuestion(question.background || ''),
                    question: this.fmtQuestion(question.question),
                    options: question.options ? question.options.map(opt => opt || '') : ['', '', '', ''],
                    analysis: this.fmtQuestion(question.analysis)
                };
                this.currentPage = 'question';
                this.selectedOption = null;
                this.showAnswer = false;
            }
        },

        getTypeText(type) {
            const typeMap = {
                1: '干员调配与特性化决策',
                2: '空间部署与极致化战术',
                3: '效能审计与生态位界定',
                4: '横向分析与竞争力评估',
                5: '作战环境与档案类记录'
            };
            return typeMap[type] || '未知类型';
        },

        getDifficultyText(difficulty) {
            const difficultyMap = {
                1: '常识',
                2: '基操',
                3: '娴熟',
                4: '明智',
                5: '深邃'
            };
            return difficultyMap[difficulty] || '未知难度';
        },

        getTypeColor(type) {
            const typeColors = {
                1: 'rgb(127, 94, 192)', // 类型1 -> 紫色
                2: 'rgb(33, 198, 208)',  // 类型2 -> 蓝色
                3: 'rgb(158, 220, 35)',  // 类型3 -> 绿色
                4: 'rgb(255, 192, 0)',   // 类型4 -> 橙色
                5: 'rgb(255, 98, 61)'    // 类型5 -> 红色
            };
            return typeColors[type] || '#666';
        },

        getDifficultyColor(difficulty) {
            const difficultyColors = {
                1: 'rgb(158, 220, 35)', // 简单 - 绿色
                2: 'rgb(33, 198, 208)',  // 较易 - 蓝色
                3: 'rgb(127, 94, 192)',  // 中等 - 紫色
                4: 'rgb(255, 192, 0)',   // 较难 - 橙色
                5: 'rgb(255, 98, 61)'    // 困难 - 红色
            };
            return difficultyColors[difficulty] || '#666';
        },

        getTrainingQuestionColor(id) {
            const record = this.trainingRecords[id];
            if (!record) return 'rgb(136, 136, 136)'; // 未做 - 指定灰色
            return record.correct ? 'rgb(158, 220, 35)' : 'rgb(255, 98, 61)'; // 正确 - 新绿，错误 - 新红
        },

        selectOption(option) {
            if (!this.showAnswer) {
                this.selectedOption = option;
            }
        },

        async checkAnswer() {
            if (this.selectedOption) {
                this.showAnswer = true;

                console.log('提交答案:', {
                    questionId: this.currentQuestion.id,
                    questionType: this.questionMode === 'training' ? 'training' : 'normal',
                    selectedOption: this.selectedOption,
                    isCorrect: this.isAnswerCorrect
                });

                // 记录答题结果
                if (this.questionMode === 'training') {
                    this.recordTrainingAnswer(this.currentQuestion.id, this.isAnswerCorrect);
                    await dbManager.recordAnswer(this.currentQuestion.id, 'training', this.isAnswerCorrect, this.selectedOption);
                } else {
                    if (!this.isAnswerCorrect) {
                        this.recordWrongAnswer(this.currentQuestion.id);
                    }
                    await dbManager.recordAnswer(this.currentQuestion.id, 'normal', this.isAnswerCorrect, this.selectedOption);
                }

                // 只有在显示答案后才加载统计信息 - 传递正确的参数
                await this.loadQuestionStats(this.currentQuestion.id, this.questionMode === 'training' ? 'training' : 'normal');

                // 滚动到解析部分
                this.$nextTick(() => {
                    const analysisElement = this.$refs.answerAnalysis;
                    if (analysisElement) {
                        analysisElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            } else {
                alert('请先选择一个答案');
            }
        },

        goToEditor(type) {
            const map = { questions: 'editor.html', training: 'training-editor.html' };
            window.open(map[type], '_blank');
        },

        async loadExamStats() {
            if (!window.authManager || !window.authManager.isLoggedIn()) return;

            try {
                const stats = await window.dbManager.getExamStats();
                this.examStats = stats;
            } catch (error) {
                console.error('加载考试统计失败:', error);
            }
        },

        prevQuestion() {
            if (this.questionMode === 'practice') {
                if (this.currentQuestionIndex > 0) {
                    this.currentQuestionIndex--;
                    this.loadQuestionByIndex(this.currentQuestionIndex);
                }
            } else if (this.questionMode === 'random') {
                if (this.randomCurrentIndex > 0) {
                    this.randomCurrentIndex--;
                    const id = this.randomHistory[this.randomCurrentIndex];
                    this.loadQuestionById(id);
                }
            } else if (this.questionMode === 'jump') {
                if (this.currentQuestion && this.currentQuestion.id > 1) {
                    const prevId = this.currentQuestion.id - 1;
                    this.loadQuestionById(prevId);
                }
            } else if (this.questionMode === 'training') {
                const prevId = this.getPrevTrainingQuestion();
                if (prevId !== null) {
                    this.goToTrainingQuestion(prevId);
                }
            } else if (this.questionMode === 'wrong') {
                const prevId = this.getPrevWrongQuestion();
                if (prevId !== null) {
                    this.goToWrongQuestion(prevId);
                }
            }
        },

        nextQuestion() {
            if (this.questionMode === 'practice') {
                // 查找相同分类下的下一题
                let nextQuestion = null;
                const currentQuestion = this.currentQuestion;

                if (this.practiceMode === 'type') {
                    // 相同类型下id大于本题的最小id
                    const sameTypeQuestions = this.rawQuestions.filter(q => q.type === currentQuestion.type && q.id > currentQuestion.id);
                    if (sameTypeQuestions.length > 0) {
                        nextQuestion = sameTypeQuestions[0];
                    } else {
                        // 找下一个类型的最小id
                        const nextType = currentQuestion.type + 1;
                        if (nextType <= 5) {
                            const nextTypeQuestions = this.rawQuestions.filter(q => q.type === nextType);
                            if (nextTypeQuestions.length > 0) {
                                nextQuestion = nextTypeQuestions[0];
                            }
                        }
                    }
                } else {
                    // 相同难度下id大于本题的最小id
                    const sameDifficultyQuestions = this.rawQuestions.filter(q => q.difficulty === currentQuestion.difficulty && q.id > currentQuestion.id);
                    if (sameDifficultyQuestions.length > 0) {
                        nextQuestion = sameDifficultyQuestions[0];
                    } else {
                        // 找下一个难度的最小id
                        const nextDifficulty = currentQuestion.difficulty + 1;
                        if (nextDifficulty <= 5) {
                            const nextDifficultyQuestions = this.rawQuestions.filter(q => q.difficulty === nextDifficulty);
                            if (nextDifficultyQuestions.length > 0) {
                                nextQuestion = nextDifficultyQuestions[0];
                            }
                        }
                    }
                }

                if (nextQuestion) {
                    this.goToQuestion(nextQuestion.id, 'practice');
                } else {
                    alert('已经是最后一题了！');
                }
            } else if (this.questionMode === 'random') {
                const doneQuestions = [...this.randomHistory];
                const availableQuestions = this.rawQuestions.filter(
                    q => !doneQuestions.includes(q.id)
                );

                if (availableQuestions.length > 0) {
                    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
                    const nextQuestion = availableQuestions[randomIndex];
                    this.randomHistory.push(nextQuestion.id);
                    this.randomCurrentIndex = this.randomHistory.length - 1;
                    this.loadQuestionById(nextQuestion.id);
                } else {
                    alert('所有题目都已练习过！');
                }
            } else if (this.questionMode === 'jump') {
                if (this.currentQuestion && this.currentQuestion.id < this.rawQuestions.length) {
                    const nextId = this.currentQuestion.id + 1;
                    this.loadQuestionById(nextId);
                }
            } else if (this.questionMode === 'training') {
                const nextId = this.getNextTrainingQuestion();
                if (nextId !== null) {
                    this.goToTrainingQuestion(nextId);
                } else {
                    alert('所有题目都已练习过！');
                }
            } else if (this.questionMode === 'wrong') {
                const nextId = this.getNextWrongQuestion();
                if (nextId !== null) {
                    this.goToWrongQuestion(nextId);
                } else {
                    alert('已经是最后一题了！');
                }
            }
        },

        getPrevTrainingQuestion() {
            if (!this.currentQuestion) return null;
            const currentId = this.currentQuestion.id;
            const prevQuestions = this.trainingQuestions
                .filter(q => q.id < currentId)
                .sort((a, b) => b.id - a.id);
            return prevQuestions.length > 0 ? prevQuestions[0].id : null;
        },

        getNextTrainingQuestion() {
            if (!this.currentQuestion) return null;
            const currentId = this.currentQuestion.id;
            const nextQuestions = this.trainingQuestions
                .filter(q => q.id > currentId)
                .sort((a, b) => a.id - b.id);
            return nextQuestions.length > 0 ? nextQuestions[0].id : null;
        },

        getPrevWrongQuestion() {
            if (!this.currentQuestion) return null;
            const currentId = this.currentQuestion.id;
            const wrongIds = this.wrongQuestions.sort((a, b) => a - b);
            const currentIndex = wrongIds.indexOf(currentId);
            return currentIndex > 0 ? wrongIds[currentIndex - 1] : null;
        },

        getNextWrongQuestion() {
            if (!this.currentQuestion) return null;
            const currentId = this.currentQuestion.id;
            const wrongIds = this.wrongQuestions.sort((a, b) => a - b);
            const currentIndex = wrongIds.indexOf(currentId);
            return currentIndex < wrongIds.length - 1 ? wrongIds[currentIndex + 1] : null;
        },

        loadQuestionByIndex(index) {
            const question = this.rawQuestions[index];
            this.currentQuestion = {
                ...question,
                typeText: this.getTypeText(question.type),
                difficultyText: this.getDifficultyText(question.difficulty)
            };
            this.selectedOption = null;
            this.showAnswer = false;
        },

        loadQuestionById(id) {
            const question = this.rawQuestions.find(q => q.id === id);
            if (question) {
                this.currentQuestion = {
                    ...question,
                    typeText: this.getTypeText(question.type),
                    difficultyText: this.getDifficultyText(question.difficulty),
                    // 直接使用 resource 字段
                    resource: question.resource || '',
                    question: this.fmtQuestion(question.question),
                    options: question.options ? question.options.map(opt => opt || '') : ['', '', '', ''],
                    analysis: this.fmtQuestion(question.analysis)
                };
                this.selectedOption = null;
                this.showAnswer = false;
            } else {
                alert('题目不存在！');
            }
        },

        goBackFromQuestion() {
            window.history.pushState({}, '', window.location.pathname);

            if (this.questionMode === 'practice') {
                this.currentPage = 'practice';
            } else if (this.questionMode === 'random') {
                this.currentPage = 'quickjump';
            } else if (this.questionMode === 'jump') {
                this.currentPage = 'quickjump';
            } else if (this.questionMode === 'training') {
                this.currentPage = 'training';
            } else if (this.questionMode === 'wrong') {
                this.currentPage = 'wrong';
            } else if (this.questionMode === 'exam') {
                this.currentPage = 'exam';
            }
        },

        startRandom() {
            // 随机出题前需登录
            const ok = this.requireLogin({ type: 'page', page: 'question', mode: 'random' });
            if (!ok) return;
            const randomIndex = Math.floor(Math.random() * this.rawQuestions.length);
            const question = this.rawQuestions[randomIndex];
            this.questionMode = 'random';
            this.randomHistory = [question.id];
            this.randomCurrentIndex = 0;
            this.goToQuestion(question.id, 'random');
        },

        startJump() {
            // 跳转到指定题目前需登录
            const okJump = this.requireLogin({ type: 'page', page: 'question', mode: 'jump' });
            if (!okJump) return;
            const input = this.jumpQuestionId.trim();

            // 处理G+题号格式（入职培训）
            if (input.toUpperCase().startsWith('G')) {
                const id = parseInt(input.substring(1));
                const total = this.trainingQuestions ? this.trainingQuestions.length : 0;
                if (id >= 1 && id <= total) {
                    this.questionMode = 'training';
                    this.goToTrainingQuestion(id);
                    this.currentPage = 'question';
                } else {
                    alert('请输入有效的入职培训题目ID（G1-G' + total + '）');
                }
            }
            // 处理普通题号
            else {
                const id = parseInt(input);
                const total = this.rawQuestions ? this.rawQuestions.length : 0;
                if (id >= 1 && id <= total) {
                    this.questionMode = 'jump';
                    this.loadQuestionById(id);
                    this.currentPage = 'question';
                } else {
                    alert('请输入有效的题目ID（1-' + total + '）或入职培训题目ID（G1-G' + (this.trainingQuestions ? this.trainingQuestions.length : 0) + '）');
                }
            }
        },

        getTotalQuestions() {
            return this.rawQuestions ? this.rawQuestions.length : 0;
        },

        startExam() {
            // 开始考试需要登录
            const ok = this.requireLogin({ type: 'navigate', url: 'exam.html' });
            if (!ok) return;
            window.location.href = 'exam.html';
        },

        getQuestionColor(question) {
            if (this.practiceMode === 'type') {
                // 按难度分颜色
                return this.getDifficultyColor(question.difficulty);
            } else {
                // 按类型分颜色
                return this.getTypeColor(question.type);
            }
        },



        loadTrainingRecords() {
            const records = localStorage.getItem('trainingRecords');
            this.trainingRecords = records ? JSON.parse(records) : {};
        },

        saveTrainingRecords() {
            localStorage.setItem('trainingRecords', JSON.stringify(this.trainingRecords));
        },

        recordTrainingAnswer(id, correct) {
            this.trainingRecords[id] = {
                correct: correct,
                timestamp: new Date().getTime()
            };
            this.saveTrainingRecords();
        },

        goToFirstUnansweredTraining() {
            const unanswered = this.trainingQuestions.find(q => !this.trainingRecords[q.id]);
            if (unanswered) {
                this.goToTrainingQuestion(unanswered.id);
            } else {
                alert('所有题目都已练习过！');
            }
        },

        clearTrainingRecords() {
            if (confirm('确定要清除所有入职培训记录吗？')) {
                this.trainingRecords = {};
                this.saveTrainingRecords();
            }
        },

        // 错题辑录相关方法
        loadWrongQuestions() {
            const wrong = localStorage.getItem('wrongQuestions');
            this.wrongQuestions = wrong ? JSON.parse(wrong) : [];
        },

        saveWrongQuestions() {
            localStorage.setItem('wrongQuestions', JSON.stringify(this.wrongQuestions));
        },

        recordWrongAnswer(id) {
            if (!this.wrongQuestions.includes(id)) {
                this.wrongQuestions.push(id);
                this.saveWrongQuestions();
                this.updateWrongCategories();
            }
        },

        clearWrongRecords() {
            if (confirm('确定要清除所有错题记录吗？')) {
                this.wrongQuestions = [];
                this.saveWrongQuestions();
                this.updateWrongCategories();
            }
        },

        deleteWrongCategory(key) {
            const type = parseInt(key.split('_')[1]);
            const questionsInCategory = this.rawQuestions.filter(q =>
                q.type === type && this.wrongQuestions.includes(q.id)
            );

            if (confirm(`确定要删除${this.getTypeText(type)}分类的所有错题吗？`)) {
                this.wrongQuestions = this.wrongQuestions.filter(id =>
                    !questionsInCategory.some(q => q.id === id)
                );
                this.saveWrongQuestions();
                this.updateWrongCategories();
            }
        },

        deleteWrongQuestion(id) {
            if (confirm('确定要删除这道错题吗？')) {
                this.wrongQuestions = this.wrongQuestions.filter(qid => qid !== id);
                this.saveWrongQuestions();
                this.updateWrongCategories();
            }
        },

        // 系统数据加载
        loadSystemData() {
            // 加载更新公告
            if (window.updateNotices) {
                this.updateVersions = window.updateNotices;
                this.selectedVersion = this.updateVersions[0] || {};
            }

            // 加载系统提示
            if (window.systemTips) {
                this.systemTips = window.systemTips;
            }
        },

        //==============后端相关=====================


        async handleLogin() {
            const result = await authManager.login(this.authUsername, this.authPassword);
            if (result.success) {
                this.showAuthModal = false;
                this.authUsername = '';
                this.authPassword = '';
                this.loadExamStats();
            } else {
                alert(result.message);
            }
        },

        async handleRegister() {
            const result = await authManager.register(this.authUsername, this.authPassword);
            if (result.success) {
                alert(result.message);
                this.showAuthModal = false;
                this.authUsername = '';
                this.authPassword = '';
                this.loadExamStats();
            } else {
                alert(result.message);
            }
        },

        async handleLogout() {
            await authManager.logout();
            this.loadExamStats();
        },

        async loadExamStats() {
            try {
                const stats = await dbManager.getExamStats();
                this.examStats = stats;
            } catch (error) {
                console.error('加载考试统计失败:', error);
                // 设置默认值
                this.examStats = { totalAttempts: 0, averageScore: 0 };
            }
        }

    }
});
