import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, BackHandler, Dimensions } from 'react-native';
import { Text, Button, Card, RadioButton, Checkbox, TextInput, ProgressBar, useTheme, IconButton, Divider, Appbar } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getDB, Question } from '../db/database';
import MathText from '../components/MathText';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MockExamScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const theme = useTheme();
    const { bankIds, count, duration } = route.params;

    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState<Map<number, any>>(new Map()); // index -> answer
    const [timeLeft, setTimeLeft] = useState(duration); // seconds
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [showSheet, setShowSheet] = useState(false); // Show answer sheet

    useEffect(() => {
        loadQuestions();
        startTimer();

        // Prevent accidental back
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            confirmExit();
            return true;
        });

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            backHandler.remove();
        };
    }, []);

    const startTimer = () => {
        timerRef.current = setInterval(() => {
            setTimeLeft((prev: number) => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    Alert.alert('时间到', '考试时间已结束，系统已自动交卷。', [{ text: '查看结果', onPress: submitExam }]);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const confirmExit = () => {
        Alert.alert('退出考试', '考试正在进行中，退出将不保存进度。确认退出？', [
            { text: '取消', style: 'cancel' },
            { text: '确定退出', style: 'destructive', onPress: () => navigation.goBack() }
        ]);
    };

    const loadQuestions = async () => {
        try {
            const db = getDB();
            const placeholders = bankIds.map(() => '?').join(',');
            const sql = `SELECT * FROM questions WHERE bank_id IN (${placeholders}) ORDER BY RANDOM() LIMIT ?`;
            const result = await db.getAllAsync<Question>(sql, ...bankIds, count);
            setQuestions(result);
            setLoading(false);
        } catch (error) {
            console.error(error);
            Alert.alert('错误', '加载试题失败');
            navigation.goBack();
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleAnswer = (value: any) => {
        const newAnswers = new Map(answers);
        newAnswers.set(currentIndex, value);
        setAnswers(newAnswers);
    };

    const submitExam = () => {
        if (timerRef.current) clearInterval(timerRef.current);

        // Calculate score
        let correctCount = 0;
        const results = questions.map((q, index) => {
            const userAns = answers.get(index);
            let isCorrect = false;
            if (userAns) {
                const correctVal = q.correct_answer;
                if (q.type === 'multi') {
                    const u = (userAns as string[]).sort().join('');
                    const r = correctVal.replace(/[,，]/g, '').split('').sort().join('');
                    isCorrect = u.toUpperCase() === r.toUpperCase();
                } else {
                    isCorrect = userAns.toString().trim().toUpperCase() === correctVal.toString().trim().toUpperCase();
                }
            }
            if (isCorrect) correctCount++;
            return { question: q, userAnswer: userAns, isCorrect };
        });

        // Navigate to result screen (Reuse QuizScreen logic or new screen? Maybe duplicate logic for now or pass as params)
        // For simplicity, let's navigate to a ResultScreen. I haven't defined one yet.
        // Or I can show a modal summary here.
        // Let's assume we navigate to a 'MockResult' screen. Assuming I create it later.
        // For NOW, I will use Alert or a simple view swap.
        // Actually, user requested "Result Screen".

        // Let's create MockResultScreen later. For now, just Log.
        // Or, navigate to 'MockResult' with params.
        navigation.replace('MockResult', {
            results,
            score: correctCount,
            total: questions.length,
            duration: duration - timeLeft
        });
    };

    if (loading) return <View style={styles.center}><Text>试卷生成中...</Text></View>;

    const currentQuestion = questions[currentIndex];
    const options = currentQuestion.options ? JSON.parse(currentQuestion.options) : {};
    const currentAnswer = answers.get(currentIndex);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            {/* Header / Timer */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <IconButton icon="clock-outline" size={20} />
                    <Text variant="titleMedium" style={{ color: timeLeft < 300 ? theme.colors.error : theme.colors.primary }}>
                        {formatTime(timeLeft)}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Button mode="text" onPress={() => setShowSheet(true)}>答题卡 ({answers.size}/{questions.length})</Button>
                    <Button mode="contained" compact onPress={() => Alert.alert('交卷', '确认提交试卷？', [{ text: '取消' }, { text: '交卷', onPress: submitExam }])}>交卷</Button>
                </View>
            </View>

            <ProgressBar progress={(currentIndex + 1) / questions.length} color={theme.colors.primary} style={{ height: 2 }} />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={{ marginBottom: 16 }}>
                    <Text variant="titleMedium" style={{ marginBottom: 8 }}>
                        {currentIndex + 1}. {getTypeLabel(currentQuestion.type)}
                    </Text>
                    <MathText content={currentQuestion.content} fontSize={16} />
                </View>

                {renderOptions(currentQuestion, options, currentAnswer, handleAnswer, theme)}
            </ScrollView>

            {/* Footer Navigation */}
            <View style={styles.footer}>
                <Button mode="outlined" onPress={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} style={{ flex: 1, marginRight: 8 }}>
                    上一题
                </Button>
                <Button mode="contained" onPress={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))} disabled={currentIndex === questions.length - 1} style={{ flex: 1, marginLeft: 8 }}>
                    下一题
                </Button>
            </View>

            {/* Answer Sheet Modal */}
            {showSheet && (
                <View style={[styles.sheetOverlay, { backgroundColor: theme.colors.background }]}>
                    <Appbar.Header>
                        <Appbar.BackAction onPress={() => setShowSheet(false)} />
                        <Appbar.Content title="答题卡" />
                    </Appbar.Header>
                    <ScrollView contentContainerStyle={styles.sheetContent}>
                        <View style={styles.sheetGrid}>
                            {questions.map((_, index) => (
                                <Button
                                    key={index}
                                    mode={answers.has(index) ? 'contained' : 'outlined'}
                                    onPress={() => { setCurrentIndex(index); setShowSheet(false); }}
                                    style={styles.sheetItem}
                                    compact
                                >
                                    {index + 1}
                                </Button>
                            ))}
                        </View>
                        <Button mode="contained" onPress={submitExam} style={{ marginTop: 24, marginHorizontal: 16 }}>
                            提交所有答案
                        </Button>
                    </ScrollView>
                </View>
            )}
        </SafeAreaView>
    );
}

// Reuse helper functions or refactor them out later. For speed, duplication is acceptable for now.
function getTypeLabel(type: string) {
    const map: any = { 'single': '单选', 'multi': '多选', 'true_false': '判断', 'fill': '填空', 'short': '简答' };
    return map[type] || '题目';
}

function renderOptions(question: Question, options: any, selectedAnswer: any, setSelectedAnswer: any, theme: any) {
    if (question.type === 'single' || question.type === 'true_false') {
        const isBool = question.type === 'true_false';
        const renderOpts = isBool ? { 'T': '正确', 'F': '错误' } : options;
        const entries = Object.entries(renderOpts).filter(([_, v]) => (!!v && v.toString().trim() !== '') || isBool);

        return (
            <RadioButton.Group onValueChange={setSelectedAnswer} value={selectedAnswer}>
                {entries.map(([key, value]: any) => (
                    <Card key={key} style={{ marginBottom: 8 }} mode={selectedAnswer === key ? 'contained' : 'outlined'} onPress={() => setSelectedAnswer(key)}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}>
                            <RadioButton value={key} />
                            <View style={{ flex: 1 }}>
                                <MathText content={isBool ? value : `${key}. ${value}`} fontSize={15} />
                            </View>
                        </View>
                    </Card>
                ))}
            </RadioButton.Group>
        );
    }
    if (question.type === 'multi') {
        const currentSelected = (selectedAnswer as string[]) || [];
        const toggle = (key: string) => {
            if (currentSelected.includes(key)) setSelectedAnswer(currentSelected.filter(k => k !== key));
            else setSelectedAnswer([...currentSelected, key]);
        };
        const entries = Object.entries(options).filter(([_, v]) => !!v);
        return (
            <View>
                {entries.map(([key, value]: any) => {
                    const isSelected = currentSelected.includes(key);
                    return (
                        <Card key={key} style={{ marginBottom: 8 }} mode={isSelected ? 'contained' : 'outlined'} onPress={() => toggle(key)}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}>
                                <Checkbox status={isSelected ? 'checked' : 'unchecked'} />
                                <View style={{ flex: 1 }}>
                                    <MathText content={`${key}. ${value}`} fontSize={15} />
                                </View>
                            </View>
                        </Card>
                    );
                })}
            </View>
        );
    }
    return (
        <TextInput
            mode="outlined"
            label="填写答案"
            value={selectedAnswer || ''}
            onChangeText={setSelectedAnswer}
            multiline={question.type === 'short'}
        />
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, height: 50 },
    content: { padding: 16, flex: 1 },
    footer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#eee' },
    sheetOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
    sheetContent: { paddingBottom: 20 },
    sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
    sheetItem: { width: '18%', margin: '1%' },
});
