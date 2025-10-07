// 数据库操作
class DatabaseManager {
    constructor() { }

    getSupabase() {
        return window.getSupabase();
    }

    // 题目相关操作
    async getQuestions() {
        try {
            const supabase = this.getSupabase();
            const { data, error } = await supabase
                .from('questions')
                .select('*')
                .order('id');

            if (error) {
                console.error('获取题目失败:', error);
                return [];
            }
            return data || [];
        } catch (error) {
            console.error('获取题目异常:', error);
            return [];
        }
    }

    async getTrainingQuestions() {
        try {
            const supabase = this.getSupabase();
            const { data, error } = await supabase
                .from('training_questions')
                .select('*')
                .order('id');

            if (error) {
                console.error('获取训练题目失败:', error);
                return [];
            }
            return data || [];
        } catch (error) {
            console.error('获取训练题目异常:', error);
            return [];
        }
    }

    async saveQuestion(question) {
        try {
            const supabase = this.getSupabase();
            const { data, error } = await supabase
                .from('questions')
                .upsert(question);

            if (error) {
                console.error('保存题目失败:', error);
                throw error;
            }
            return data;
        } catch (error) {
            console.error('保存题目异常:', error);
            throw error;
        }
    }

    async saveTrainingQuestion(question) {
        try {
            const supabase = this.getSupabase();
            const { data, error } = await supabase
                .from('training_questions')
                .upsert(question);

            if (error) {
                console.error('保存训练题目失败:', error);
                throw error;
            }
            return data;
        } catch (error) {
            console.error('保存训练题目异常:', error);
            throw error;
        }
    }

