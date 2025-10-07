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
        showAuthModal: false,
        authMode: 'login',
        authUsername: '',
        authPassword: '',
        questionStats: {}, // 存储题目统计信息
        examStats: { totalAttempts: 0, averageScore: 0 } // 考试统计
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
                return this.currentQuestionIndex < window.questions.length - 1;
            } else if (this.questionMode === 'random') {
                return true;
            } else if (this.questionMode === 'jump') {
                return this.currentQuestion && this.currentQuestion.id < window.questions.length;
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
                const question = window.questions.find(q => q.id === id);
                return total + (question ? question.difficulty : 0);
            }, 0);
            return sum / this.wrongQuestions.length;
        },
        mostWrongType() {
            if (this.wrongQuestions.length === 0) return '无';
            const typeCount = {};
            this.wrongQuestions.forEach(id => {
                const question = window.questions.find(q => q.id === id);
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
    mounted() {
        this.updateCategories();
        this.loadTrainingQuestions();
        this.loadTrainingRecords();
        this.loadWrongQuestions();
        this.loadSystemData();
        this.loadQuestionStats();
        this.loadExamStats();

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
    },
    methods: {
        toggleSidebar() {
            this.sidebarOpen = !this.sidebarOpen;
        },

        goToPage(page) {
            this.currentPage = page;
            this.selectedOption = null;
            this.showAnswer = false;

            if (page === 'practice') {
                this.updateCategories();
            } else if (page === 'wrong') {
                this.updateWrongCategories();
            } else if (page === 'training') {
                this.loadTrainingQuestions();
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
                    const questions = window.questions.filter(q => q.type === i);
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
                    const questions = window.questions.filter(q => q.difficulty === i);
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
                const questions = window.questions.filter(q =>
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

        goToQuestion(id, mode) {
            this.questionMode = mode;
            const question = window.questions.find(q => q.id === id);
            if (question) {
                this.currentQuestion = {
                    ...question,
                    typeText: this.getTypeText(question.type),
                    difficultyText: this.getDifficultyText(question.difficulty),
                    // 直接使用 resource 字段
                    resource: question.resource || '',
                    question: question.question || '',
                    options: question.options ? question.options.map(opt => opt || '') : ['', '', '', ''],
                    analysis: question.analysis || ''
                };

                if (mode === 'practice') {
                    this.currentQuestionIndex = window.questions.findIndex(q => q.id === id);
                } else if (mode === 'random') {
                    this.randomHistory.push(id);
                    this.randomCurrentIndex = this.randomHistory.length - 1;
                }

                this.currentPage = 'question';
                this.selectedOption = null;
                this.showAnswer = false;
            }
        },

        goToTrainingQuestion(id) {
            this.questionMode = 'training';
            const question = window.trainingQuestions.find(q => q.id === id);
            if (question) {
                this.currentQuestion = {
                    ...question,
                    typeText: '入职培训',
                    difficultyText: '入门',
                    resource: '',
                    question: question.question || '',
                    options: question.options ? question.options.map(opt => opt || '') : ['', '', '', ''],
                    analysis: question.analysis || '',
                    picture: question.picture || false
                };
                this.currentPage = 'question';
                this.selectedOption = null;
                this.showAnswer = false;
            }
        },

        goToWrongQuestion(id) {
            this.questionMode = 'wrong';
            const question = window.questions.find(q => q.id === id);
            if (question) {
                this.currentQuestion = {
                    ...question,
                    typeText: this.getTypeText(question.type),
                    difficultyText: this.getDifficultyText(question.difficulty),
                    resource: question.resource || '',
                    question: question.question || '',
                    options: question.options ? question.options.map(opt => opt || '') : ['', '', '', ''],
                    analysis: question.analysis || ''
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
                1: '#E91E63', // 干员调配 - 粉色
                2: '#9C27B0', // 空间部署 - 深紫
                3: '#3F51B5', // 效能审计 - 靛蓝
                4: '#009688', // 横向分析 - 青绿
                5: '#FF5722'  // 作战环境 - 深橙
            };
            return typeColors[type] || '#666';
        },

        getDifficultyColor(difficulty) {
            const difficultyColors = {
                1: '#43A047', // 常识 - 绿色
                2: '#7E57C2', // 基操 - 紫色
                3: '#2196F3', // 娴熟 - 蓝色
                4: '#FF9800', // 明智 - 橙色
                5: '#F44336'  // 深邃 - 红色
            };
            return difficultyColors[difficulty] || '#666';
        },

        getTrainingQuestionColor(id) {
            const record = this.trainingRecords[id];
            if (!record) return '#666'; // 未做 - 灰色
            return record.correct ? '#43A047' : '#F44336'; // 正确 - 绿色，错误 - 红色
        },

        selectOption(option) {
            if (!this.showAnswer) {
                this.selectedOption = option;
            }
        },

        checkAnswer() {
            if (this.selectedOption) {
                this.showAnswer = true;

                // 记录答题结果
                if (this.questionMode === 'training') {
                    this.recordTrainingAnswer(this.currentQuestion.id, this.isAnswerCorrect);
                } else if (!this.isAnswerCorrect && this.questionMode !== 'training') {
                    this.recordWrongAnswer(this.currentQuestion.id);
                }

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
                    const sameTypeQuestions = window.questions.filter(q => q.type === currentQuestion.type && q.id > currentQuestion.id);
                    if (sameTypeQuestions.length > 0) {
                        nextQuestion = sameTypeQuestions[0];
                    } else {
                        // 找下一个类型的最小id
                        const nextType = currentQuestion.type + 1;
                        if (nextType <= 5) {
                            const nextTypeQuestions = window.questions.filter(q => q.type === nextType);
                            if (nextTypeQuestions.length > 0) {
                                nextQuestion = nextTypeQuestions[0];
                            }
                        }
                    }
                } else {
                    // 相同难度下id大于本题的最小id
                    const sameDifficultyQuestions = window.questions.filter(q => q.difficulty === currentQuestion.difficulty && q.id > currentQuestion.id);
                    if (sameDifficultyQuestions.length > 0) {
                        nextQuestion = sameDifficultyQuestions[0];
                    } else {
                        // 找下一个难度的最小id
                        const nextDifficulty = currentQuestion.difficulty + 1;
                        if (nextDifficulty <= 5) {
                            const nextDifficultyQuestions = window.questions.filter(q => q.difficulty === nextDifficulty);
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
                const availableQuestions = window.questions.filter(
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
                if (this.currentQuestion && this.currentQuestion.id < window.questions.length) {
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
            const prevQuestions = window.trainingQuestions
                .filter(q => q.id < currentId)
                .sort((a, b) => b.id - a.id);
            return prevQuestions.length > 0 ? prevQuestions[0].id : null;
        },

        getNextTrainingQuestion() {
            if (!this.currentQuestion) return null;
            const currentId = this.currentQuestion.id;
            const nextQuestions = window.trainingQuestions
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
            const question = window.questions[index];
            this.currentQuestion = {
                ...question,
                typeText: this.getTypeText(question.type),
                difficultyText: this.getDifficultyText(question.difficulty)
            };
            this.selectedOption = null;
            this.showAnswer = false;
        },

        loadQuestionById(id) {
            const question = window.questions.find(q => q.id === id);
            if (question) {
                this.currentQuestion = {
                    ...question,
                    typeText: this.getTypeText(question.type),
                    difficultyText: this.getDifficultyText(question.difficulty),
                    // 直接使用 resource 字段
                    resource: question.resource || '',
                    question: question.question || '',
                    options: question.options ? question.options.map(opt => opt || '') : ['', '', '', ''],
                    analysis: question.analysis || ''
                };
                this.selectedOption = null;
                this.showAnswer = false;
            } else {
                alert('题目不存在！');
            }
        },

        goBackFromQuestion() {
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
            const randomIndex = Math.floor(Math.random() * window.questions.length);
            const question = window.questions[randomIndex];
            this.questionMode = 'random';
            this.randomHistory = [question.id];
            this.randomCurrentIndex = 0;
            this.goToQuestion(question.id, 'random');
        },

        startJump() {
            const input = this.jumpQuestionId.trim();

            // 处理G+题号格式（入职培训）
            if (input.toUpperCase().startsWith('G')) {
                const id = parseInt(input.substring(1));
                const total = window.trainingQuestions ? window.trainingQuestions.length : 0;
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
                const total = window.questions ? window.questions.length : 0;
                if (id >= 1 && id <= total) {
                    this.questionMode = 'jump';
                    this.loadQuestionById(id);
                    this.currentPage = 'question';
                } else {
                    alert('请输入有效的题目ID（1-' + total + '）或入职培训题目ID（G1-G' + (window.trainingQuestions ? window.trainingQuestions.length : 0) + '）');
                }
            }
        },

        getTotalQuestions() {
            return window.questions ? window.questions.length : 0;
        },

        startExam() {
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

        // 入职培训相关方法
        loadTrainingQuestions() {
            if (window.trainingQuestions) {
                this.trainingQuestions = window.trainingQuestions;
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
            const unanswered = window.trainingQuestions.find(q => !this.trainingRecords[q.id]);
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
            const questionsInCategory = window.questions.filter(q =>
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
            } else {
                alert(result.message);
            }
        },

        async loadQuestionStats() {
            // 加载题目统计信息
            // 在实际题目加载后调用
        },

        async loadExamStats() {
            if (authManager.isLoggedIn()) {
                const stats = await dbManager.getExamStats();
                this.examStats = stats;
            }
        },

        // 修改答题记录方法
        async recordAnswer(questionId, questionType, isCorrect) {
            if (authManager.isLoggedIn()) {
                await dbManager.recordAnswer(questionId, questionType, isCorrect);
            }
        }

    }
});
