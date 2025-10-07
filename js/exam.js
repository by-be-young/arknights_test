new Vue({
    el: '#app',
    data: {
        examPaper: [],
        currentQuestionNumber: 1,
        elapsedTime: 0,
        totalTime: 15 * 60, // 15分钟
        timerInterval: null,
        mobileSheetOpen: false,
        showResult: false,
        totalScore: 0,
        maxScore: 100,
        showQuestionDetailModal: false,
        currentDetailQuestion: null,
        currentDetailSectionIndex: 0,
        currentDetailQIndex: 0
    },
    computed: {
        formattedTime() {
            return this.formatTime(this.elapsedTime);
        },
        remainingTime() {
            return Math.max(0, this.totalTime - this.elapsedTime);
        },
        answeredCount() {
            let count = 0;
            this.examPaper.forEach(section => {
                section.questions.forEach(question => {
                    if (question.userAnswer) count++;
                });
            });
            return count;
        }
    },
    mounted() {
        this.generateExamPaper();
        this.startTimer();
        this.setupCurrentQuestionTracker();
    },
    methods: {
        // 生成试卷
        generateExamPaper() {
            const typeNames = {
                1: '干员调配与特性化决策',
                2: '空间部署与极致化战术',
                3: '效能审计与生态位界定',
                4: '横向分析与竞争力评估',
                5: '作战环境与档案类记录'
            };

            const difficultyNames = {
                1: '常识',
                2: '基操',
                3: '娴熟',
                4: '明智',
                5: '深邃'
            };

            // 初始化试卷结构
            this.examPaper = [];
            for (let type = 1; type <= 5; type++) {
                const section = {
                    type: type,
                    typeName: typeNames[type],
                    questions: []
                };

                // 为每个难度选择一题
                for (let difficulty = 1; difficulty <= 5; difficulty++) {
                    const questionsOfTypeAndDifficulty = window.questions.filter(
                        q => q.type === type && q.difficulty === difficulty
                    );

                    if (questionsOfTypeAndDifficulty.length > 0) {
                        // 随机选择一题
                        const randomIndex = Math.floor(Math.random() * questionsOfTypeAndDifficulty.length);
                        const selectedQuestion = { ...questionsOfTypeAndDifficulty[randomIndex] };

                        // 添加显示文本和用户答案字段
                        selectedQuestion.typeText = typeNames[type];
                        selectedQuestion.difficultyText = difficultyNames[difficulty];
                        selectedQuestion.userAnswer = null;

                        section.questions.push(selectedQuestion);
                    }
                }

                this.examPaper.push(section);
            }

            // 设置第一题为当前题目
            this.currentQuestionNumber = 1;
        },

        // 获取题目编号（从1开始连续编号）
        getQuestionNumber(sectionIndex, qIndex) {
            let number = 0;
            for (let i = 0; i < sectionIndex; i++) {
                number += this.examPaper[i].questions.length;
            }
            return number + qIndex + 1;
        },

        // 选择答案
        selectOption(questionId, optionIndex) {
            // 找到对应题目
            for (let section of this.examPaper) {
                for (let question of section.questions) {
                    if (question.id === questionId) {
                        question.userAnswer = optionIndex;
                        break;
                    }
                }
            }
        },

        // 开始计时
        startTimer() {
            this.timerInterval = setInterval(() => {
                this.elapsedTime++;

                // 时间到自动提交
                if (this.elapsedTime >= this.totalTime) {
                    this.submitExam();
                }
            }, 1000);
        },

        // 格式化时间显示
        formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        },

        // 设置当前题目跟踪
        setupCurrentQuestionTracker() {
            window.addEventListener('scroll', () => {
                this.updateCurrentQuestion();
            });
        },

        // 更新当前题目
        updateCurrentQuestion() {
            const questions = document.querySelectorAll('.question-card');
            let currentQuestionNumber = 1;

            for (let i = 0; i < questions.length; i++) {
                const rect = questions[i].getBoundingClientRect();
                if (rect.top >= 0 && rect.top <= window.innerHeight / 2) {
                    currentQuestionNumber = parseInt(questions[i].getAttribute('data-question-number'));
                    break;
                }
            }

            if (currentQuestionNumber) {
                this.currentQuestionNumber = currentQuestionNumber;
            }
        },

        // 滚动到指定题目
        scrollToQuestion(sectionIndex, qIndex) {
            const questionNumber = this.getQuestionNumber(sectionIndex, qIndex);
            const questionElement = document.querySelector(`[data-question-number="${questionNumber}"]`);
            if (questionElement) {
                questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                this.currentQuestionNumber = questionNumber;
            }
        },

        // 切换移动端答题卡
        toggleMobileSheet() {
            this.mobileSheetOpen = !this.mobileSheetOpen;
        },

        // 提交试卷 （后端需要async）
        async submitExam() {
            clearInterval(this.timerInterval);
            this.calculateScore();

            // 记录考试结果（后端）
            if (authManager.isLoggedIn() && this.answeredCount === 25) {
                await dbManager.saveExamRecord(this.totalScore, 25);
            }
            // =========

            this.showResult = true;
        },

        // 计算分数
        calculateScore() {
            let totalScore = 0;
            const difficultyScores = [3, 4, 6, 4, 3]; // 各难度分值

            for (let section of this.examPaper) {
                for (let question of section.questions) {
                    if (question.userAnswer === question.answer) {
                        const score = difficultyScores[question.difficulty - 1];
                        totalScore += score;
                    }
                }
            }

            this.totalScore = totalScore;
        },

        // 计算部分分数
        calculateSectionScore(section) {
            let sectionScore = 0;
            const difficultyScores = [3, 4, 6, 4, 3];

            for (let question of section.questions) {
                if (question.userAnswer === question.answer) {
                    const score = difficultyScores[question.difficulty - 1];
                    sectionScore += score;
                }
            }

            return sectionScore;
        },

        // 检查题目是否正确
        isQuestionCorrect(question) {
            return question.userAnswer === question.answer;
        },

        // 显示题目详情
        showQuestionDetail(question, sectionIndex, qIndex) {
            this.currentDetailQuestion = question;
            this.currentDetailSectionIndex = sectionIndex;
            this.currentDetailQIndex = qIndex;
            this.showQuestionDetailModal = true;
        },

        // 关闭题目详情
        closeQuestionDetail() {
            this.showQuestionDetailModal = false;
            this.currentDetailQuestion = null;
        },

        // 重新开始考试
        restartExam() {
            this.showResult = false;
            this.elapsedTime = 0;
            this.generateExamPaper();
            this.startTimer();
            window.scrollTo(0, 0);
        },

        // 返回首页
        goBack() {
            // 在实际应用中，这里应该跳转到首页
            window.location.href = 'index.html';
        }
    },
    beforeDestroy() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }
});