    async deleteQuestion(id) {
        try {
            const supabase = this.getSupabase();
            const { error } = await supabase
                .from('questions')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('删除题目失败:', error);
                throw error;
            }
        } catch (error) {
            console.error('删除题目异常:', error);
            throw error;
        }
    }

    async deleteTrainingQuestion(id) {
        try {
            const supabase = this.getSupabase();
            const { error } = await supabase
                .from('training_questions')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('删除训练题目失败:', error);
                throw error;
            }
        } catch (error) {
            console.error('删除训练题目异常:', error);
            throw error;
        }
    }

    // 答题记录相关
    async recordAnswer(questionId, questionType, isCorrect, selectedOption = null) {
        if (!window.authManager || !window.authManager.isLoggedIn()) {
            console.log('用户未登录，跳过记录答题');
            return;
        }

        try {
            const supabase = this.getSupabase();

            // 构建数据对象
            const answerData = {
                user_id: window.authManager.currentUser.id,
                question_id: questionId,
                question_type: questionType,
                is_correct: isCorrect,
                selected_option: selectedOption,
                answered_at: new Date().toISOString()
            };

            console.log('保存答题记录:', answerData);

            // 使用 insert 而不是 upsert，让唯一约束来防止重复
            const { error } = await supabase
                .from('user_answers')
                .insert(answerData)
                .select();

            if (error) {
                if (error.code === '23505') { // 唯一约束违反错误代码
                    console.log('用户已做过此题，跳过重复记录');
                } else {
                    console.error('记录答题失败:', error);
                }
            } else {
                console.log('答题记录保存成功');
            }
        } catch (error) {
            console.error('记录答题异常:', error);
        }
    }

    // 获取题目统计信息
    async getQuestionStats(questionId, questionType) {
        // 参数验证
        if (!questionId || !questionType) {
            console.error('获取题目统计失败: 缺少必要参数', { questionId, questionType });
            return {
                totalUsers: 0,
                correctRate: 0,
                mostCommonWrongOption: null
            };
        }

        try {
            const supabase = this.getSupabase();

            console.log('获取题目统计:', { questionId, questionType });

            // 查询所有答题记录，按用户分组，只取每个用户的第一次回答
            const { data, error } = await supabase
                .from('user_answers')
                .select('*')
                .eq('question_id', questionId)
                .eq('question_type', questionType)
                .order('answered_at', { ascending: true });

            if (error) {
                console.error('获取题目统计失败:', error);
                return {
                    totalUsers: 0,
                    correctRate: 0,
                    mostCommonWrongOption: null
                };
            }

            console.log('获取到的答题记录:', data);

            // 按用户去重，只保留每个用户的第一次回答
            const userFirstAnswers = {};
            (data || []).forEach(record => {
                if (!userFirstAnswers[record.user_id]) {
                    userFirstAnswers[record.user_id] = record;
                }
            });

            const userAnswers = Object.values(userFirstAnswers);
            const totalUsers = userAnswers.length;

            console.log('去重后的用户答题记录:', userAnswers);

            if (totalUsers === 0) {
                return {
                    totalUsers: 0,
                    correctRate: 0,
                    mostCommonWrongOption: null
                };
            }

            // 计算正确率
            const correctCount = userAnswers.filter(answer => answer.is_correct).length;
            const correctRate = correctCount / totalUsers;

            console.log('正确率计算:', { totalUsers, correctCount, correctRate });

            // 计算最常错选的选项
            const wrongAnswers = userAnswers.filter(answer => !answer.is_correct);
            const optionCount = {};

            wrongAnswers.forEach(answer => {
                if (answer.selected_option !== null && answer.selected_option !== undefined) {
                    const option = answer.selected_option;
                    optionCount[option] = (optionCount[option] || 0) + 1;
                }
            });

            console.log('错误选项统计:', optionCount);

            let mostCommonWrongOption = null;
            let maxCount = 0;

            Object.keys(optionCount).forEach(option => {
                const count = optionCount[option];
                if (count > maxCount) {
                    maxCount = count;
                    mostCommonWrongOption = parseInt(option);
                }
            });

            console.log('最常错选选项:', mostCommonWrongOption);

            const result = {
                totalUsers,
                correctRate,
                mostCommonWrongOption
            };

            console.log('最终统计结果:', result);
            return result;

        } catch (error) {
            console.error('获取题目统计异常:', error);
            return {
                totalUsers: 0,
                correctRate: 0,
                mostCommonWrongOption: null
            };
        }
    }

    // 考试记录相关
    async saveExamRecord(score) {
        try {
            const supabase = this.getSupabase();
            if (!supabase) {
                console.error('Supabase客户端未初始化');
                return null;
            }

            // 只保存表中实际存在的字段
            const examData = {
                score: score
            };

            console.log('保存考试记录:', examData);

            const { data, error } = await supabase
                .from('exam_records')
                .insert(examData)
                .select();

            if (error) {
                console.error('保存考试记录失败:', error);
                return null;
            } else {
                console.log('考试记录保存成功:', data);
                return data ? data[0] : null;
            }
        } catch (error) {
            console.error('保存考试记录异常:', error);
            return null;
        }
    }

    // 获取考试统计信息
    async getExamStats() {
        try {
            const supabase = this.getSupabase();

            // 只查询存在的字段
            const { data, error } = await supabase
                .from('exam_records')
                .select('score, created_at')  // 只选择实际存在的字段
                .limit(1000);

            if (error) {
                console.error('获取考试统计失败:', error);
                return {
                    totalAttempts: 0,
                    averageScore: 0
                };
            }

            const totalAttempts = data ? data.length : 0;

            if (totalAttempts === 0) {
                return {
                    totalAttempts: 0,
                    averageScore: 0
                };
            }

            const totalScore = data.reduce((sum, record) => sum + (record.score || 0), 0);
            const averageScore = totalScore / totalAttempts;

            console.log('考试统计:', { totalAttempts, averageScore });

            return {
                totalAttempts,
                averageScore: Math.round(averageScore * 10) / 10
            };
        } catch (error) {
            console.error('获取考试统计异常:', error);
            return {
                totalAttempts: 0,
                averageScore: 0
            };
        }
    }

    // 获取用户个人统计
    async getUserStats() {
        if (!window.authManager || !window.authManager.isLoggedIn()) {
            return null;
        }

        try {
            const supabase = this.getSupabase();
            const userId = window.authManager.currentUser.id;

            // 获取用户答题统计
            const { data: answersData, error: answersError } = await supabase
                .from('user_answers')
                .select('is_correct, question_type')
                .eq('user_id', userId);

            if (answersError) {
                console.error('获取用户答题统计失败:', answersError);
            }

            // 获取用户考试记录
            const { data: examData, error: examError } = await supabase
                .from('exam_records')
                .select('score, total_questions, completed_at')
                .eq('user_id', userId)
                .order('completed_at', { ascending: false });

            if (examError) {
                console.error('获取用户考试记录失败:', examError);
            }

            const totalAnswers = answersData ? answersData.length : 0;
            const correctAnswers = answersData ? answersData.filter(a => a.is_correct).length : 0;
            const accuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers * 100) : 0;

            const trainingAnswers = answersData ? answersData.filter(a => a.question_type === 'training').length : 0;
            const normalAnswers = answersData ? answersData.filter(a => a.question_type === 'normal').length : 0;

            const examCount = examData ? examData.length : 0;
            const bestScore = examData && examData.length > 0 ? Math.max(...examData.map(e => e.score || 0)) : 0;

            return {
                totalAnswers,
                correctAnswers,
                accuracy,
                trainingAnswers,
                normalAnswers,
                examCount,
                bestScore,
                recentExams: examData ? examData.slice(0, 5) : []
            };
        } catch (error) {
            console.error('获取用户统计异常:', error);
            return null;
        }
    }

    // 获取排行榜数据
    async getLeaderboard(limit = 10) {
        try {
            const supabase = this.getSupabase();

            // 使用RPC函数获取排行榜（如果存在）
            const { data, error } = await supabase
                .rpc('get_user_leaderboard', { limit_count: limit });

            if (error) {
                console.warn('RPC获取排行榜失败，使用备用方案:', error);
                return this.getLeaderboardFallback(limit);
            }

            return data || [];
        } catch (error) {
            console.error('获取排行榜异常:', error);
            return this.getLeaderboardFallback(limit);
        }
    }

    // 备用排行榜获取方案
    async getLeaderboardFallback(limit = 10) {
        try {
            const supabase = this.getSupabase();

            const { data: answersData, error } = await supabase
                .from('user_answers')
                .select('user_id, is_correct, users(username)')
                .limit(1000);

            if (error) {
                console.error('备用方案获取数据失败:', error);
                return [];
            }

            // 手动计算用户正确率
            const userStats = {};
            (answersData || []).forEach(record => {
                if (!userStats[record.user_id]) {
                    userStats[record.user_id] = {
                        user_id: record.user_id,
                        username: record.users?.username || '匿名用户',
                        total: 0,
                        correct: 0
                    };
                }
                userStats[record.user_id].total++;
                if (record.is_correct) {
                    userStats[record.user_id].correct++;
                }
            });

            // 计算正确率并排序
            const leaderboard = Object.values(userStats)
                .map(user => ({
                    ...user,
                    accuracy: user.total > 0 ? (user.correct / user.total * 100) : 0
                }))
                .sort((a, b) => b.accuracy - a.accuracy)
                .slice(0, limit);

            return leaderboard;
        } catch (error) {
            console.error('备用排行榜获取失败:', error);
            return [];
        }
    }
}

// 创建全局数据库管理器实例
window.dbManager = new DatabaseManager();