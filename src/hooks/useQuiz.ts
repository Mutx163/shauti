import { useState, useEffect, useCallback, useRef } from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getDB, Question } from '../db/database';
import { SettingsManager, AutoSkipMode } from '../utils/settings';

export const useQuiz = () => {
    const route = useRoute<any>();
    const {
        bankId,
        bankName,
        mode = 'bank',
        quizMode = 'practice',
        questionType = 'all',
        customQuestions
    } = route.params || {};

    const navigation = useNavigation<any>();
    const hasResetRef = useRef(false); // 增加重置标记位

    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [completed, setCompleted] = useState(false);

    // Track answer history for the grid navigation
    const [answerHistory, setAnswerHistory] = useState<Map<number, any>>(new Map());

    // User Settings
    const [autoSkipMode, setAutoSkipMode] = useState<AutoSkipMode>('off');
    const [autoRemoveMistake, setAutoRemoveMistake] = useState(true);

    // 艾宾浩斯遗忘曲线标准间隔（天）：1, 2, 4, 7, 15, 31, 90, 180
    const SRS_INTERVALS = [1, 2, 4, 7, 15, 31, 90, 180];

    const saveSession = useCallback(async (index: number, history: Map<number, any>, order?: number[]) => {
        if (!bankId || customQuestions) return;
        const db = getDB();
        try {
            const modeKey = mode === 'bank' ? quizMode : `${mode}_${quizMode}`;
            const historyStr = JSON.stringify(Array.from(history.entries()));
            const orderStr = order ? JSON.stringify(order) : null;
            await db.runAsync(
                `INSERT INTO quiz_sessions (bank_id, quiz_mode, current_index, answer_history, question_order) 
                 VALUES (?, ?, ?, ?, ?) 
                 ON CONFLICT(bank_id, quiz_mode) DO UPDATE SET 
                    current_index = ?, 
                    answer_history = ?, 
                    question_order = COALESCE(?, question_order)`,
                bankId, modeKey, index, historyStr, orderStr,
                index, historyStr, orderStr
            );
        } catch (e) {
            console.error('Failed to save session:', e);
        }
    }, [bankId, quizMode, customQuestions, mode]);

    const loadData = useCallback(async () => {
        setLoading(true);
        const db = getDB();
        try {
            // 1. Load Settings
            const skip = await SettingsManager.getAutoSkipMode();
            const remove = await SettingsManager.getAutoRemoveMistake();
            setAutoSkipMode(skip);
            setAutoRemoveMistake(remove);

            // 2. Load Questions
            let result: Question[] = [];
            if (customQuestions) {
                result = customQuestions;
            } else if (mode === 'mistake') {
                let query = `
                    SELECT q.* FROM questions q
                    WHERE EXISTS(
        SELECT 1 FROM user_progress up 
                        WHERE up.question_id = q.id 
                        AND up.id = (SELECT id FROM user_progress WHERE question_id = q.id ORDER BY timestamp DESC LIMIT 1)
                        AND up.is_correct = 0
                    )
`;
                let params: any[] = [];
                if (bankId) {
                    query += ' AND q.bank_id = ?';
                    params.push(bankId);
                }
                result = await db.getAllAsync<Question>(query, ...params);
            } else if (mode === 'review') {
                let query = `
                    SELECT q.* FROM questions q
                    JOIN question_mastery qm ON q.id = qm.question_id
                    WHERE datetime(qm.next_review_time, 'localtime') <= datetime('now', 'localtime')
    `;
                let params: any[] = [];
                if (bankId) {
                    query += ' AND q.bank_id = ?';
                    params.push(bankId);
                }
                result = await db.getAllAsync<Question>(query, ...params);
            } else {
                let query = 'SELECT * FROM questions WHERE bank_id = ?';
                let params: any[] = [bankId];
                if (questionType !== 'all') {
                    query += ' AND type = ?';
                    params.push(questionType);
                }
                result = await db.getAllAsync<Question>(query, ...params);
            }

            const stripInvisible = (val: any) => {
                if (val === null || val === undefined) return '';
                return val.toString().replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
            };
            const normalizeTF = (val: any) => {
                const s = stripInvisible(val).toUpperCase();
                const parts = s.split(/[\s,，;；|]+/).map(p => p.trim()).filter(Boolean);
                for (const p of parts.length ? parts : [s]) {
                    if (p === 'TRUE' || p === 'T' || p === '1' || p === '正确' || p === '对') return 'T';
                    if (p === 'FALSE' || p === 'F' || p === '0' || p === '错误' || p === '错') return 'F';
                }
                return '';
            };
            const normalizeChoice = (val: any) => stripInvisible(val).toUpperCase().split(/[\s,，;；|]+/)[0] || '';
            const isSingleChoice = (s: string) => /^[ABCD]$/.test(s);
            const isMultiChoice = (s: string) => /^[ABCD]{2,4}$/.test(s);

            result = result.map(q => {
                if (!q) return q;
                if (q.type === 'true_false') {
                    // 直接标准化 correct_answer，不做交换逻辑
                    const ca = normalizeTF(q.correct_answer);
                    // 如果标准化成功（得到 T 或 F），使用标准化值；否则保留原值
                    return { ...q, correct_answer: ca || stripInvisible(q.correct_answer) };
                }
                if (q.type === 'single') {
                    // 直接标准化，移除不可靠的交换逻辑
                    const ca = normalizeChoice(q.correct_answer);
                    return { ...q, correct_answer: ca || stripInvisible(q.correct_answer) };
                }
                if (q.type === 'multi') {
                    // 直接标准化，移除不可靠的交换逻辑
                    const ca = normalizeChoice(q.correct_answer).replace(/[^ABCD]/g, '');
                    return { ...q, correct_answer: ca || stripInvisible(q.correct_answer) };
                }
                return { ...q, correct_answer: stripInvisible(q.correct_answer) };
            });

            // 3. Load Session
            let savedIndex = 0;
            let savedHistory = new Map();

            // --- 核心修改：通过 mode 隔离会话 ---
            const modeKey = mode === 'bank' ? quizMode : `${mode}_${quizMode}`;

            // 如果是 reset 模式，先删除旧会话
            const { reset = false } = route.params || {};
            if (reset && bankId && !hasResetRef.current) {
                hasResetRef.current = true; // 锁定，防止重复执行
                console.log(`正在重置 ${modeKey} 模式下的会话进度`);
                try {
                    await db.runAsync(
                        'DELETE FROM quiz_sessions WHERE bank_id = ? AND quiz_mode = ?',
                        bankId, modeKey
                    );
                } catch (err) {
                    console.error('Reset session error', err);
                }
            }

            const session: any = await db.getFirstAsync(
                'SELECT * FROM quiz_sessions WHERE bank_id = ? AND quiz_mode = ?',
                bankId, modeKey
            );

            if (bankId && !customQuestions && session && !reset) {
                savedIndex = session.current_index || 0;
                if (session.answer_history) {
                    try {
                        const entries = JSON.parse(session.answer_history);
                        savedHistory = new Map(entries);
                    } catch (e) { console.error('Parse history error', e); }
                }
                if (session.question_order) {
                    try {
                        const orderIds = JSON.parse(session.question_order);
                        const orderedResult: Question[] = [];
                        orderIds.forEach((id: number) => {
                            const q = result.find(item => item.id === id);
                            if (q) orderedResult.push(q);
                        });
                        // Append any new questions not in the saved order
                        result.forEach(q => {
                            if (!orderIds.includes(q.id)) orderedResult.push(q);
                        });
                        result = orderedResult;
                    } catch (e) { console.error('Parse order error', e); }
                }
            }

            // 4. Handle initial order save for new sessions
            if (result.length > 0 && (!session || reset) && bankId && !customQuestions) {
                if (quizMode === 'practice') {
                    result = result.sort(() => Math.random() - 0.5);
                }
                const orderIds = result.map(q => q.id);
                // 使用隔离后的 modeKey 保存会话
                const historyStr = JSON.stringify([]);
                const orderStr = JSON.stringify(orderIds);
                await db.runAsync(
                    `INSERT INTO quiz_sessions(bank_id, quiz_mode, current_index, answer_history, question_order)
VALUES(?, ?, ?, ?, ?)`,
                    bankId, modeKey, 0, historyStr, orderStr
                );
            }

            const finalQuestions = result;
            const validIndex = Math.min(Math.max(0, savedIndex), Math.max(0, finalQuestions.length - 1));

            setQuestions(finalQuestions);
            setCurrentIndex(validIndex);
            setAnswerHistory(savedHistory);

            const initialHistory = savedHistory.get(validIndex);
            if (initialHistory) {
                setSelectedAnswer(initialHistory.selectedAnswer || null);
                setShowResult(initialHistory.showResult || false);
                setIsCorrect(initialHistory.isCorrect || false);
            } else {
                // 如果没有历史（重置或新题），确保清空当前状态
                setSelectedAnswer(null);
                setShowResult(false);
                setIsCorrect(false);
            }
        } catch (e) {
            console.error('Failed to load quiz data:', e);
        } finally {
            setLoading(false);
        }
    }, [bankId, mode, customQuestions, questionType, quizMode, route.params, saveSession]); // 增加 route.params 和 saveSession 依赖


    useEffect(() => {
        loadData();
    }, [loadData]);

    const updateSRSMastery = async (questionId: number, isCorrect: boolean) => {
        const db = getDB();
        try {
            const masteryData = await db.getAllAsync<{ mastery_level: number }>(
                'SELECT mastery_level FROM question_mastery WHERE question_id = ?',
                questionId
            );

            // 艾宾浩斯逻辑：新题从 -1 开始，首次正确进入 level 0 (待 1 天后复习)
            let currentLevel = masteryData.length > 0 ? masteryData[0].mastery_level : -1;
            let level: number;

            if (isCorrect) {
                // 做对：等级提升 1 级
                level = Math.min(currentLevel + 1, SRS_INTERVALS.length - 1);
            } else {
                // 遗忘回退逻辑：一旦做错，重置到 level 0，即 1 天后重新开始巩固（科学 Lapse 规则）
                level = 0;
            }

            const nextReview = new Date();
            nextReview.setDate(nextReview.getDate() + SRS_INTERVALS[level]);
            const nextReviewStr = nextReview.toISOString();

            await db.runAsync(
                `INSERT INTO question_mastery (question_id, mastery_level, next_review_time, last_review_time) 
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP) 
                 ON CONFLICT(question_id) DO UPDATE SET 
                    mastery_level = ?, 
                    next_review_time = ?, 
                    last_review_time = CURRENT_TIMESTAMP`,
                questionId, level, nextReviewStr, level, nextReviewStr
            );
        } catch (e) {
            console.error('Failed to update SRS:', e);
        }
    };

    const markMastery = useCallback(async (remembered: boolean) => {
        if (!questions[currentIndex]) return;
        await updateSRSMastery(questions[currentIndex].id, remembered);
        handleNext();
    }, [questions, currentIndex]);

    const handleNext = useCallback(() => {
        if (currentIndex < questions.length - 1) {
            const nextIndex = currentIndex + 1;
            const history = answerHistory.get(nextIndex);

            setCurrentIndex(nextIndex);
            setSelectedAnswer(history?.selectedAnswer || null);
            setShowResult(history?.showResult || false);
            setIsCorrect(history?.isCorrect || false);
            saveSession(nextIndex, answerHistory);
        } else {
            setCompleted(true);
            // --- 核心修改：复习/错题完成后清理会话 ---
            if ((mode === 'review' || mode === 'mistake') && bankId) {
                const db = getDB();
                const modeKey = mode === 'bank' ? quizMode : `${mode}_${quizMode}`;
                db.runAsync(
                    'DELETE FROM quiz_sessions WHERE bank_id = ? AND quiz_mode = ?',
                    bankId, modeKey
                ).catch(e => console.error('Auto cleanup session error', e));
            }
        }
    }, [currentIndex, questions.length, answerHistory, saveSession, mode, bankId, quizMode]);


    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            const prevIndex = currentIndex - 1;
            const history = answerHistory.get(prevIndex);

            setCurrentIndex(prevIndex);
            setSelectedAnswer(history?.selectedAnswer || null);
            setShowResult(history?.showResult || false);
            setIsCorrect(history?.isCorrect || false);
            saveSession(prevIndex, answerHistory);
        }
    }, [currentIndex, answerHistory, saveSession]);

    const jumpToIndex = (index: number) => {
        if (index >= 0 && index < questions.length) {
            const history = answerHistory.get(index);
            setCurrentIndex(index);
            setSelectedAnswer(history?.selectedAnswer || null);
            setShowResult(history?.showResult || false);
            setIsCorrect(history?.isCorrect || false);
            saveSession(index, answerHistory);
        }
    };

    // 答案检查辅助函数
    const checkMultiAnswer = (answer: any, correctAnswer: string) => {
        const selectedArr = (Array.isArray(answer) ? answer : []).slice().sort();
        const correctArr = correctAnswer.split('').slice().sort();
        return JSON.stringify(selectedArr) === JSON.stringify(correctArr);
    };

    const normalizeTrueFalse = (val: any) => {
        if (val === null || val === undefined) return '';
        const s = val.toString().replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toUpperCase();
        if (['TRUE', 'T', '1', '正确', '对'].includes(s) || val === true) return 'T';
        if (['FALSE', 'F', '0', '错误', '错'].includes(s) || val === false) return 'F';
        return s;
    };

    const validateAnswer = (type: string, answer: any, correctAnswer: string): boolean => {
        if (!answer && type !== 'fill' && type !== 'short') return false;

        switch (type) {
            case 'multi':
                return checkMultiAnswer(answer, correctAnswer);
            case 'true_false':
                return normalizeTrueFalse(answer) === normalizeTrueFalse(correctAnswer);
            default:
                return answer?.toString().trim().toUpperCase() === correctAnswer?.toString().trim().toUpperCase();
        }
    };

    const checkAnswerInternal = useCallback(async (index: number, answer: any, manualCorrectness?: boolean) => {
        const currentQuestion = questions[index];
        if (!currentQuestion) return;

        const correct = typeof manualCorrectness === 'boolean'
            ? manualCorrectness
            : validateAnswer(currentQuestion.type, answer, currentQuestion.correct_answer);

        // Update local status if it's the current question
        if (index === currentIndex) {
            setIsCorrect(correct);
            setShowResult(true);
        }

        const newHistory = new Map(answerHistory);
        newHistory.set(index, { selectedAnswer: answer, isCorrect: correct, showResult: true });
        setAnswerHistory(newHistory);
        saveSession(currentIndex, newHistory);

        try {
            const db = getDB();

            // --- 核心修改：逻辑解联逻辑 ---
            // 1. 只有做错，或者在“非复习”模式下做对，才更新错题库状态 (复习做对不自动消除错题)
            const shouldUpdateProgress = !correct || mode !== 'review';
            if (shouldUpdateProgress) {
                await db.runAsync(
                    'INSERT INTO user_progress (question_id, is_correct) VALUES (?, ?)',
                    currentQuestion.id,
                    correct ? 1 : 0
                );
            }

            // 2. 只有做错，或者在“非错题”模式下做对，才更新复习计划进度 (练错题不透支正式复习)
            const shouldUpdateMastery = !correct || mode !== 'mistake';
            if (shouldUpdateMastery) {
                await updateSRSMastery(currentQuestion.id, correct);
            }


            if (index === currentIndex) {
                if (correct && autoSkipMode === 'correct_only') {
                    setTimeout(handleNext, 800);
                } else if (autoSkipMode !== 'off' && autoSkipMode !== 'correct_only') {
                    const delay = parseInt(autoSkipMode) * 1000;
                    setTimeout(handleNext, delay);
                }
            }
        } catch (e) {
            console.error('Failed to save progress:', e);
        }
    }, [questions, currentIndex, autoSkipMode, handleNext, answerHistory, saveSession]);

    const submitAnswer = useCallback(async (index: number, answer: any) => {
        // Multi-choice shouldn't check immediately unless specifically submitted
        const q = questions[index];
        if (!q) return;

        if (q.type === 'multi') {
            const newHistory = new Map(answerHistory);
            newHistory.set(index, { selectedAnswer: answer, isCorrect: false, showResult: false });
            setAnswerHistory(newHistory);
            saveSession(currentIndex, newHistory);

            if (index === currentIndex) {
                setSelectedAnswer(answer);
            }
        } else {
            // Single choice, true/false, short, fill usually immediate or semi-immediate
            await checkAnswerInternal(index, answer);
        }
    }, [questions, currentIndex, checkAnswerInternal, answerHistory, saveSession]);

    const checkAnswer = useCallback(async () => {
        await checkAnswerInternal(currentIndex, selectedAnswer);
    }, [currentIndex, selectedAnswer, checkAnswerInternal]);

    const resetQuiz = useCallback(async () => {
        if (!bankId || customQuestions) return;
        const db = getDB();
        try {
            const modeKey = mode === 'bank' ? quizMode : `${mode}_${quizMode}`;
            await db.runAsync(
                'DELETE FROM quiz_sessions WHERE bank_id = ? AND quiz_mode = ?',
                bankId, modeKey
            );

            // 重置内存状态
            setCurrentIndex(0);
            setAnswerHistory(new Map());
            setSelectedAnswer(null);
            setShowResult(false);
            setIsCorrect(false);
            setCompleted(false);

            // 重新加载数据（或者简单地重新洗牌并保存新秩序）
            await loadData();
        } catch (e) {
            console.error('Failed to reset quiz:', e);
        }
    }, [bankId, customQuestions, mode, quizMode, loadData]);

    return {
        questions,
        currentIndex,
        setCurrentIndex: jumpToIndex,
        loading,
        selectedAnswer,
        setSelectedAnswer,
        showResult,
        isCorrect,
        completed,
        answerHistory,
        checkAnswer,
        checkAnswerForIndex: checkAnswerInternal,
        submitAnswer,
        markMastery,
        handleNext,
        handlePrev,
        resetQuiz, // 导出 resetQuiz
        bankName,
        quizMode,
        mode // 也导出 mode 方便 UI 判断
    };
};
