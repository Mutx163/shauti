
import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getDB, Question } from '../db/database';
import { SettingsManager, AutoSkipMode } from '../utils/settings';

interface UseQuizProps {
    routeParams: any;
}

export interface AnswerHistoryItem {
    selectedAnswer: any;
    showResult: boolean;
    isCorrect: boolean;
}

export function useQuiz() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { bankId, bankName, mode = 'bank', questionType = 'all', quizMode = 'practice', customQuestions } = route.params || {};

    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [completed, setCompleted] = useState(false);

    // 记录每道题的答题情况（刷题模式下）
    const [answerHistory, setAnswerHistory] = useState<Map<number, AnswerHistoryItem>>(new Map());

    // 自动跳题设置
    const [autoSkipMode, setAutoSkipMode] = useState<AutoSkipMode>('off');
    const [autoRemoveMistake, setAutoRemoveMistake] = useState(true);
    const autoSkipTimerRef = useRef<NodeJS.Timeout | null>(null);

    const loadSettings = useCallback(async () => {
        const mode = await SettingsManager.getAutoSkipMode();
        const remove = await SettingsManager.getAutoRemoveMistake();
        setAutoSkipMode(mode);
        setAutoRemoveMistake(remove);
    }, []);

    const loadQuestions = useCallback(async () => {
        try {
            setLoading(true);
            const db = getDB();
            let result: Question[] = [];

            if (mode === 'mistake') {
                result = await db.getAllAsync<Question>(
                    `SELECT DISTINCT q.* FROM questions q 
              JOIN user_progress up ON q.id = up.question_id 
              WHERE up.is_correct = 0`
                );
            } else if (mode === 'custom' && customQuestions) {
                result = customQuestions;
            } else if (bankId) {
                const typeFilter = questionType === 'all' ? '' : ' AND type = ?';
                const orderBy = quizMode === 'study' ? 'ORDER BY id' : 'ORDER BY RANDOM()';
                const sql = `SELECT * FROM questions WHERE bank_id = ?${typeFilter} ${orderBy}`;
                const params = questionType === 'all' ? [bankId] : [bankId, questionType];
                result = await db.getAllAsync<Question>(sql, ...params);
            }

            setQuestions(result);
        } catch (err) {
            console.error(err);
            Alert.alert('错误', '加载题目失败');
        } finally {
            setLoading(false);
        }
    }, [mode, customQuestions, bankId, questionType, quizMode]);

    useEffect(() => {
        loadQuestions();
        loadSettings();

        return () => {
            if (autoSkipTimerRef.current) {
                clearTimeout(autoSkipTimerRef.current);
            }
        };
    }, [loadQuestions, loadSettings]);

    // 背题模式自动显示答案（无动画），刷题模式恢复答题状态
    useEffect(() => {
        const question = questions[currentIndex];
        if (!question) return;

        if (quizMode === 'study') {
            setShowResult(true);
            setIsCorrect(true);
            // Use setTimeout to avoid render cycle issues if necessary, though direct setting is usually fine
            setSelectedAnswer(question.correct_answer);
        } else {
            const history = answerHistory.get(currentIndex);
            if (history) {
                setSelectedAnswer(history.selectedAnswer);
                setShowResult(history.showResult);
                setIsCorrect(history.isCorrect);
            } else {
                setSelectedAnswer(null);
                setShowResult(false);
                setIsCorrect(false);
            }
        }
    }, [currentIndex, quizMode, questions, answerHistory]);

    const handleNext = useCallback(() => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setCompleted(true);
        }
    }, [currentIndex, questions.length]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex]);

    const triggerAutoSkip = useCallback((correct: boolean) => {
        if (autoSkipTimerRef.current) {
            clearTimeout(autoSkipTimerRef.current);
        }

        if (currentIndex === questions.length - 1) return;

        let delay = 0;
        switch (autoSkipMode) {
            case 'off': return;
            case 'correct_only':
                if (correct) delay = 800;
                else return;
                break;
            case '1s': delay = 1000; break;
            case '2s': delay = 2000; break;
            case '3s': delay = 3000; break;
        }

        if (delay > 0) {
            autoSkipTimerRef.current = setTimeout(() => {
                handleNext();
            }, delay);
        }
    }, [autoSkipMode, currentIndex, questions.length, handleNext]);

    const checkAnswer = useCallback(async () => {
        if (!selectedAnswer) return;

        const currentQuestion = questions[currentIndex];
        let correct = false;
        const correctVal = currentQuestion.correct_answer;

        if (currentQuestion.type === 'multi') {
            const userAns = (selectedAnswer as string[]).sort().join('');
            const realAns = correctVal.replace(/[,，]/g, '').split('').sort().join('');
            correct = userAns.toUpperCase() === realAns.toUpperCase();
        } else {
            correct = selectedAnswer.toString().trim().toUpperCase() === correctVal.toString().trim().toUpperCase();
        }

        setIsCorrect(correct);
        setShowResult(true);

        if (quizMode === 'practice') {
            setAnswerHistory(prev => {
                const newHistory = new Map(prev);
                newHistory.set(currentIndex, {
                    selectedAnswer,
                    showResult: true,
                    isCorrect: correct
                });
                return newHistory;
            });
        }

        const db = getDB();
        await db.runAsync(
            'INSERT INTO user_progress (question_id, is_correct, user_answer) VALUES (?, ?, ?)',
            currentQuestion.id,
            correct ? 1 : 0,
            JSON.stringify(selectedAnswer)
        );

        if (mode === 'mistake' && correct && autoRemoveMistake) {
            await db.runAsync(
                'DELETE FROM user_progress WHERE question_id = ? AND is_correct = 0',
                currentQuestion.id
            );
        }

        triggerAutoSkip(correct);
    }, [selectedAnswer, questions, currentIndex, quizMode, mode, autoRemoveMistake, triggerAutoSkip]);

    return {
        questions,
        currentIndex,
        setCurrentIndex,
        loading,
        selectedAnswer,
        setSelectedAnswer,
        showResult,
        isCorrect,
        completed,
        setCompleted,
        answerHistory,
        checkAnswer,
        handleNext,
        handlePrev,
        bankName,
        quizMode,
        autoSkipMode
    };
}
