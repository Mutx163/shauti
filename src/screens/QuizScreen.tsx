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
        handleNext,
        handlePrev,
        bankName,
        quizMode
    } = useQuiz();

    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [showGrid, setShowGrid] = useState(false);

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
        const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const onGestureEvent = (event: any) => {
        if (event.nativeEvent.state === State.END) {
            const { translationX, velocityX } = event.nativeEvent;
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

    const currentQuestion = questions[currentIndex];
    const options = currentQuestion.options ? JSON.parse(currentQuestion.options) : {};

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
                                <OptionsRenderer
                                    question={currentQuestion}
                                    options={options}
                                    selectedAnswer={selectedAnswer}
                                    setSelectedAnswer={setSelectedAnswer}
                                    showResult={showResult}
                                    theme={theme}
                                />
                            </View>

                            <ResultFeedback
                                showResult={showResult}
                                isCorrect={isCorrect}
                                theme={theme}
                                correct_answer={currentQuestion.correct_answer}
                                explanation={currentQuestion.explanation}
                            />
                        </ScrollView>

                        <FooterControl
                            quizMode={quizMode}
                            currentIndex={currentIndex}
                            totalCount={questions.length}
                            showResult={showResult}
                            selectedAnswer={selectedAnswer}
                            handlePrev={handlePrev}
                            handleNext={handleNext}
                            checkAnswer={checkAnswer}
                            keyboardHeight={keyboardHeight}
                            insets={insets}
                        />
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

function OptionsRenderer({ question, options, selectedAnswer, setSelectedAnswer, showResult, theme }: any) {
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
                    return (
                        <TouchableOpacity
                            key={key}
                            onPress={() => !disabled && setSelectedAnswer(key)}
                            activeOpacity={0.7}
                            style={[
                                styles.optionRow,
                                {
                                    backgroundColor: isSelected ? theme.colors.secondaryContainer : theme.colors.surface,
                                    borderColor: isSelected ? theme.colors.primary : 'transparent',
                                    borderWidth: isSelected ? 2 : 1, // Add border for better visibility
                                    elevation: 2, // Slight shadow
                                }
                            ]}
                        >
                            <View pointerEvents="none">
                                <RadioButton value={key} status={isSelected ? 'checked' : 'unchecked'} />
                            </View>
                            <View style={styles.optionContent}>
                                <MathText
                                    content={isBool ? value : `${key}. ${value}`}
                                    fontSize={16}
                                    color={isSelected ? theme.colors.onSecondaryContainer : theme.colors.onSurface}
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
                    return (
                        <TouchableOpacity
                            key={key}
                            onPress={() => !disabled && toggle(key)}
                            activeOpacity={0.7}
                            style={[
                                styles.optionRow,
                                {
                                    backgroundColor: isSelected ? theme.colors.secondaryContainer : theme.colors.surface,
                                    borderColor: isSelected ? theme.colors.primary : 'transparent',
                                    borderWidth: isSelected ? 2 : 1,
                                    elevation: 2,
                                }
                            ]}
                        >
                            <View pointerEvents="none">
                                <Checkbox status={isSelected ? 'checked' : 'unchecked'} />
                            </View>
                            <View style={styles.optionContent}>
                                <MathText
                                    content={`${key}. ${value}`}
                                    fontSize={16}
                                    color={isSelected ? theme.colors.onSecondaryContainer : theme.colors.onSurface}
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

function FooterControl({ quizMode, currentIndex, totalCount, showResult, selectedAnswer, handlePrev, handleNext, checkAnswer, keyboardHeight, insets }: any) {
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

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    progressBar: { height: 3 },
    scrollContent: { padding: 16, paddingBottom: 24 },
    card: { marginBottom: 20, borderRadius: 16 },
    questionTextContainer: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap' },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginRight: 8, marginTop: 4, alignSelf: 'flex-start' },
    typeBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#555' },
    optionsContainer: { marginBottom: 20 },
    // New Option Layout Styles
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 16,
        marginBottom: 10,
        backgroundColor: 'white',
        // Default border
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
