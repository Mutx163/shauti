import React, { useLayoutEffect, useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, KeyboardAvoidingView, Platform, Keyboard, TouchableOpacity, FlatList, LayoutAnimation, Alert, Animated, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button, Card, RadioButton, Checkbox, TextInput, ProgressBar, useTheme, Divider, IconButton, Portal, Modal } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { State, PanGestureHandler } from 'react-native-gesture-handler';
import MathText from '../components/MathText';
import { useQuiz } from '../hooks/useQuiz';
import { getDB } from '../db/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

export default function QuizScreen() {
    const navigation = useNavigation<any>();
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    const {
        questions,
        currentIndex,
        setCurrentIndex,
        loading,
        selectedAnswer,
        setSelectedAnswer,
        showResult,
        isCorrect,
        completed,
        answerHistory,
        checkAnswer,
        checkAnswerForIndex,
        submitAnswer,
        markMastery,
        handleNext,
        handlePrev,
        resetQuiz,
        bankName,
        quizMode,
        mode
    } = useQuiz();

    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [showGrid, setShowGrid] = useState(false);
    const [viewMode, setViewMode] = useState<'page' | 'scroll' | 'flashcard'>('page');
    const [isFlipped, setIsFlipped] = useState(false);
    // 列表模式下每个题目的临时答案
    const [scrollModeAnswers, setScrollModeAnswers] = useState<Map<number, any>>(new Map());
    // 记录已手动揭示答案的题目索引 (用于填空/简答的自评模式)
    const [revealedIndices, setRevealedIndices] = useState(new Set<number>());

    // 新增：Toast 提示状态
    const [showToast, setShowToast] = useState(false);
    const toastOpacity = React.useRef(new Animated.Value(0)).current;

    // 监听完成状态显示 Toast
    useEffect(() => {
        if (completed && !showToast) {
            setShowToast(true);
            Animated.timing(toastOpacity, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();

            // 3秒后自动淡出 (符合安卓短 Toast 习惯)
            const timer = setTimeout(() => {
                Animated.timing(toastOpacity, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }).start(() => setShowToast(false));
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [completed]);

    const handleReset = useCallback(() => {
        Alert.alert(
            '重新开始',
            '确定要清空本次复习进度并重新开始吗？',
            [
                { text: '取消', style: 'cancel' },
                { text: '确定', onPress: () => resetQuiz() }
            ]
        );
    }, [resetQuiz]);

    // 优化视图模式切换
    const toggleViewMode = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsFlipped(false);
        setViewMode(prev => {
            if (quizMode === 'practice') {
                return prev === 'page' ? 'scroll' : 'page';
            }
            return prev === 'page' ? 'scroll' : (prev === 'scroll' ? 'flashcard' : 'page');
        });
    }, [quizMode]);

    // 删除当前错题
    const handleDeleteMistake = useCallback(() => {
        if (questions.length === 0) return;

        Alert.alert(
            '移除错题',
            '确定要将此题从错题本中移除吗？',
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '确定',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const currentQuestion = questions[currentIndex];
                            const db = getDB();
                            // 为该题添加一条正确记录
                            await db.runAsync(
                                `INSERT INTO user_progress (question_id, is_correct, timestamp)
                                 VALUES (?, 1, datetime('now'))`,
                                currentQuestion.id
                            );

                            // 从当前列表中移除该题
                            const newQuestions = questions.filter((_, idx) => idx !== currentIndex);
                            if (newQuestions.length === 0) {
                                // 没有错题了，返回上一页
                                Alert.alert('提示', '所有错题已复习完成！', [
                                    { text: '确定', onPress: () => navigation.goBack() }
                                ]);
                            } else {
                                // 返回上一页，让错题列表自动刷新
                                navigation.goBack();
                            }
                        } catch (error) {
                            console.error('Failed to remove mistake:', error);
                            Alert.alert('错误', '删除失败，请重试');
                        }
                    }
                }
            ]
        );
    }, [questions, currentIndex, navigation]);

    // 记忆化图标
    const viewModeIcon = useMemo(() => {
        if (viewMode === 'page') return 'book-open-page-variant';
        if (viewMode === 'scroll') return 'format-list-bulleted';
        return 'cards-outline';
    }, [viewMode]);

    useLayoutEffect(() => {
        if (!loading && questions.length > 0) {
            navigation.setOptions({
                headerTitle: () => (
                    <TouchableOpacity
                        onPress={() => setShowGrid(true)}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                        <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                            {bankName || (mode === 'mistake' ? '错题复习' : '刷题')} ({currentIndex + 1}/{questions.length})
                        </Text>
                        <IconButton icon="chevron-down" size={16} />
                    </TouchableOpacity>
                ),
                headerRight: () => (
                    <View style={{ flexDirection: 'row' }}>
                        {mode === 'mistake' && (
                            <>
                                <IconButton
                                    icon="refresh"
                                    onPress={handleReset}
                                    iconColor={theme.colors.primary}
                                    size={24}
                                />
                                <IconButton
                                    icon="delete-outline"
                                    onPress={() => handleDeleteMistake()}
                                    iconColor={theme.colors.error}
                                    size={24}
                                />
                            </>
                        )}
                        <IconButton
                            icon={viewModeIcon}
                            onPress={toggleViewMode}
                            iconColor={theme.colors.primary}
                            size={24}
                        />
                    </View>
                )
            });
        }
    }, [navigation, currentIndex, questions.length, loading, bankName, viewModeIcon, toggleViewMode, theme.colors.primary, theme.colors.error, mode, handleReset, handleDeleteMistake]);

    useEffect(() => {
        setIsFlipped(false);
    }, [currentIndex]);

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const onGestureEvent = (event: any) => {
        if (viewMode === 'scroll') return;
        if (event.nativeEvent.state === State.END) {
            const { translationX, velocityX } = event.nativeEvent;
            if (translationX < -SWIPE_THRESHOLD || (velocityX < -800 && translationX < -20)) {
                handleNext();
            } else if (translationX > SWIPE_THRESHOLD || (velocityX > 800 && translationX > 20)) {
                handlePrev();
            }
        }
    };

    const renderQuestionItem = useCallback(({ item, index }: { item: any, index: number }) => {
        if (!item) return null;
        const history = answerHistory.get(index);

        // Calculate all props to pass to memoized component
        let itemSelectedAnswer;
        if (viewMode === 'scroll') {
            itemSelectedAnswer = scrollModeAnswers.get(index) ?? history?.selectedAnswer ?? (item.type === 'multi' ? [] : (item.type === 'fill' || item.type === 'short' ? '' : null));
        } else {
            itemSelectedAnswer = index === currentIndex ? selectedAnswer : (history?.selectedAnswer ?? (item.type === 'multi' ? [] : (item.type === 'fill' || item.type === 'short' ? '' : null)));
        }

        const itemShowResult = quizMode === 'study' ? true : (viewMode === 'scroll' ? (history?.showResult || false) : (index === currentIndex ? showResult : (history?.showResult || false)));
        const itemIsCorrect = viewMode === 'scroll' ? (history?.isCorrect || false) : (index === currentIndex ? isCorrect : (history?.isCorrect || false));
        const itemIsRevealed = revealedIndices.has(index);

        return (
            <QuestionItem
                item={item}
                index={index}
                viewMode={viewMode}
                quizMode={quizMode}
                history={history}
                itemSelectedAnswer={itemSelectedAnswer}
                itemShowResult={itemShowResult}
                itemIsCorrect={itemIsCorrect}
                itemIsRevealed={itemIsRevealed}
                isFlipped={isFlipped}
                theme={theme}
                insets={insets}
                onToggleFlip={() => setIsFlipped(!isFlipped)}
                onSelectAnswer={(val: any) => {
                    if (viewMode === 'scroll') {
                        // 列表模式下，所有题型先存入临时答案，不立即提交（除非是背题模式）
                        if (quizMode === 'study') {
                            submitAnswer(index, val);
                        } else {
                            const newAnswers = new Map(scrollModeAnswers);
                            newAnswers.set(index, val);
                            setScrollModeAnswers(newAnswers);
                        }
                    } else {
                        setSelectedAnswer(val);
                    }
                }}
                onSubmitAnswer={(idx: number, val: any) => {
                    checkAnswerForIndex(idx, val);
                }}
                onReveal={() => {
                    const newRevealed = new Set(revealedIndices);
                    newRevealed.add(index);
                    setRevealedIndices(newRevealed);
                }}
                onSelfJudge={(correct: boolean) => {
                    checkAnswerForIndex(index, null, correct);
                    // 评判后清除揭示状态（因为 showResult 会接管显示）
                    const newRevealed = new Set(revealedIndices);
                    newRevealed.delete(index);
                    setRevealedIndices(newRevealed);
                }}
            />
        );
    }, [answerHistory, viewMode, scrollModeAnswers, currentIndex, selectedAnswer, quizMode, showResult, isCorrect, isFlipped, theme, insets, submitAnswer, checkAnswerForIndex, setSelectedAnswer, setIsFlipped, revealedIndices]);

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" /><Text style={{ marginTop: 10 }}>加载中...</Text></View>;
    if (questions.length === 0) return <View style={styles.center}><Text>没有题目</Text></View>;

    // 移除原有全屏完成界面，保持在原题目界面
    // if (completed) { ... }

    return (
        <>
            <PanGestureHandler
                onHandlerStateChange={onGestureEvent}
                activeOffsetX={[-15, 15]}
                failOffsetY={[-20, 20]}
            >
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                        {viewMode === 'page' && <ProgressBar progress={(currentIndex + 1) / questions.length} color={theme.colors.primary} style={styles.progressBar} />}

                        {viewMode === 'page' || viewMode === 'flashcard' ? (
                            <ScrollView
                                contentContainerStyle={[styles.scrollContent, viewMode === 'flashcard' && { flex: 1, justifyContent: 'center' }]}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                scrollEnabled={viewMode !== 'flashcard'}
                            >
                                {renderQuestionItem({ item: questions[currentIndex], index: currentIndex })}
                            </ScrollView>
                        ) : (
                            <FlatList
                                data={questions}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={renderQuestionItem}
                                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
                                initialScrollIndex={currentIndex >= 0 && currentIndex < questions.length ? currentIndex : 0}
                                onScrollToIndexFailed={() => { }}
                                showsVerticalScrollIndicator={true}
                                // 性能优化属性
                                removeClippedSubviews={Platform.OS === 'android'}
                                initialNumToRender={5}
                                maxToRenderPerBatch={5}
                                windowSize={10}
                                updateCellsBatchingPeriod={50}
                            />
                        )}

                        {viewMode !== 'scroll' && (
                            <FooterControl
                                viewMode={viewMode}
                                isFlipped={isFlipped}
                                quizMode={quizMode}
                                currentQuestion={questions[currentIndex]}
                                currentIndex={currentIndex}
                                totalCount={questions.length}
                                showResult={showResult}
                                completed={completed}
                                isRevealed={revealedIndices.has(currentIndex)}
                                selectedAnswer={selectedAnswer}
                                handlePrev={handlePrev}
                                handleNext={handleNext}
                                checkAnswer={checkAnswer}
                                markMastery={markMastery}
                                onReveal={() => {
                                    const newRevealed = new Set(revealedIndices);
                                    newRevealed.add(currentIndex);
                                    setRevealedIndices(newRevealed);
                                }}
                                onSelfJudge={(correct: boolean) => {
                                    checkAnswerForIndex(currentIndex, null, correct);
                                    const newRevealed = new Set(revealedIndices);
                                    newRevealed.delete(currentIndex);
                                    setRevealedIndices(newRevealed);
                                }}
                                keyboardHeight={keyboardHeight}
                                insets={insets}
                                theme={theme}
                            />
                        )}
                    </View>
                </KeyboardAvoidingView>
            </PanGestureHandler>

            <GridModal
                visible={showGrid}
                onDismiss={() => setShowGrid(false)}
                questions={questions}
                currentIndex={currentIndex}
                setCurrentIndex={setCurrentIndex}
                answerHistory={answerHistory}
                theme={theme}
            />

            {/* 新增：极简 Toast 提示 (类似安卓原生效果) */}
            {showToast && (
                <Portal>
                    <View style={styles.toastContainer} pointerEvents="none">
                        <Animated.View
                            style={[
                                styles.toastBody,
                                {
                                    opacity: toastOpacity,
                                    backgroundColor: 'rgba(0, 0, 0, 0.75)', // 暗色背景
                                }
                            ]}
                        >
                            <Text style={styles.toastText}>题目已结束</Text>
                        </Animated.View>
                    </View>
                </Portal>
            )}
        </>
    );
}

