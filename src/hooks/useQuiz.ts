import { useState, useEffect, useCallback } from 'react';
import { useRoute } from '@react-navigation/native';
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

    const SRS_INTERVALS = [0, 1, 3, 7, 15, 30, 60, 120]; // Scientific intervals (Days)

    const saveSession = useCallback(async (index: number, history: Map<number, any>, order?: number[]) => {
        if (!bankId || customQuestions) return;
        const db = getDB();
        try {
            const historyStr = JSON.stringify(Array.from(history.entries()));
            const orderStr = order ? JSON.stringify(order) : null;
            await db.runAsync(
                `INSERT INTO quiz_sessions (bank_id, quiz_mode, current_index, answer_history, question_order) 
                 VALUES (?, ?, ?, ?, ?) 
                 ON CONFLICT(bank_id, quiz_mode) DO UPDATE SET 
                    current_index = ?, 
                    answer_history = ?, 
                    question_order = COALESCE(?, question_order)`,
                bankId, quizMode, index, historyStr, orderStr,
                index, historyStr, orderStr
            );
        } catch (e) {
            console.error('Failed to save session:', e);
        }
    }, [bankId, quizMode, customQuestions]);

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
                    WHERE EXISTS (
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

            // 3. Load Session
            let savedIndex = 0;
            let savedHistory = new Map();
            const session: any = await db.getFirstAsync(
                'SELECT * FROM quiz_sessions WHERE bank_id = ? AND quiz_mode = ?',
                bankId, quizMode
            );

            if (bankId && !customQuestions && session) {
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
            if (result.length > 0 && !session && bankId && !customQuestions) {
                if (quizMode === 'practice') {
                    result = result.sort(() => Math.random() - 0.5);
                }
                const orderIds = result.map(q => q.id);
                await saveSession(0, new Map(), orderIds);
            }

            setQuestions(result);
            setCurrentIndex(savedIndex);
            setAnswerHistory(savedHistory);

            const initialHistory = savedHistory.get(savedIndex);
            if (initialHistory) {
                setSelectedAnswer(initialHistory.selectedAnswer || null);
                setShowResult(initialHistory.showResult || false);
                setIsCorrect(initialHistory.isCorrect || false);
            }
        } catch (e) {
            console.error('Failed to load quiz data:', e);
        } finally {
            setLoading(false);
        }
    }, [bankId, mode, customQuestions, questionType, quizMode, saveSession]);

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

            let level = masteryData[0]?.mastery_level || 0;
            if (isCorrect) {
                level = Math.min(level + 1, SRS_INTERVALS.length - 1);
            } else {
                // Scientific Lapse Logic:
                // If the user fails at a high level (>3), reset to level 1 to re-learn.
                // If they fail at a low level, reset to level 0.
                level = level > 3 ? 1 : 0;
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
        }
    }, [currentIndex, questions.length, answerHistory, saveSession]);

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

    const checkAnswerInternal = useCallback(async (index: number, answer: any) => {
        const currentQuestion = questions[index];
        if (!currentQuestion) return;

        let correct = false;
        if (currentQuestion.type === 'multi') {
            const selectedArr = (answer as string[] || []).slice().sort();
            const correctArr = currentQuestion.correct_answer.split('').slice().sort();
            correct = JSON.stringify(selectedArr) === JSON.stringify(correctArr);
        } else if (currentQuestion.type === 'true_false') {
            correct = answer === currentQuestion.correct_answer;
        } else {
            const normalizedSelected = answer?.toString().trim().toUpperCase();
            const normalizedCorrect = currentQuestion.correct_answer.trim().toUpperCase();
            correct = normalizedSelected === normalizedCorrect;
        }

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
            await db.runAsync(
                'INSERT INTO user_progress (question_id, is_correct) VALUES (?, ?)',
                currentQuestion.id,
                correct ? 1 : 0
            );

            await updateSRSMastery(currentQuestion.id, correct);

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
        bankName,
        quizMode
    };
};
