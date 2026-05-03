new Vue({
    el: '#editor-app',
    data: {
        questions: [],
        sidebarCollapsed: false,
        currentQuestionIndex: 0,
        syncing: false,
        syncError: null
    },
    computed: {
        currentQuestion() {
            return this.questions[this.currentQuestionIndex] || null;
        },
        hasQuestions() {
            return this.questions.length > 0;
        }
    },
    async mounted() {
        const supabase = await this.getSupabase();
        const { data, error } = await supabase
            .from('questions')
            .select('*')
            .order('id');

        if (!error && data) {
            console.log('从Supabase获取的数据:', data);
            // 从 Supabase 获取数据时，将 <br> 转回 \n
            this.questions = data.map(question => this.convertFromSupabase(question));
            console.log('转换后的数据:', this.questions);
            this.currentQuestionIndex = this.questions.length > 0 ? 0 : 0;
        } else {
            console.error('获取数据失败:', error);
        }
    },
    beforeDestroy() {
    },
    methods: {
        getTypeColor(type) {
            const typeColors = {
                1: 'rgb(127, 94, 192)',
                2: 'rgb(33, 198, 208)',
                3: 'rgb(158, 220, 35)',
                4: 'rgb(255, 192, 0)',
                5: 'rgb(255, 98, 61)'
            };
            return typeColors[type] || 'rgb(136, 136, 136)';
        },

        getDifficultyColor(difficulty) {
            const difficultyColors = {
                1: 'rgb(158, 220, 35)',
                2: 'rgb(33, 198, 208)',
                3: 'rgb(127, 94, 192)',
                4: 'rgb(255, 192, 0)',
                5: 'rgb(255, 98, 61)'
            };
            return difficultyColors[difficulty] || 'rgb(136, 136, 136)';
        },

        getColorTint(color, alpha) {
            const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
            if (!match) return color;
            const [, red, green, blue] = match;
            return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
        },

        // 更新关键词数组
        updateKeywords(question) {
            if (question.keywordsInput) {
                // 分割字符串并去除空格
                question.keywords = question.keywordsInput.split(',' || '，')
                    .map(keyword => keyword.trim())
                    .filter(keyword => keyword.length > 0);
            } else {
                question.keywords = [];
            }
        },

        async getSupabase() {
            if (window.supabaseClient) return window.supabaseClient;

            const { createClient } = supabase;
            window.supabaseClient = createClient(
                window.SUPABASE_CONFIG.SUPABASE_URL,
                window.SUPABASE_CONFIG.SUPABASE_ANON_KEY
            );
            return window.supabaseClient;
        },

        // 同步到 Supabase 前的转换
        convertToSupabase(question) {
            const converted = { ...question };

            if (converted.question) {
                converted.question = converted.question.replace(/\n/g, '<br>');
            }
            if (converted.background) {
                converted.background = converted.background.replace(/\n/g, '<br>');
            }
            if (converted.analysis) {
                converted.analysis = converted.analysis.replace(/\n/g, '<br>');
            }
            if (converted.options) {
                converted.options = converted.options.map(option =>
                    option ? option.replace(/\n/g, '<br>') : ''
                );
            }

            // 确保 keywords 字段存在
            converted.keywords = converted.keywords || [];

            // 移除临时的 keywordsInput 字段
            delete converted.keywordsInput;

            return converted;
        },


        // 从 Supabase 获取后的转换
        convertFromSupabase(question) {
            const converted = { ...question };

            if (converted.question) {
                converted.question = converted.question.replace(/<br>/g, '\n');
            }
            if (converted.background) {
                converted.background = converted.background.replace(/<br>/g, '\n');
            }
            if (converted.analysis) {
                converted.analysis = converted.analysis.replace(/<br>/g, '\n');
            }
            if (converted.options) {
                converted.options = converted.options.map(option =>
                    option ? option.replace(/<br>/g, '\n') : ''
                );
            }

            // 确保 keywords 字段存在并创建输入字段
            converted.keywords = converted.keywords || [];
            converted.keywordsInput = converted.keywords.join(', ');

            // 确保 background 字段存在
            converted.background = converted.background || '';

            return converted;
        },

        addQuestion() {
            const newId = this.questions.length > 0
                ? Math.max(...this.questions.map(q => q.id)) + 1
                : 1;

            this.questions.push({
                id: newId,
                type: 1,
                difficulty: 1,
                resource: '',
                background: '',
                question: '',
                picture: false,
                options: ['', '', '', ''],
                answer: 1,
                analysis: '',
                keywords: [], // 新增字段
                keywordsInput: '' // 临时输入字段
            });

            this.$nextTick(() => {
                this.currentQuestionIndex = this.questions.length - 1;
            });
        },


        removeQuestion(index) {
            if (confirm('确定要删除这道题目吗？')) {
                this.questions.splice(index, 1);

                // 如果删除的是当前显示的题目，更新当前索引
                if (this.currentQuestionIndex >= index && this.currentQuestionIndex > 0) {
                    this.currentQuestionIndex--;
                }

                if (this.questions.length === 0) {
                    this.currentQuestionIndex = 0;
                } else if (this.currentQuestionIndex >= this.questions.length) {
                    this.currentQuestionIndex = this.questions.length - 1;
                }
            }
        },

        async saveQuestions() {
            await this.syncToSupabase();
        },

        async syncToSupabase() {
            if (this.syncing) return;
            this.syncing = true;
            this.syncError = null;
            try {
                const supabase = await this.getSupabase();

                console.log('同步前的数据:', this.questions);

                // 同步前转换所有数据
                const questionsToSync = this.questions.map(question =>
                    this.convertToSupabase(question)
                );

                console.log('准备同步的数据:', questionsToSync);

                const { data, error } = await supabase
                    .from('questions')
                    .upsert(questionsToSync, { onConflict: 'id' })
                    .select();

                if (error) throw error;

                console.log('同步成功，返回的数据:', data);
                alert('已同步到 Supabase！');
            } catch (e) {
                this.syncError = e.message;
                console.error('同步失败:', e);
                alert('同步失败：' + e.message);
            } finally {
                this.syncing = false;
            }
        },

        exportQuestions() {
            // 创建深拷贝并处理换行符（使用转换方法）
            const questionsToExport = this.questions.map(question =>
                this.convertToSupabase(JSON.parse(JSON.stringify(question)))
            );

            const questionsJson = JSON.stringify(questionsToExport, null, 2);
            const jsContent = `window.questions = ${questionsJson};`;

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
                    const parsed = JSON.parse(input);
                    if (Array.isArray(parsed)) {
                        // 导入时转换数据格式
                        this.questions = parsed.map(question =>
                            this.convertFromSupabase(question)
                        );
                        this.currentQuestionIndex = this.questions.length > 0 ? 0 : 0;
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
            }
        },

        toggleSidebar() {
            this.sidebarCollapsed = !this.sidebarCollapsed;
        },

        selectQuestion(index) {
            this.currentQuestionIndex = index;
        },

        // 导出单个题目
        exportSingleQuestion(index) {
            const question = this.questions[index];

            // 使用转换方法
            const questionToExport = this.convertToSupabase(
                JSON.parse(JSON.stringify(question))
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

            // 筛选题目并使用转换方法
            const questionsToExport = this.questions
                .filter(question => question.id >= startNum)
                .map(question =>
                    this.convertToSupabase(JSON.parse(JSON.stringify(question)))
                );

            if (questionsToExport.length === 0) {
                alert(`没有找到题号 ${startNum} 及之后的题目！`);
                return;
            }

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
        },

        getTypeName(type) {
            const typeNames = {
                1: '干员调配',
                2: '空间部署',
                3: '效能审计',
                4: '横向分析',
                5: '作战环境'
            };
            return typeNames[type] || '未知';
        }
    }
});
