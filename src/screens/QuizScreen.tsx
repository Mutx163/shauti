import React, { useLayoutEffect, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, KeyboardAvoidingView, Platform, Keyboard, TouchableOpacity, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button, Card, RadioButton, Checkbox, TextInput, ProgressBar, useTheme, Divider, IconButton, Portal, Modal } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { State, PanGestureHandler } from 'react-native-gesture-handler';
import MathText from '../components/MathText';
import { useQuiz } from '../hooks/useQuiz';

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
        bankName,
        quizMode
    } = useQuiz();

    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [showGrid, setShowGrid] = useState(false);
    const [viewMode, setViewMode] = useState<'page' | 'scroll' | 'flashcard'>('page');
    const [isFlipped, setIsFlipped] = useState(false);

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
                headerRight: () => (
                    <IconButton
                        icon={viewMode === 'page' ? 'book-open-page-variant' : (viewMode === 'scroll' ? 'format-list-bulleted' : 'cards-outline')}
                        onPress={() => {
                            setIsFlipped(false);
                            setViewMode(prev => {
                                if (quizMode === 'practice') {
                                    return prev === 'page' ? 'scroll' : 'page';
                                }
                                return prev === 'page' ? 'scroll' : (prev === 'scroll' ? 'flashcard' : 'page');
                            });
                        }}
                        iconColor={theme.colors.primary}
                        size={24}
                    />
                )
            });
        }
    }, [navigation, currentIndex, questions.length, loading, bankName, viewMode, theme, quizMode]);

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

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" /><Text style={{ marginTop: 10 }}>加载中...</Text></View>;
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

    const renderQuestionItem = ({ item, index }: { item: any, index: number }) => {
        const options = item.options ? JSON.parse(item.options) : {};
        const history = answerHistory.get(index);

        const itemSelectedAnswer = viewMode === 'scroll' ? (history?.selectedAnswer || null) : (index === currentIndex ? selectedAnswer : (history?.selectedAnswer || null));
        const itemShowResult = quizMode === 'study' ? true : (viewMode === 'scroll' ? (history?.showResult || false) : (index === currentIndex ? showResult : (history?.showResult || false)));
        const itemIsCorrect = viewMode === 'scroll' ? (history?.isCorrect || false) : (index === currentIndex ? isCorrect : (history?.isCorrect || false));

        if (viewMode === 'flashcard') {
            return (
                // ... (flashcard part same)
                <View style={styles.flashcardContainer}>
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setIsFlipped(!isFlipped)}
                        style={[styles.flashcard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
                    >
                        {!isFlipped ? (
                            <View style={styles.flashcardPart}>
                                <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type, theme), marginBottom: 12 }]}>
                                    <Text style={styles.typeBadgeText}>{getTypeLabel(item.type)}</Text>
                                </View>
                                <MathText content={item.content} fontSize={22} baseStyle={{ alignSelf: 'center' }} />
                                <Text style={styles.tapTip}>点击翻转查看答案</Text>
                            </View>
                        ) : (
                            <ScrollView style={styles.flashcardPart}>
                                <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 8 }}>答案：</Text>
                                <MathText content={item.correct_answer} fontSize={18} color={theme.colors.onSurface} />
                                <Divider style={{ marginVertical: 16 }} />
                                <Text variant="labelLarge" style={{ color: theme.colors.secondary, marginBottom: 8 }}>解析：</Text>
                                <MathText content={item.explanation || '暂无解析'} fontSize={16} color={theme.colors.onSurfaceVariant} />
                            </ScrollView>
                        )}
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.scrollItem}>
                <Card style={[styles.card, viewMode === 'scroll' && { marginBottom: 16 }]} mode={viewMode === 'scroll' ? 'elevated' : 'contained'}>
                    <Card.Content>
                        <View style={styles.questionTextContainer}>
                            {viewMode === 'scroll' && <Text variant="labelLarge" style={{ marginRight: 8, color: theme.colors.primary }}>#{index + 1}</Text>}
                            <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type, theme) }]}>
                                <Text style={styles.typeBadgeText}>{getTypeLabel(item.type)}</Text>
                            </View>
                            <MathText content={item.content} fontSize={18} baseStyle={{ flex: 1 }} />
                        </View>
                    </Card.Content>
                </Card>

                <View style={styles.optionsContainer}>
                    <OptionsRenderer
                        question={item}
                        options={options}
                        selectedAnswer={itemSelectedAnswer}
                        setSelectedAnswer={(val: any) => {
                            if (viewMode === 'scroll') {
                                submitAnswer(index, val);
                            } else {
                                setSelectedAnswer(val);
                            }
                        }}
                        showResult={itemShowResult}
                        theme={theme}
                        quizMode={quizMode}
                    />
                </View>

                {viewMode === 'scroll' && quizMode === 'practice' && !itemShowResult && (
                    <Button
                        mode="contained-tonal"
                        disabled={item.type === 'multi' ? (!itemSelectedAnswer || itemSelectedAnswer.length === 0) : !itemSelectedAnswer}
                        onPress={() => checkAnswerForIndex(index, itemSelectedAnswer)}
                        style={{ marginHorizontal: 16, marginBottom: 8 }}
                    >
                        提交答案
                    </Button>
                )}

                {(itemShowResult) && (
                    <ResultFeedback
                        showResult={true}
                        isCorrect={quizMode === 'study' ? (item.type === 'multi' ? false : true) : itemIsCorrect}
                        theme={theme}
                        correct_answer={item.correct_answer}
                        explanation={item.explanation}
                    />
                )}
                {viewMode === 'scroll' && <Divider style={{ marginVertical: 16 }} />}
            </View>
        );
    };

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
                                getItemLayout={(_, index) => ({ length: 400, offset: 400 * index, index })}
                                onScrollToIndexFailed={() => { }}
                                showsVerticalScrollIndicator={true}
                            />
                        )}

                        {viewMode !== 'scroll' && (
                            <FooterControl
                                viewMode={viewMode}
                                isFlipped={isFlipped}
                                quizMode={quizMode}
                                currentIndex={currentIndex}
                                totalCount={questions.length}
                                showResult={showResult}
                                selectedAnswer={selectedAnswer}
                                handlePrev={handlePrev}
                                handleNext={handleNext}
                                checkAnswer={checkAnswer}
                                markMastery={markMastery}
                                keyboardHeight={keyboardHeight}
                                insets={insets}
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
        </>
    );
}