// --- Sub Components ---

const QuestionItem = React.memo(({
    item,
    index,
    viewMode,
    quizMode,
    history,
    itemSelectedAnswer,
    itemShowResult,
    itemIsCorrect,
    itemIsRevealed,
    isFlipped,
    onSelectAnswer,
    onSubmitAnswer,
    onToggleFlip,
    onReveal,
    onSelfJudge,
    theme,
    insets
}: any) => {
    const options = item.options ? JSON.parse(item.options) : {};

    if (viewMode === 'flashcard') {
        return (
            <View style={styles.flashcardContainer}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={onToggleFlip}
                    style={[
                        styles.flashcard,
                        {
                            backgroundColor: theme.colors.surface,
                            borderColor: '#E5E5EA',
                            borderWidth: 1,
                        }
                    ]}
                >
                    {!isFlipped ? (
                        <View style={styles.flashcardPart}>
                            <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type, theme) }]}>
                                <Text style={[styles.typeBadgeText, { color: getTypeTextSubColor(item.type) }]}>{getTypeLabel(item.type)}</Text>
                            </View>
                            <View style={{ flex: 1, justifyContent: 'center' }}>
                                <MathText content={item.content} fontSize={24} baseStyle={{ alignSelf: 'center' }} />
                            </View>
                            <Text style={styles.tapTip}>点击翻转</Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.flashcardPart} showsVerticalScrollIndicator={false}>
                            <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 12, fontWeight: 'bold' }}>正确答案</Text>
                            <MathText content={item.correct_answer} fontSize={20} color={theme.colors.onSurface} />
                            <Divider style={{ marginVertical: 24, height: 1.5, opacity: 0.5 }} />
                            <Text variant="labelLarge" style={{ color: theme.colors.secondary, marginBottom: 12, fontWeight: 'bold' }}>题目解析</Text>
                            <MathText content={item.explanation || '暂无解析'} fontSize={17} color={theme.colors.onSurfaceVariant} />
                        </ScrollView>
                    )}
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.scrollItem}>
            <Card style={[styles.card, viewMode === 'scroll' && { marginHorizontal: 4 }]} mode="outlined">
                <Card.Content style={{ paddingVertical: 18 }}>
                    <View style={styles.questionTextContainer}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type, theme) }]}>
                                    <Text style={[styles.typeBadgeText, { color: getTypeTextSubColor(item.type) }]}>{getTypeLabel(item.type)}</Text>
                                </View>
                                {viewMode === 'scroll' && <Text variant="labelMedium" style={{ color: theme.colors.outline, marginBottom: 10 }}>NO.{index + 1}</Text>}
                            </View>
                            <MathText content={item.content} fontSize={19} baseStyle={{ lineHeight: 28 }} />
                        </View>
                    </View>
                </Card.Content>
            </Card>

            <View style={styles.optionsContainer}>
                <OptionsRenderer
                    question={item}
                    options={options}
                    selectedAnswer={itemSelectedAnswer}
                    setSelectedAnswer={onSelectAnswer}
                    showResult={itemShowResult}
                    theme={theme}
                    quizMode={quizMode}
                />
            </View>

            {viewMode === 'scroll' && quizMode === 'practice' && !itemShowResult && (
                <Button
                    mode="contained"
                    disabled={(() => {
                        if (item.type === 'fill' || item.type === 'short') {
                            return !itemSelectedAnswer || itemSelectedAnswer.trim().length === 0;
                        }
                        if (item.type === 'multi') {
                            return !itemSelectedAnswer || itemSelectedAnswer.length === 0;
                        }
                        return !itemSelectedAnswer;
                    })()}
                    onPress={() => onSubmitAnswer(index, itemSelectedAnswer)}
                    style={{ marginHorizontal: 16, marginBottom: 8, borderRadius: 14 }}
                >
                    提交答案
                </Button>
            )}

            {(itemShowResult || itemIsRevealed) && (
                <ResultFeedback
                    showResult={true}
                    isCorrect={quizMode === 'study' ? (item.type === 'multi' ? false : true) : itemIsCorrect}
                    isRevealedOnly={itemIsRevealed && !itemShowResult}
                    theme={theme}
                    correct_answer={item.correct_answer}
                    explanation={item.explanation}
                    questionType={item.type}
                />
            )}
            {viewMode === 'scroll' && <Divider style={{ marginVertical: 16, opacity: 0.3 }} />}
        </View>
    );
});


