new Vue({
    el: '#app',
    data: {
        currentPage: 'index',
        practiceMode: 'type',
        sidebarOpen: false,
        categories: {},
        currentQuestion: null,
        currentQuestionIndex: 0,
        selectedOption: null,
        showAnswer: false,
        questionHistory: [],
        randomHistory: [],
        randomCurrentIndex: -1,
        questionMode: '' // 'practice', 'random'
    },
    computed: {
        hasPrevQuestion() {
            if (this.questionMode === 'practice') {
                return this.currentQuestionIndex > 0;
            } else if (this.questionMode === 'random') {
                return this.randomCurrentIndex > 0;
            }
            return false;
        },
        hasNextQuestion() {
            if (this.questionMode === 'practice') {
                return this.currentQuestionIndex < window.questions.length - 1;
            } else if (this.questionMode === 'random') {
                return true;
            }
            return false;
        }
    },
    watch: {
        practiceMode() {
            this.updateCategories();
        }
    },
    mounted() {
        this.updateCategories();
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

        goToQuestion(id, mode) {
            this.questionMode = mode;
            const question = window.questions.find(q => q.id === id);
            if (question) {
                this.currentQuestion = {
                    ...question,
                    typeText: this.getTypeText(question.type),
                    difficultyText: this.getDifficultyText(question.difficulty)
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

        selectOption(option) {
            if (!this.showAnswer) {
                this.selectedOption = option;
            }
        },

        checkAnswer() {
            if (this.selectedOption) {
                this.showAnswer = true;
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
            }
        },

        nextQuestion() {
            if (this.questionMode === 'practice') {
                if (this.currentQuestionIndex < window.questions.length - 1) {
                    this.currentQuestionIndex++;
                    this.loadQuestionByIndex(this.currentQuestionIndex);
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
            }
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
            this.currentQuestion = {
                ...question,
                typeText: this.getTypeText(question.type),
                difficultyText: this.getDifficultyText(question.difficulty)
            };
            this.selectedOption = null;
            this.showAnswer = false;
        },

        goBackFromQuestion() {
            if (this.questionMode === 'practice') {
                this.currentPage = 'practice';
            } else if (this.questionMode === 'random') {
                this.currentPage = 'random';
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
        mounted() {
            this.updateCategories();

            // 点击侧边栏外部关闭侧边栏
            document.addEventListener('click', (event) => {
                const sidebar = document.querySelector('.sidebar');
                const menuToggle = document.querySelector('.mobile-menu-toggle');

                if (this.sidebarOpen &&
                    !sidebar.contains(event.target) &&
                    !menuToggle.contains(event.target)) {
                    this.sidebarOpen = false;
                }
            });
        }
    }
});