// 数据库操作
class DatabaseManager {
    constructor() {
        this.supabase = supabase;
    }

    // 题目相关操作
    async getQuestions() {
        const { data, error } = await this.supabase
            .from('questions')
            .select('*')
            .order('id');

        if (error) throw error;
        return data;
    }

    async getTrainingQuestions() {
        const { data, error } = await this.supabase
            .from('training_questions')
            .select('*')
            .order('id');

        if (error) throw error;
        return data;
    }

    async saveQuestion(question) {
        const { data, error } = await this.supabase
            .from('questions')
            .upsert(question);

        if (error) throw error;
        return data;
    }

    async saveTrainingQuestion(question) {
        const { data, error } = await this.supabase
            .from('training_questions')
            .upsert(question);

        if (error) throw error;
        return data;
    }

    async deleteQuestion(id) {
        const { error } = await this.supabase
            .from('questions')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    async deleteTrainingQuestion(id) {
        const { error } = await this.supabase
            .from('training_questions')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    // 答题记录相关
    async recordAnswer(questionId, questionType, isCorrect) {
        if (!authManager.isLoggedIn()) return;

        const { error } = await this.supabase
            .from('user_answers')
            .upsert({
                user_id: authManager.currentUser.id,
                question_id: questionId,
                question_type: questionType,
                is_correct: isCorrect
            }, {
                onConflict: 'user_id,question_id,question_type'
            });

        if (error) throw error;
    }

    async getQuestionStats(questionId, questionType) {
        const { data, error } = await this.supabase
            .from('user_answers')
            .select('is_correct')
            .eq('question_id', questionId)
            .eq('question_type', questionType);

        if (error) throw error;

        const total = data.length;
        const correct = data.filter(record => record.is_correct).length;
        const correctRate = total > 0 ? (correct / total * 100).toFixed(1) : 0;

        return {
            totalAttempts: total,
            correctRate: correctRate
        };
    }

    // 考试记录相关
    async saveExamRecord(score, totalQuestions) {
        if (!authManager.isLoggedIn()) return;

        const { error } = await this.supabase
            .from('exam_records')
            .insert({
                user_id: authManager.currentUser.id,
                score: score,
                total_questions: totalQuestions
            });

        if (error) throw error;
    }

    async getExamStats() {
        const { data, error } = await this.supabase
            .from('exam_records')
            .select('score, total_questions');

        if (error) throw error;

        const totalAttempts = data.length;
        const totalScore = data.reduce((sum, record) => sum + record.score, 0);
        const averageScore = totalAttempts > 0 ? (totalScore / totalAttempts).toFixed(1) : 0;

        return {
            totalAttempts: totalAttempts,
            averageScore: averageScore
        };
    }
}

// 创建全局数据库管理器实例
window.dbManager = new DatabaseManager();