/**
 * 高质量选项行组件 - 遵循 Evan Bacon Skill 规范中的 View 设计理念
 */
const OptionRow = memo(({
    label,
    value,
    isSelected,
    isCorrect,
    isRevealed,
    onPress,
    theme,
    type
}: any) => {
    const highlight = isSelected || (isRevealed && isCorrect);

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            style={[
                styles.optionRow,
                {
                    backgroundColor: highlight
                        ? (isRevealed ? (isCorrect ? '#F0FDF4' : '#FEF2F2') : '#F5F5F7')
                        : '#FFFFFF',
                    borderColor: highlight
                        ? (isRevealed ? (isCorrect ? '#22C55E' : '#EF4444') : theme.colors.primary)
                        : '#E5E5EA',
                    borderWidth: highlight ? 2 : 1.5,
                    // 精致阴影
                    shadowColor: highlight ? (isRevealed ? (isCorrect ? '#22C55E' : '#EF4444') : theme.colors.primary) : '#000',
                    shadowOffset: { width: 0, height: highlight ? 4 : 0 },
                    shadowOpacity: highlight ? 0.15 : 0,
                    shadowRadius: 8,
                    elevation: highlight ? 3 : 0,
                }
            ]}
        >
            <View pointerEvents="none" style={{ opacity: isRevealed && !isCorrect && !isSelected ? 0.3 : 1 }}>
                {type === 'multi' ? (
                    <Checkbox
                        status={highlight ? 'checked' : 'unchecked'}
                        color={isRevealed && isCorrect ? '#22C55E' : (highlight && isRevealed ? '#EF4444' : theme.colors.primary)}
                    />
                ) : (
                    <RadioButton
                        value={label}
                        status={highlight ? 'checked' : 'unchecked'}
                        color={isRevealed && isCorrect ? '#22C55E' : (highlight && isRevealed ? '#EF4444' : theme.colors.primary)}
                    />
                )}
            </View>
            <View style={styles.optionContent}>
                <MathText
                    content={label ? `${label}. ${value}` : value}
                    fontSize={17}
                    color={highlight
                        ? (isRevealed ? (isCorrect ? '#166534' : '#991B1B') : theme.colors.onSurface)
                        : theme.colors.onSurface}
                />
            </View>
        </TouchableOpacity>
    );
});

