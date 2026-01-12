import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Dimensions, KeyboardAvoidingView, Platform, Keyboard, TouchableOpacity, FlatList } from 'react-native'; // Added TouchableOpacity, FlatList
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button, Card, RadioButton, Checkbox, TextInput, ProgressBar, useTheme, Chip, Divider, IconButton, Portal, Modal } from 'react-native-paper'; // Added Portal, Modal
import { useRoute, useNavigation } from '@react-navigation/native';
import { getDB, Question } from '../db/database';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import MathText from '../components/MathText';
import { SettingsManager, AutoSkipMode } from '../utils/settings';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

export default function QuizScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { bankId, bankName, mode = 'bank', questionType = 'all', quizMode = 'practice', customQuestions } = route.params || {};

    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    // 记录每道题的答题情况（刷题模式下）
    const [answerHistory, setAnswerHistory] = useState<Map<number, any>>(new Map());
    // 自动跳题设置
    const [autoSkipMode, setAutoSkipMode] = useState<AutoSkipMode>('off');
    const [autoRemoveMistake, setAutoRemoveMistake] = useState(true);
    const autoSkipTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 题目导航网格状态
    const [showGrid, setShowGrid] = useState(false);

    // 动态设置导航栏标题：将题库名称与进度整合
    // 动态设置导航栏标题：将题库名称与进度整合，点击可弹出网格
    useLayoutEffect(() => {
        if (!loading && questions.length > 0) {
            navigation.setOptions({
                headerTitle: () => (
                    <TouchableOpacity
                        onPress={() => setShowGrid(true)}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                        <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                            {bankName || '刷题'} ({currentIndex + 1}/{questions.length})
                        </Text>
                        <IconButton icon="chevron-down" size={16} />
                    </TouchableOpacity>
                ),
            });
        }
    }, [navigation, currentIndex, questions.length, loading, bankName]);

    useEffect(() => {
        loadQuestions();
        loadSettings();

        const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
            // 清理定时器
            if (autoSkipTimerRef.current) {
                clearTimeout(autoSkipTimerRef.current);
            }
        };
    }, [bankId, mode]);

    const loadSettings = async () => {
        const mode = await SettingsManager.getAutoSkipMode();
        const remove = await SettingsManager.getAutoRemoveMistake();
        setAutoSkipMode(mode);
        setAutoRemoveMistake(remove);
    };

    // 背题模式自动显示答案（无动画），刷题模式恢复答题状态
    useEffect(() => {
        const question = questions[currentIndex];
        if (!question) return;

        if (quizMode === 'study') {
            // 背题模式：直接显示答案
            setShowResult(true);
            setIsCorrect(true);
            setTimeout(() => {
                setSelectedAnswer(question.correct_answer);
            }, 0);
        } else {
            // 刷题模式：恢复之前的答题状态
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

    const loadQuestions = async () => {
        try {
            const db = getDB();
            let result: Question[] = [];

            if (mode === 'mistake') {
                result = await db.getAllAsync<Question>(
                    `SELECT DISTINCT q.* FROM questions q 
              JOIN user_progress up ON q.id = up.question_id 
              WHERE up.is_correct = 0`
                );
            } else if (mode === 'custom' && customQuestions) {
                // 如果是自定义模式（如搜索跳转），直接使用传入的题目
                result = customQuestions;
            } else if (bankId) {
                // 根据题型筛选
                const typeFilter = questionType === 'all' ? '' : ' AND type = ?';
                const orderBy = quizMode === 'study' ? 'ORDER BY id' : 'ORDER BY RANDOM()';
                const sql = `SELECT * FROM questions WHERE bank_id = ?${typeFilter} ${orderBy}`;
                const params = questionType === 'all' ? [bankId] : [bankId, questionType];
                result = await db.getAllAsync<Question>(sql, ...params);
            }

            setQuestions(result);
            setLoading(false);
        } catch (err) {
            console.error(err);
            Alert.alert('错误', '加载题目失败');
        }
    };

    const currentQuestion = questions[currentIndex];

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setCompleted(true);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const resetState = () => {
        setShowResult(false);
        setSelectedAnswer(null);
        setIsCorrect(false);
    };

    const checkAnswer = async () => {
        if (!selectedAnswer) return;

        Keyboard.dismiss();

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

        // 刷题模式下保存答题记录
        if (quizMode === 'practice') {
            const newHistory = new Map(answerHistory);
            newHistory.set(currentIndex, {
                selectedAnswer,
                showResult: true,
                isCorrect: correct
            });
            setAnswerHistory(newHistory);
        }

        const db = getDB();
        await db.runAsync(
            'INSERT INTO user_progress (question_id, is_correct, user_answer) VALUES (?, ?, ?)',
            currentQuestion.id,
            correct ? 1 : 0,
            JSON.stringify(selectedAnswer)
        );

        // 错题复习模式下，答对且开启自动移除，则清除错题记录
        if (mode === 'mistake' && correct && autoRemoveMistake) {
            await db.runAsync(
                'DELETE FROM user_progress WHERE question_id = ? AND is_correct = 0',
                currentQuestion.id
            );
            // 可选：提示用户
            // Alert.alert('提示', '已从错题本移除');
        }

        // 自动跳题逻辑
        triggerAutoSkip(correct);
    };

    const triggerAutoSkip = (correct: boolean) => {
        // 清理之前的定时器
        if (autoSkipTimerRef.current) {
            clearTimeout(autoSkipTimerRef.current);
        }

        // 如果是最后一题，不自动跳转
        if (currentIndex === questions.length - 1) return;

        let delay = 0;

        switch (autoSkipMode) {
            case 'off':
                return; // 不自动跳转
            case 'correct_only':
                if (correct) {
                    delay = 800; // 答对立刻跳（800ms给用户反应时间）
                } else {
                    return; // 答错不跳
                }
                break;
            case '1s':
                delay = 1000;
                break;
            case '2s':
                delay = 2000;
                break;
            case '3s':
                delay = 3000;
                break;
        }

        autoSkipTimerRef.current = setTimeout(() => {
            handleNext();
        }, delay);
    };

    const onGestureEvent = (event: any) => {
        if (event.nativeEvent.state === State.END) {
            const { translationX, velocityX } = event.nativeEvent;
            // Determine swipe based on distance OR high velocity (flick)
            // Ensure velocity is in the right direction
            if (translationX < -SWIPE_THRESHOLD || (velocityX < -800 && translationX < -20)) {
                handleNext();
            } else if (translationX > SWIPE_THRESHOLD || (velocityX > 800 && translationX > 20)) {
                handlePrev();
            }
        }
    };

    if (loading) return <View style={styles.center}><Text>加载中...</Text></View>;
    if (questions.length === 0) return <View style={styles.center}><Text>没有题目</Text></View>;
    if (completed) {
        return (
            <View style={styles.center}>
                <Text variant="headlineMedium">复习完成！</Text>
                <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                    返回
                </Button>
            </View>
        );
    }

    const options = currentQuestion.options ? JSON.parse(currentQuestion.options) : {};

    return (
        <>
            <PanGestureHandler
                onHandlerStateChange={onGestureEvent}
                activeOffsetX={[-15, 15]} // 更容易触发水平滑动
                failOffsetY={[-20, 20]}   // 稍微放宽垂直容差，避免轻微斜向滑动导致失效
            >
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                        <ProgressBar progress={(currentIndex + 1) / questions.length} color={theme.colors.primary} style={styles.progressBar} />

                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <Card style={styles.card} mode="contained">
                                <Card.Content>
                                    <View style={styles.questionTextContainer}>
                                        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(currentQuestion.type, theme) }]}>
                                            <Text style={styles.typeBadgeText}>{getTypeLabel(currentQuestion.type)}</Text>
                                        </View>
                                        <MathText content={currentQuestion.content} fontSize={18} baseStyle={{ flex: 1 }} />
                                    </View>
                                </Card.Content>
                            </Card>

                            <View style={styles.optionsContainer}>
                                {renderOptions({
                                    question: currentQuestion,
                                    options,
                                    selectedAnswer,
                                    setSelectedAnswer,
                                    showResult,
                                    theme
                                })}
                            </View>

                            {showResult && (
                                <View style={[styles.resultContainer, { backgroundColor: isCorrect ? theme.colors.primaryContainer : theme.colors.errorContainer, borderColor: isCorrect ? theme.colors.primary : theme.colors.error }]}>
                                    <Text variant="titleMedium" style={{ color: isCorrect ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer, marginBottom: 4 }}>
                                        {isCorrect ? '✓ 回答正确' : '✗ 回答错误'}
                                    </Text>
                                    {!isCorrect && (
                                        <View style={{ marginBottom: 8 }}>
                                            <Text variant="bodyMedium" style={{ fontWeight: 'bold', marginBottom: 4 }}>正确答案：</Text>
                                            <MathText content={currentQuestion.correct_answer} fontSize={14} color="#000" />
                                        </View>
                                    )}
                                    <Divider style={{ marginVertical: 8, opacity: 0.3 }} />
                                    <Text variant="bodySmall" style={{ fontStyle: 'italic', opacity: 0.8, marginBottom: 4 }}>解析：</Text>
                                    <MathText content={currentQuestion.explanation || '暂无详细解析。'} fontSize={14} color="rgba(0,0,0,0.8)" />
                                </View>
                            )}
                        </ScrollView>

                        <View style={[
                            styles.footer,
                            {
                                paddingBottom: keyboardHeight > 0
                                    ? (Platform.OS === 'android' ? 12 : 8)
                                    : Math.max(insets.bottom, 16),
                                paddingTop: 12
                            }
                        ]}>
                            {quizMode === 'study' ? (
                                // 背题模式：只显示导航按钮
                                <View style={styles.footerButtons}>
                                    <Button
                                        mode="outlined"
                                        onPress={handlePrev}
                                        disabled={currentIndex === 0}
                                        style={styles.navButton}
                                        contentStyle={{ height: 48 }}
                                    >
                                        上一题
                                    </Button>
                                    <Button
                                        mode="contained"
                                        onPress={handleNext}
                                        disabled={currentIndex === questions.length - 1}
                                        style={styles.navButton}
                                        contentStyle={{ height: 48 }}
                                    >
                                        {currentIndex < questions.length - 1 ? '下一题' : '完成'}
                                    </Button>
                                </View>
                            ) : (
                                // 刷题模式：根据是否提交显示不同按钮
                                <View style={styles.footerButtons}>
                                    <Button
                                        mode="outlined"
                                        onPress={handlePrev}
                                        disabled={currentIndex === 0}
                                        style={styles.sideButton}
                                        compact
                                    >
                                        上一题
                                    </Button>

                                    {!showResult ? (
                                        <Button
                                            mode="contained"
                                            onPress={checkAnswer}
                                            disabled={!selectedAnswer}
                                            style={styles.mainButton}
                                            contentStyle={{ height: 44 }}
                                        >
                                            提交答案
                                        </Button>
                                    ) : (
                                        <Button
                                            mode="contained"
                                            onPress={currentIndex === questions.length - 1 ? () => setCompleted(true) : handleNext}
                                            style={styles.mainButton}
                                            contentStyle={{ height: 44 }}
                                        >
                                            {currentIndex < questions.length - 1 ? '下一题' : '完成'}
                                        </Button>
                                    )}
                                </View>
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </PanGestureHandler>
            <Portal>
                <Modal
                    visible={showGrid}
                    onDismiss={() => setShowGrid(false)}
                    contentContainerStyle={{ backgroundColor: 'white', margin: 20, borderRadius: 16, padding: 16, maxHeight: '80%' }}
                >
                    <Text variant="titleMedium" style={{ marginBottom: 16, textAlign: 'center' }}>快速跳转</Text>
                    <FlatList
                        data={questions}
                        numColumns={6}
                        keyExtractor={(_, index) => index.toString()}
                        renderItem={({ item, index }) => {
                            const isCurrent = index === currentIndex;
                            const history = answerHistory.get(index);
                            let backgroundColor = '#f0f0f0';
                            let borderColor = 'transparent';
                            let textColor = 'black';


                            // Check "answered" status first (even if result not shown in some modes, though here we rely on history)
                            // If user emphasized "done", we should check if there is any history.
                            if (history) {
                                // "Done" status
                                if (history.showResult) {
                                    // Verified Correct/Incorrect
                                    if (history.isCorrect) {
                                        backgroundColor = '#c8e6c9'; // Stronger Green
                                        textColor = '#1b5e20';
                                    } else {
                                        backgroundColor = '#ffcdd2'; // Stronger Red
                                        textColor = '#b71c1c';
                                    }
                                } else {
                                    // Answered but result not shown (e.g. strict mock mode? or just selected)
                                    // If we want to show "selected", use a different color.
                                    // Assuming "done" meant submitted/result known.
                                    backgroundColor = '#bbdefb'; // Light Blue for answered state if needed
                                    textColor = '#0d47a1';
                                }
                            }

                            if (isCurrent) {
                                borderColor = theme.colors.primary;
                            }

                            return (
                                <TouchableOpacity
                                    style={{
                                        width: (SCREEN_WIDTH - 40 - 32 - (12 * 5)) / 6, // (Screen - ModalMargin - ModalPadding - Gaps) / Columns. 
                                        // Wait, easier approach: width/height fixed or percentage.
                                        // Let's use flex: 0 and fixed dimensions based on window width.
                                        // Margin 20*2 = 40. Padding 16*2 = 32. Total usable width = W - 72.
                                        // Gap = 8 (marginHorizontal 4 * 2). 
                                        // ItemWidth = (W - 72 - (6 * 8)) / 6? No, margin is part of item box model usually if passed to style.
                                        // Let's rely on flex basis but prevent growth.
                                        width: (SCREEN_WIDTH - 72) / 6 - 8,
                                        height: (SCREEN_WIDTH - 72) / 6 - 8,
                                        margin: 4,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        backgroundColor,
                                        borderRadius: 8,
                                        borderWidth: 2,
                                        borderColor
                                    }}
                                    onPress={() => {
                                        setCurrentIndex(index);
                                        setShowGrid(false);
                                    }}
                                >
                                    <Text style={{ color: textColor, fontWeight: isCurrent ? 'bold' : 'normal' }}>{index + 1}</Text>
                                </TouchableOpacity>
                            );
                        }}
                    />
                </Modal>
            </Portal>
        </>
    );
}

function getTypeLabel(type: string) {
    const map: any = {
        'single': '单选',
        'multi': '多选',
        'true_false': '判断',
        'fill': '填空',
        'short': '简答'
    };
    return map[type] || '题目';
}

function getTypeColor(type: string, theme: any) {
    const map: any = {
        'single': '#E3F2FD',
        'multi': '#F3E5F5',
        'true_false': '#E8F5E9',
        'fill': '#FFF3E0',
        'short': '#FBE9E7'
    };
    return map[type] || theme.colors.secondaryContainer;
}

function renderOptions({ question, options, selectedAnswer, setSelectedAnswer, showResult, theme }: any) {
    const disabled = showResult;

    if (question.type === 'single' || question.type === 'true_false') {
        const isBool = question.type === 'true_false';
        const renderOpts = isBool ? { 'T': '正确', 'F': '错误' } : options;
        const entries = Object.entries(renderOpts).filter(([_, v]) => (!!v && v.toString().trim() !== '') || isBool);

        if (entries.length === 0) {
            return (
                <View style={styles.errorBox}>
                    <Text style={{ color: theme.colors.error }}>未找到选项数据</Text>
                    <Text variant="bodySmall">提示：请尝试删除该题库并重新导入。</Text>
                </View>
            );
        }

        return (
            <RadioButton.Group onValueChange={newValue => setSelectedAnswer(newValue)} value={selectedAnswer}>
                {entries.map(([key, value]: any) => (
                    <Card key={key} style={styles.optionCard} mode={selectedAnswer === key ? 'contained' : 'outlined'}>
                        <RadioButton.Item
                            label=""
                            value={key}
                            disabled={disabled}
                            status={selectedAnswer === key ? 'checked' : 'unchecked'}
                        />
                        <View style={styles.optionMathContainer}>
                            <MathText content={isBool ? value : `${key}. ${value}`} fontSize={16} color={selectedAnswer === key ? theme.colors.onPrimaryContainer : theme.colors.onSurface} />
                        </View>
                    </Card>
                ))}
            </RadioButton.Group>
        );
    }

    if (question.type === 'multi') {
        const currentSelected = (selectedAnswer as string[]) || [];
        const toggle = (key: string) => {
            if (currentSelected.includes(key)) {
                setSelectedAnswer(currentSelected.filter(k => k !== key));
            } else {
                setSelectedAnswer([...currentSelected, key]);
            }
        };

        const entries = Object.entries(options).filter(([_, v]) => !!v);

        if (entries.length === 0) {
            return <Text style={{ color: 'orange', padding: 10 }}>未找到选项数据</Text>;
        }

        return (
            <View>
                {entries.map(([key, value]: any) => {
                    const isSelected = currentSelected.includes(key);
                    return (
                        <Card
                            key={key}
                            style={styles.optionCard}
                            mode={isSelected ? 'contained' : 'outlined'}
                            onPress={() => !disabled && toggle(key)}
                        >
                            <Checkbox.Item
                                label=""
                                status={isSelected ? 'checked' : 'unchecked'}
                                onPress={() => !disabled && toggle(key)}
                                disabled={disabled}
                            />
                            <View style={styles.optionMathContainer}>
                                <MathText content={`${key}. ${value}`} fontSize={16} color={isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurface} />
                            </View>
                        </Card>
                    );
                })}
            </View>
        );
    }

    if (question.type === 'fill' || question.type === 'short') {
        return (
            <TextInput
                mode="outlined"
                label="填写答案"
                placeholder="在此输入您的回答..."
                value={selectedAnswer || ''}
                onChangeText={setSelectedAnswer}
                disabled={disabled}
                multiline={question.type === 'short'}
                style={styles.textInput}
                outlineStyle={{ borderRadius: 12 }}
            />
        );
    }

    return null;
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    progressBar: { height: 3 },
    scrollContent: { padding: 16, paddingBottom: 24 },
    card: { marginBottom: 20, borderRadius: 16 },
    questionTextContainer: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap' },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginRight: 8,
        marginTop: 4,
        alignSelf: 'flex-start'
    },
    typeBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#555' },
    questionBody: { fontSize: 18, lineHeight: 28, fontWeight: '500', flex: 1 },
    optionMathContainer: { paddingHorizontal: 16, paddingBottom: 12, marginTop: -35 }, // Adjust to overlap/align with radio/checkbox correctly
    optionsContainer: { marginBottom: 20 },
    optionCard: { marginBottom: 10, borderRadius: 16 },
    optionText: { fontSize: 16, flex: 1, textAlign: 'left' },
    textInput: { backgroundColor: 'white', marginBottom: 10 },
    errorBox: { padding: 16, backgroundColor: '#fff3e0', borderRadius: 12, borderWidth: 1, borderColor: '#ffb74d' },
    resultContainer: {
        padding: 16,
        borderRadius: 16,
        marginTop: 4,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
    },
    footer: {
        paddingHorizontal: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        backgroundColor: 'white'
    },
    footerButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    navButton: { flex: 1, marginHorizontal: 6, borderRadius: 12 },
    sideButton: { flex: 1, marginHorizontal: 4, borderRadius: 12 },
    mainButton: { flex: 1.5, marginHorizontal: 4, borderRadius: 12 },
    submitButton: { borderRadius: 24, marginVertical: 4 }
});