// --- Sub Components ---

function OptionsRenderer({ question, options, selectedAnswer, setSelectedAnswer, showResult, theme, quizMode }: any) {
    const disabled = showResult;

    if (question.type === 'single' || question.type === 'true_false') {
        const isBool = question.type === 'true_false';
        const renderOpts = isBool ? { 'T': '正确', 'F': '错误' } : options;
        const entries = Object.entries(renderOpts).filter(([_, v]) => (!!v && v.toString().trim() !== '') || isBool);

        if (entries.length === 0) return <ErrorBox theme={theme} />;

        return (
            <View>
                {entries.map(([key, value]: any) => {
                    const isSelected = selectedAnswer === key;
                    const isCorrect = question.correct_answer === key;
                    const isRevealed = showResult || quizMode === 'study';
                    const highlight = isSelected || (quizMode === 'study' && isCorrect);

                    return (
                        <TouchableOpacity
                            key={key}
                            onPress={() => !disabled && quizMode !== 'study' && setSelectedAnswer(key)}
                            activeOpacity={0.7}
                            style={[
                                styles.optionRow,
                                {
                                    backgroundColor: highlight
                                        ? (isRevealed ? (isCorrect ? '#E8F5E9' : theme.colors.secondaryContainer) : theme.colors.secondaryContainer)
                                        : theme.colors.surface,
                                    borderColor: highlight
                                        ? (isRevealed ? (isCorrect ? '#4CAF50' : theme.colors.primary) : theme.colors.primary)
                                        : 'transparent',
                                    borderWidth: highlight ? 2 : 1,
                                }
                            ]}
                        >
                            <View pointerEvents="none">
                                <RadioButton
                                    value={key}
                                    status={highlight ? 'checked' : 'unchecked'}
                                    color={isRevealed && isCorrect ? '#4CAF50' : undefined}
                                />
                            </View>
                            <View style={styles.optionContent}>
                                <MathText
                                    content={isBool ? value : `${key}. ${value}`}
                                    fontSize={16}
                                    color={highlight
                                        ? (isRevealed ? (isCorrect ? '#2E7D32' : theme.colors.onSecondaryContainer) : theme.colors.onSecondaryContainer)
                                        : theme.colors.onSurface}
                                />
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    }

    if (question.type === 'multi') {
        const currentSelected = (selectedAnswer as string[]) || [];
        const correctAnswers = question.correct_answer.split('');

        const toggle = (key: string) => {
            if (currentSelected.includes(key)) {
                setSelectedAnswer(currentSelected.filter(k => k !== key));
            } else {
                setSelectedAnswer([...currentSelected, key]);
            }
        };

        const entries = Object.entries(options).filter(([_, v]) => !!v);

        if (entries.length === 0) return <ErrorBox theme={theme} />;

        return (
            <View>
                {entries.map(([key, value]: any) => {
                    const isSelected = currentSelected.includes(key);
                    const isCorrect = correctAnswers.includes(key);
                    const isRevealed = showResult || quizMode === 'study';
                    const highlight = isSelected || (quizMode === 'study' && isCorrect);

                    return (
                        <TouchableOpacity
                            key={key}
                            onPress={() => !disabled && quizMode !== 'study' && toggle(key)}
                            activeOpacity={0.7}
                            style={[
                                styles.optionRow,
                                {
                                    backgroundColor: highlight
                                        ? (isRevealed ? (isCorrect ? '#E8F5E9' : theme.colors.secondaryContainer) : theme.colors.secondaryContainer)
                                        : theme.colors.surface,
                                    borderColor: highlight
                                        ? (isRevealed ? (isCorrect ? '#4CAF50' : theme.colors.primary) : theme.colors.primary)
                                        : 'transparent',
                                    borderWidth: highlight ? 2 : 1,
                                }
                            ]}
                        >
                            <View pointerEvents="none">
                                <Checkbox
                                    status={highlight ? 'checked' : 'unchecked'}
                                    color={isRevealed && isCorrect ? '#4CAF50' : undefined}
                                />
                            </View>
                            <View style={styles.optionContent}>
                                <MathText
                                    content={`${key}. ${value}`}
                                    fontSize={16}
                                    color={highlight
                                        ? (isRevealed ? (isCorrect ? '#2E7D32' : theme.colors.onSecondaryContainer) : theme.colors.onSecondaryContainer)
                                        : theme.colors.onSurface}
                                />
                            </View>
                        </TouchableOpacity>
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

function ResultFeedback({ showResult, isCorrect, theme, correct_answer, explanation }: any) {
    if (!showResult) return null;
    return (
        <View style={[styles.resultContainer, { backgroundColor: isCorrect ? theme.colors.primaryContainer : theme.colors.errorContainer, borderColor: isCorrect ? theme.colors.primary : theme.colors.error }]}>
            <Text variant="titleMedium" style={{ color: isCorrect ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer, marginBottom: 4 }}>
                {isCorrect ? '✓ 回答正确' : '✗ 回答错误'}
            </Text>
            {!isCorrect && (
                <View style={{ marginBottom: 8 }}>
                    <Text variant="bodyMedium" style={{ fontWeight: 'bold', marginBottom: 4 }}>正确答案：</Text>
                    <MathText content={correct_answer} fontSize={14} color="#000" />
                </View>
            )}
            <Divider style={{ marginVertical: 8, opacity: 0.3 }} />
            <Text variant="bodySmall" style={{ fontStyle: 'italic', opacity: 0.8, marginBottom: 4 }}>解析：</Text>
            <MathText content={explanation || '暂无详细解析。'} fontSize={14} color="rgba(0,0,0,0.8)" />
        </View>
    );
}

function FooterControl({ viewMode, isFlipped, quizMode, currentIndex, totalCount, showResult, selectedAnswer, handlePrev, handleNext, checkAnswer, markMastery, keyboardHeight, insets }: any) {
    if (viewMode === 'flashcard') {
        return (
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16), paddingTop: 12 }]}>
                {!isFlipped ? (
                    <View style={styles.footerButtons}>
                        <Button mode="outlined" onPress={handlePrev} disabled={currentIndex === 0} style={styles.navButton}>
                            上一题
                        </Button>
                        <Button mode="contained" onPress={handleNext} disabled={currentIndex === totalCount - 1} style={styles.navButton}>
                            下一题
                        </Button>
                    </View>
                ) : (
                    <View style={styles.footerButtons}>
                        <Button
                            mode="contained"
                            onPress={() => markMastery(false)}
                            style={[styles.masteryButton, { backgroundColor: '#F44336' }]}
                            icon="close-circle"
                        >
                            没记住
                        </Button>
                        <Button
                            mode="contained"
                            onPress={() => markMastery(true)}
                            style={[styles.masteryButton, { backgroundColor: '#4CAF50' }]}
                            icon="check-circle"
                        >
                            记住了
                        </Button>
                    </View>
                )}
            </View>
        );
    }

    return (
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
                <View style={styles.footerButtons}>
                    <Button mode="outlined" onPress={handlePrev} disabled={currentIndex === 0} style={styles.navButton} contentStyle={{ height: 48 }}>
                        上一题
                    </Button>
                    <Button mode="contained" onPress={handleNext} disabled={currentIndex === totalCount - 1} style={styles.navButton} contentStyle={{ height: 48 }}>
                        {currentIndex < totalCount - 1 ? '下一题' : '完成'}
                    </Button>
                </View>
            ) : (
                <View style={styles.footerButtons}>
                    <Button mode="outlined" onPress={handlePrev} disabled={currentIndex === 0} style={styles.sideButton} compact>
                        上一题
                    </Button>
                    {!showResult ? (
                        <Button mode="contained" onPress={checkAnswer} disabled={!selectedAnswer} style={styles.mainButton} contentStyle={{ height: 44 }}>
                            提交答案
                        </Button>
                    ) : (
                        <Button mode="contained" onPress={handleNext} style={styles.mainButton} contentStyle={{ height: 44 }}>
                            {currentIndex < totalCount - 1 ? '下一题' : '完成'}
                        </Button>
                    )}
                </View>
            )}
        </View>
    );
}

function GridModal({ visible, onDismiss, questions, currentIndex, setCurrentIndex, answerHistory, theme }: any) {
    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
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
                        let textColor = 'black';
                        let borderColor = 'transparent';

                        if (history) {
                            if (history.showResult) {
                                if (history.isCorrect) {
                                    backgroundColor = '#c8e6c9';
                                    textColor = '#1b5e20';
                                } else {
                                    backgroundColor = '#ffcdd2';
                                    textColor = '#b71c1c';
                                }
                            } else {
                                backgroundColor = '#bbdefb';
                                textColor = '#0d47a1';
                            }
                        }

                        if (isCurrent) borderColor = theme.colors.primary;

                        return (
                            <TouchableOpacity
                                style={{
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
                                onPress={() => { setCurrentIndex(index); onDismiss(); }}
                            >
                                <Text style={{ color: textColor, fontWeight: isCurrent ? 'bold' : 'normal' }}>{index + 1}</Text>
                            </TouchableOpacity>
                        );
                    }}
                />
            </Modal>
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
    const map: any = { 'single': '单选', 'multi': '多选', 'true_false': '判断', 'fill': '填空', 'short': '简答' };
    return map[type] || '题目';
}

function getTypeColor(type: string, theme: any) {
    const map: any = {
        'single': '#E3F2FD', 'multi': '#F3E5F5', 'true_false': '#E8F5E9', 'fill': '#FFF3E0', 'short': '#FBE9E7'
    };
    return map[type] || theme.colors.secondaryContainer;
}

const ActivityIndicator = ({ size, style }: any) => {
    const theme = useTheme();
    return <View style={[{ transform: [{ scale: size === 'large' ? 1.5 : 1 }] }, style]}><Text style={{ color: theme.colors.primary, fontSize: 32 }}>⏳</Text></View>;
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    progressBar: { height: 3 },
    scrollContent: { padding: 16, paddingBottom: 24 },
    scrollItem: { marginBottom: 8 },
    card: { marginBottom: 20, borderRadius: 16 },
    questionTextContainer: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap' },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginRight: 8, marginTop: 4, alignSelf: 'flex-start' },
    typeBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#555' },
    optionsContainer: { marginBottom: 20 },
    flashcardContainer: { flex: 1, padding: 10, minHeight: 400 },
    flashcard: { flex: 1, borderRadius: 24, borderWidth: 1, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
    flashcardPart: { flex: 1, padding: 24 },
    tapTip: { textAlign: 'center', color: '#999', fontSize: 12, marginTop: 40 },
    masteryButton: { flex: 1, marginHorizontal: 8, borderRadius: 12, height: 48, justifyContent: 'center' },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 16,
        marginBottom: 10,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: 'transparent'
    },
    optionContent: { flex: 1, marginLeft: 8 },
    textInput: { backgroundColor: 'white', marginBottom: 10 },
    errorBox: { padding: 16, backgroundColor: '#fff3e0', borderRadius: 12, borderWidth: 1, borderColor: '#ffb74d' },
    resultContainer: {
        padding: 16, borderRadius: 16, marginTop: 4, borderWidth: 1,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    footer: { paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', backgroundColor: 'white' },
    footerButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    navButton: { flex: 1, marginHorizontal: 6, borderRadius: 12 },
    sideButton: { flex: 1, marginHorizontal: 4, borderRadius: 12 },
    mainButton: { flex: 1.5, marginHorizontal: 4, borderRadius: 12 },
});