function OptionsRenderer({ question, options, selectedAnswer, setSelectedAnswer, showResult, theme, quizMode }: any) {
    const disabled = showResult || quizMode === 'study';
    const isRevealed = showResult || quizMode === 'study';

    const normalizeTF = (val: any) => {
        if (!val) return '';
        const s = val.toString().replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toUpperCase();
        if (['TRUE', 'T', '1', '正确', '对'].includes(s) || val === true) return 'T';
        if (['FALSE', 'F', '0', '错误', '错'].includes(s) || val === false) return 'F';
        return s;
    };

    if (question.type === 'single' || question.type === 'true_false') {
        const isBool = question.type === 'true_false';
        const renderOpts = isBool ? { 'T': '正确', 'F': '错误' } : options;
        const entries = Object.entries(renderOpts).filter(([_, v]) => (!!v && v.toString().trim() !== '') || isBool);

        if (entries.length === 0) return <ErrorBox theme={theme} />;

        return (
            <View style={{ paddingHorizontal: 4 }}>
                {entries.map(([key, value]: any) => (
                    <OptionRow
                        key={key}
                        label={isBool ? '' : key}
                        value={value}
                        isSelected={selectedAnswer === key}
                        isCorrect={isBool ? normalizeTF(question.correct_answer) === key : question.correct_answer === key}
                        isRevealed={isRevealed}
                        theme={theme}
                        type="single"
                        onPress={() => !disabled && setSelectedAnswer(key)}
                    />
                ))}
            </View>
        );
    }

    if (question.type === 'multi') {
        const currentSelected = (selectedAnswer as string[]) || [];
        const correctAnswers = (question.correct_answer || '').split('');
        const entries = Object.entries(options).filter(([_, v]) => !!v);

        if (entries.length === 0) return <ErrorBox theme={theme} />;

        const toggle = (key: string) => {
            const next = currentSelected.includes(key)
                ? currentSelected.filter(k => k !== key)
                : [...currentSelected, key].sort();
            setSelectedAnswer(next);
        };

        return (
            <View style={{ paddingHorizontal: 4 }}>
                {entries.map(([key, value]: any) => (
                    <OptionRow
                        key={key}
                        label={key}
                        value={value}
                        isSelected={currentSelected.includes(key)}
                        isCorrect={correctAnswers.includes(key)}
                        isRevealed={isRevealed}
                        theme={theme}
                        type="multi"
                        onPress={() => !disabled && toggle(key)}
                    />
                ))}
            </View>
        );
    }

    if (question.type === 'fill' || question.type === 'short') {
        const selectedAnswerValue = (selectedAnswer as string) || '';
        // 背题模式直接显示答案
        if (quizMode === 'study') {
            return (
                <View style={{
                    marginTop: 8,
                    padding: 16,
                    backgroundColor: theme.colors.surfaceVariant,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.outlineVariant,
                    shadowColor: theme.colors.shadow,
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 1
                }}>
                    <Text variant="bodySmall" style={{ marginBottom: 4, color: theme.colors.onSurfaceVariant, opacity: 0.7, fontWeight: 'bold' }}>答案：</Text>
                    <MathText content={question.correct_answer} fontSize={16} color={theme.colors.onSurface} />
                </View>
            );
        }

        return (
            <TextInput
                mode="outlined"
                placeholder="在此输入您的回答..."
                value={selectedAnswerValue}
                onChangeText={setSelectedAnswer}
                disabled={disabled}
                multiline={question.type === 'short'}
                numberOfLines={question.type === 'short' ? 4 : 1}
                returnKeyType="done"
                blurOnSubmit={true}
                style={styles.textInput}
                contentStyle={{
                    paddingTop: question.type === 'short' ? 12 : 8,
                    minHeight: question.type === 'short' ? 100 : 50
                }}
                outlineStyle={{ borderRadius: 12 }}
            />
        );
    }

    return null;
}

