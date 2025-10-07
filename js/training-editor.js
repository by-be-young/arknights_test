new Vue({
    el: '#training-editor-app',
    data: {
        questions: [],
        sidebarCollapsed: false,
        currentQuestionIndex: 0
    },
    async getSupabase() {
        if (window.supabaseClient) return window.supabaseClient;
        const { createClient } = supabase;
        window.supabaseClient = createClient(
            'YOUR_SUPABASE_URL',
            'YOUR_SUPABASE_ANON_KEY'
        );
        return window.supabaseClient;
    },
    async mounted() {
        const supabase = await this.getSupabase();
        const { data, error } = await supabase
            .from('training_questions')
            .select('*')
            .order('id');
        if (!error && data) this.questions = data;

        window.addEventListener('scroll', this.handleScroll, { passive: true });
    },
    beforeDestroy() {
        window.removeEventListener('scroll', this.handleScroll);
    },
    methods: {
        addQuestion() {
            const newId = this.questions.length > 0
                ? Math.max(...this.questions.map(q => q.id)) + 1
                : 1;

            this.questions.push({
                id: newId,
                question: '',
                picture: false,
                options: ['', '', '', ''],
                answer: 1,
                analysis: ''
            });

            this.saveQuestions();

            // 滚动到新添加的题目
            this.$nextTick(() => {
                this.scrollToQuestion(this.questions.length - 1);
            });
        },

        removeQuestion(index) {
            if (confirm('确定要删除这道题目吗？')) {
                this.questions.splice(index, 1);
                this.saveQuestions();

                // 如果删除的是当前显示的题目，更新当前索引
                if (this.currentQuestionIndex >= index && this.currentQuestionIndex > 0) {
                    this.currentQuestionIndex--;
                }
            }
        },

        async saveQuestions() {
            const supabase = await this.getSupabase();
            const { data, error } = await supabase
                .from('training_questions')
                .upsert(this.questions, { onConflict: 'id' });
            if (error) {
                console.error('保存失败:', error);
                alert('保存失败：' + error.message);
            } else {
                alert('已同步到Supabase！');
            }
        },

        exportQuestions() {
            // 创建深拷贝并处理换行符
            const questionsToExport = JSON.parse(JSON.stringify(this.questions));

            // 将换行符转换为<br>标签
            questionsToExport.forEach(question => {
                if (question.question) {
                    question.question = question.question.replace(/\n/g, '<br>');
                }
                if (question.analysis) {
                    question.analysis = question.analysis.replace(/\n/g, '<br>');
                }
                question.options = question.options.map(option =>
                    option ? option.replace(/\n/g, '<br>') : ''
                );
            });

            const questionsJson = JSON.stringify(questionsToExport, null, 2);
            const jsContent = `window.trainingQuestions = ${questionsJson};`;

            // 创建临时文本区域并复制到剪贴板
            const textArea = document.createElement('textarea');
            textArea.value = jsContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);

            alert('题目数据已复制到剪贴板！');
        },

        importQuestions() {
            const input = prompt('请粘贴题目数据:');
            if (input) {
                try {
                    // 尝试解析JSON
                    const parsed = JSON.parse(input);
                    if (Array.isArray(parsed)) {
                        // 将<br>标签转换回换行符
                        const processedQuestions = parsed.map(question => {
                            if (question.question) {
                                question.question = question.question.replace(/<br>/g, '\n');
                            }
                            if (question.analysis) {
                                question.analysis = question.analysis.replace(/<br>/g, '\n');
                            }
                            if (question.options) {
                                question.options = question.options.map(option =>
                                    option ? option.replace(/<br>/g, '\n') : ''
                                );
                            }
                            return question;
                        });

                        this.questions = processedQuestions;
                        this.saveQuestions();
                        alert('题目数据导入成功！');
                    } else {
                        alert('无效的题目数据格式！');
                    }
                } catch (e) {
                    alert('解析题目数据失败：' + e.message);
                }
            }
        },

        clearAll() {
            if (confirm('确定要清空所有题目吗？此操作不可撤销！')) {
                this.questions = [];
                this.currentQuestionIndex = 0;
                localStorage.removeItem('training-questions');
            }
        },

        toggleSidebar() {
            this.sidebarCollapsed = !this.sidebarCollapsed;
        },

        scrollToQuestion(index) {
            this.currentQuestionIndex = index;
            const questionId = this.questions[index].id;
            const element = document.getElementById(`question-${questionId}`);
            if (element) {
                const headerHeight = document.querySelector('header').offsetHeight;
                const offsetTop = element.offsetTop - headerHeight - 20;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        },

        handleScroll() {
            // 找到当前最接近视口顶部的题目
            const headerHeight = document.querySelector('header').offsetHeight;
            const questionElements = document.querySelectorAll('.question-editor');

            let closestIndex = 0;
            let closestDistance = Infinity;

            questionElements.forEach((element, index) => {
                const rect = element.getBoundingClientRect();
                const distance = Math.abs(rect.top - headerHeight);

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = index;
                }
            });

            this.currentQuestionIndex = closestIndex;
        },

        // 导出单个题目
        exportSingleQuestion(index) {
            const question = this.questions[index];

            // 创建深拷贝并处理换行符
            const questionToExport = JSON.parse(JSON.stringify(question));

            // 将换行符转换为<br>标签
            if (questionToExport.question) {
                questionToExport.question = questionToExport.question.replace(/\n/g, '<br>');
            }
            if (questionToExport.analysis) {
                questionToExport.analysis = questionToExport.analysis.replace(/\n/g, '<br>');
            }
            questionToExport.options = questionToExport.options.map(option =>
                option ? option.replace(/\n/g, '<br>') : ''
            );

            const questionJson = JSON.stringify(questionToExport, null, 2);

            // 创建临时文本区域并复制到剪贴板
            const textArea = document.createElement('textarea');
            textArea.value = questionJson;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);

            alert(`题目 ${question.id} 已复制到剪贴板！`);
        },

        // 批量导出题目
        exportQuestionsFromId() {
            const startId = prompt('请输入起始题号（将导出该题号及之后的所有题目）:');
            if (startId === null) return;

            const startNum = parseInt(startId);
            if (isNaN(startNum) || startNum < 1) {
                alert('请输入有效的题号！');
                return;
            }

            // 筛选题目
            const questionsToExport = this.questions
                .filter(question => question.id >= startNum)
                .map(question => {
                    // 创建深拷贝并处理换行符
                    const processedQuestion = JSON.parse(JSON.stringify(question));

                    if (processedQuestion.question) {
                        processedQuestion.question = processedQuestion.question.replace(/\n/g, '<br>');
                    }
                    if (processedQuestion.analysis) {
                        processedQuestion.analysis = processedQuestion.analysis.replace(/\n/g, '<br>');
                    }
                    processedQuestion.options = processedQuestion.options.map(option =>
                        option ? option.replace(/\n/g, '<br>') : ''
                    );

                    return processedQuestion;
                });

            if (questionsToExport.length === 0) {
                alert(`没有找到题号 ${startNum} 及之后的题目！`);
                return;
            }

            // 如果有多个题目，用逗号分隔；如果只有一个题目，直接导出对象
            let exportContent;
            if (questionsToExport.length === 1) {
                exportContent = JSON.stringify(questionsToExport[0], null, 2);
            } else {
                exportContent = questionsToExport.map(q => JSON.stringify(q, null, 2)).join(',\n');
            }

            // 创建临时文本区域并复制到剪贴板
            const textArea = document.createElement('textarea');
            textArea.value = exportContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);

            alert(`已导出 ${questionsToExport.length} 道题目到剪贴板！`);
        }
    },
    watch: {
        questions: {
            handler() {
                this.saveQuestions();
            },
            deep: true
        }
    }
});