function ResultFeedback({ showResult, isCorrect, isRevealedOnly, theme, correct_answer, explanation, questionType }: any) {
    if (!showResult && !isRevealedOnly) return null;

    const normalizeTF = (val: any) => {
        if (val === null || val === undefined) return '';
        const s = val.toString().replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toUpperCase();
        if (['TRUE', 'T', '1', '正确', '对'].includes(s) || val === true) return 'T';
        if (['FALSE', 'F', '0', '错误', '错'].includes(s) || val === false) return 'F';
        return s;
    };

    const displayAnswer = (() => {
        if (questionType !== 'true_false') return correct_answer;
        const norm = normalizeTF(correct_answer);
        if (norm === 'T') return '正确';
        if (norm === 'F') return '错误';
        return correct_answer || '未设置';
    })();

    const bgColor = isRevealedOnly ? '#F3F4F6' : (isCorrect ? '#F0FDF4' : '#FEF2F2');
    const borderColor = isRevealedOnly ? '#E5E7EB' : (isCorrect ? '#DCFCE7' : '#FEE2E2');
    const textColor = isRevealedOnly ? '#374151' : (isCorrect ? '#166534' : '#991B1B');

    return (
        <View style={[styles.resultContainer, { backgroundColor: bgColor, borderColor: borderColor }]}>
            {!isRevealedOnly && (
                <Text variant="titleMedium" style={{ fontWeight: '800', marginBottom: 12, color: textColor }}>
                    {isCorrect ? '✨ 回答正确！' : '❌ 回答错误'}
                </Text>
            )}

            <View style={{ marginBottom: 10 }}>
                <Text variant="labelLarge" style={{ fontWeight: 'bold', marginBottom: 6, color: textColor, opacity: 0.8 }}>正确答案</Text>
                <View style={[styles.revealedAnswerContainer, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: borderColor }]}>
                    <MathText content={displayAnswer} fontSize={17} color="#1F2937" />
                </View>
            </View>

            {explanation && (
                <View style={{ marginTop: 6 }}>
                    <Text variant="labelLarge" style={{ fontWeight: 'bold', marginBottom: 6, color: textColor, opacity: 0.8 }}>解析说明</Text>
                    <View style={{ padding: 4 }}>
                        <MathText content={explanation} fontSize={15} color="#4B5563" baseStyle={{ lineHeight: 22 }} />
                    </View>
                </View>
            )}
        </View>
    );
}

function FooterControl({
    viewMode, isFlipped, quizMode, currentQuestion, currentIndex, totalCount,
    showResult, completed, isRevealed, selectedAnswer, handlePrev, handleNext, checkAnswer,
    markMastery, onReveal, onSelfJudge, keyboardHeight, insets, theme
}: any) {
    const navigation = useNavigation<any>();

    const onComplete = useCallback(() => {
        handleNext();
        navigation.goBack();
    }, [handleNext, navigation]);

    if (viewMode === 'flashcard') {
        const successColor = theme.colors.primary === '#006D3A' ? '#4CAF50' : theme.colors.primary;
        return (
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16), paddingTop: 12, backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
                {!isFlipped ? (
                    <View style={styles.footerButtons}>
                        <Button mode="outlined" onPress={handlePrev} disabled={currentIndex === 0} style={styles.navButton}>
                            上一题
                        </Button>
                        <Button
                            mode="contained"
                            onPress={currentIndex < totalCount - 1 ? handleNext : onComplete}
                            style={styles.navButton}
                        >
                            {currentIndex < totalCount - 1 ? '下一题' : '完成'}
                        </Button>
                    </View>
                ) : (
                    <View style={styles.footerButtons}>
                        {completed && currentIndex === totalCount - 1 ? (
                            <Button
                                mode="contained"
                                onPress={() => navigation.goBack()}
                                style={styles.mainButton}
                                icon="check"
                            >
                                全部完成并退出
                            </Button>
                        ) : (
                            <>
                                <Button
                                    mode="contained"
                                    onPress={() => markMastery(false)}
                                    style={[styles.masteryButton, { backgroundColor: theme.colors.error }]}
                                    icon="close-circle"
                                >
                                    没记住
                                </Button>
                                <Button
                                    mode="contained"
                                    onPress={() => markMastery(true)}
                                    style={[styles.masteryButton, { backgroundColor: successColor }]}
                                    icon="check-circle"
                                >
                                    记住了
                                </Button>
                            </>
                        )}
                    </View>
                )}
            </View>
        );
    }

    const canSubmit = !!selectedAnswer;
    const isSubjective = currentQuestion?.type === 'fill' || currentQuestion?.type === 'short';
    const successColor = theme.colors.primary === '#006D3A' ? '#4CAF50' : theme.colors.primary;

    return (
        <View style={[
            styles.footer,
            {
                paddingBottom: keyboardHeight > 0
                    ? (Platform.OS === 'android' ? 12 : 8)
                    : Math.max(insets.bottom, 16),
                paddingTop: 12,
                backgroundColor: theme.colors.surface,
                borderTopColor: theme.colors.outlineVariant
            }
        ]}>
            {quizMode === 'study' ? (
                // Study mode buttons
                <View style={styles.footerButtons}>
                    <Button mode="outlined" onPress={handlePrev} disabled={currentIndex === 0} style={styles.navButton} contentStyle={{ height: 48 }}>
                        上一题
                    </Button>
                    <Button
                        mode="contained"
                        onPress={currentIndex < totalCount - 1 ? handleNext : onComplete}
                        style={styles.navButton}
                        contentStyle={{ height: 48 }}
                    >
                        {currentIndex < totalCount - 1 ? '下一题' : '完成'}
                    </Button>
                </View>
            ) : (
                // Practice/Mistake mode
                <View style={styles.footerButtons}>
                    <Button mode="outlined" onPress={handlePrev} disabled={currentIndex === 0} style={styles.sideButton} compact>
                        上一题
                    </Button>

                    {!showResult ? (
                        <>
                            {isSubjective ? (
                                isRevealed ? (
                                    // 自评模式
                                    <View style={{ flex: 3, flexDirection: 'row', gap: 6 }}>
                                        <Button
                                            mode="contained"
                                            onPress={() => onSelfJudge(false)}
                                            style={[styles.masteryButton, { backgroundColor: theme.colors.error }]}
                                            contentStyle={{ height: 44 }}
                                            compact
                                        >
                                            答错了
                                        </Button>
                                        <Button
                                            mode="contained"
                                            onPress={() => onSelfJudge(true)}
                                            style={[styles.masteryButton, { backgroundColor: successColor }]}
                                            contentStyle={{ height: 44 }}
                                            compact
                                        >
                                            答对了
                                        </Button>
                                    </View>
                                ) : (
                                    // 仅当输入文本或点击显示答案
                                    <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                                        {canSubmit && (
                                            <Button mode="contained-tonal" onPress={checkAnswer} style={{ flex: 1 }} contentStyle={{ height: 44 }}>
                                                提交
                                            </Button>
                                        )}
                                        <Button
                                            mode={canSubmit ? "outlined" : "contained"}
                                            onPress={onReveal}
                                            style={{ flex: 1 }}
                                            contentStyle={{ height: 44 }}
                                        >
                                            {canSubmit ? "查看答案" : "直接看答案"}
                                        </Button>
                                    </View>
                                )
                            ) : (
                                // 标准提交流程
                                <Button mode="contained" onPress={checkAnswer} disabled={!canSubmit} style={styles.mainButton} contentStyle={{ height: 44 }}>
                                    提交答案
                                </Button>
                            )}
                        </>
                    ) : (
                        <Button
                            mode="contained"
                            onPress={currentIndex < totalCount - 1 ? handleNext : onComplete}
                            style={styles.mainButton}
                            contentStyle={{ height: 44 }}
                        >
                            {currentIndex < totalCount - 1 ? '下一题' : '完成'}
                        </Button>
                    )}
                </View>
            )}
        </View>
    );
}

function GridModal({ visible, onDismiss, questions, currentIndex, setCurrentIndex, answerHistory, theme }: any) {
    const screenHeight = Dimensions.get('window').height;
    const translateY = React.useRef(new Animated.Value(screenHeight)).current;
    const successColor = theme.colors.primary === '#006D3A' ? '#4CAF50' : theme.colors.primary;

    useEffect(() => {
        if (visible) {
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 4,
            }).start();
        } else {
            Animated.timing(translateY, {
                toValue: screenHeight,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, screenHeight]);

    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    translateY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 120 || gestureState.vy > 0.5) {
                    onDismiss();
                } else {
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    if (!visible) return null;

    return (
        <Portal>
            <View style={StyleSheet.absoluteFill}>
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            opacity: translateY.interpolate({
                                inputRange: [0, screenHeight],
                                outputRange: [1, 0],
                            })
                        }
                    ]}
                >
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={onDismiss}
                    />
                </Animated.View>
                <Animated.View
                    style={[
                        styles.bottomSheet,
                        {
                            transform: [{ translateY }],
                            backgroundColor: theme.dark ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.85)',
                            borderColor: theme.colors.outlineVariant,
                            height: screenHeight * 0.55,
                        },
                    ]}
                    {...panResponder.panHandlers}
                >
                    <View style={styles.sheetHandleContainer}>
                        <View style={[styles.sheetHandle, { backgroundColor: theme.colors.outline }]} />
                    </View>

                    <View style={styles.sheetContent}>
                        <Text variant="titleMedium" style={styles.sheetTitle}>快速跳转 ({currentIndex + 1}/{questions.length})</Text>
                        <FlatList
                            data={questions}
                            numColumns={5}
                            keyExtractor={(_, index) => index.toString()}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ index }) => {
                                const isCurrent = index === currentIndex;
                                const history = answerHistory.get(index);
                                let backgroundColor = theme.colors.surfaceVariant;
                                let textColor = theme.colors.onSurfaceVariant;
                                let borderColor = 'transparent';

                                if (history) {
                                    if (history.showResult) {
                                        if (history.isCorrect) {
                                            backgroundColor = successColor;
                                            textColor = theme.colors.onPrimary;
                                        } else {
                                            backgroundColor = theme.colors.error;
                                            textColor = theme.colors.onError;
                                        }
                                    } else {
                                        backgroundColor = theme.colors.secondaryContainer;
                                        textColor = theme.colors.onSecondaryContainer;
                                    }
                                }

                                if (isCurrent) borderColor = theme.colors.primary;

                                return (
                                    <TouchableOpacity
                                        style={[
                                            styles.gridItem,
                                            { backgroundColor, borderColor }
                                        ]}
                                        onPress={() => { setCurrentIndex(index); onDismiss(); }}
                                    >
                                        <Text style={{ color: textColor, fontWeight: isCurrent ? 'bold' : 'normal', fontSize: 16 }}>
                                            {index + 1}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </Animated.View>
            </View>
        </Portal>
    );
}

const ErrorBox = ({ theme }: any) => (
    <View style={styles.errorBox}>
        <Text style={{ color: theme.colors.error }}>未找到选项数据</Text>
        <Text variant="bodySmall">提示：请尝试删除该题库并重新导入。</Text>
    </View>
);

function getTypeLabel(type: string) {
    const map: any = { 'single': '单项选择', 'multi': '多项选择', 'true_false': '判断题', 'fill': '填空题', 'short': '简答题' };
    return map[type] || '试题';
}

function getTypeColor(type: string, theme: any) {
    if (type === 'single') return '#EEF2FF'; // 浅蓝
    if (type === 'multi') return '#F5F3FF';  // 浅紫
    if (type === 'true_false') return '#ECFDF5'; // 浅绿
    if (type === 'fill') return '#FFFBEB'; // 浅黄
    return theme.colors.surfaceVariant;
}

function getTypeTextSubColor(type: string) {
    if (type === 'single') return '#4338CA';
    if (type === 'multi') return '#6D28D9';
    if (type === 'true_false') return '#059669';
    if (type === 'fill') return '#D97706';
    return '#666';
}

const ActivityIndicator = ({ size, style }: any) => {
    const theme = useTheme();
    return <View style={[{ transform: [{ scale: size === 'large' ? 1.5 : 1 }] }, style]}><Text style={{ color: theme.colors.primary, fontSize: 32 }}>⏳</Text></View>;
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    progressBar: { height: 6, borderRadius: 3 },
    scrollContent: { padding: 16, paddingBottom: 24 },
    scrollItem: { marginBottom: 16 },
    card: {
        marginBottom: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E5EA',
        backgroundColor: '#FFFFFF',
    },
    questionTextContainer: { flexDirection: 'row', alignItems: 'flex-start' },
    typeBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 8,
        marginRight: 10,
    },
    optionsContainer: { marginBottom: 16 },
    flashcardContainer: { flex: 1, padding: 16, minHeight: 450 },
    flashcard: {
        flex: 1,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E5E5EA',
        backgroundColor: '#FFFFFF',
    },
    flashcardPart: { flex: 1, padding: 32 },


    // Result Feedback Styles
    tapTip: { textAlign: 'center', fontSize: 13, marginTop: 40, opacity: 0.5, letterSpacing: 1 },
    masteryButton: { flex: 1, marginHorizontal: 4, borderRadius: 16, height: 52 },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: 'transparent'
    },
    optionContent: { flex: 1, marginLeft: 10 },
    textInput: { marginBottom: 12 },
    errorBox: { padding: 20, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
    resultContainer: {
        padding: 20,
        borderRadius: 20,
        marginTop: 8,
        borderWidth: 1,
    },
    revealedAnswerContainer: {
        padding: 16,
        borderRadius: 14,
        marginTop: 12,
    },
    footer: {
        borderTopWidth: 1,
        paddingHorizontal: 16,
    },
    footerButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    navButton: { flex: 1, marginHorizontal: 6, borderRadius: 12 },
    sideButton: { flex: 1, marginHorizontal: 4, borderRadius: 12 },
    mainButton: { flex: 1.5, marginHorizontal: 4, borderRadius: 12 },
    // 新增样式：极简 Toast
    toastContainer: {
        position: 'absolute',
        bottom: 100,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toastBody: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 100,
    },
    toastText: {
        color: '#FFFFFF',
        fontSize: 14,
        textAlign: 'center',
    },
    // 新增：底部弹窗样式
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        borderColor: '#E5E5EA',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
    },
    sheetHandleContainer: {
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetHandle: {
        width: 36,
        height: 5,
        borderRadius: 2.5,
        opacity: 0.3,
    },
    sheetContent: {
        flex: 1,
        paddingHorizontal: 20,
    },
    sheetTitle: {
        textAlign: 'center',
        marginBottom: 20,
        fontWeight: 'bold',
        opacity: 0.8,
    },
    gridItem: {
        flex: 1,
        aspectRatio: 1,
        margin: 6,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 2,
    },
});
