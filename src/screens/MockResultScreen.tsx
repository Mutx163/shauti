import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, Card, Divider, useTheme, IconButton, Surface } from 'react-native-paper';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MathText from '../components/MathText';

export default function MockResultScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { results, score, total, duration } = route.params;

    const percentage = Math.round((score / total) * 100);

    const getScoreInfo = () => {
        if (percentage >= 90) return { label: '优秀', color: '#4CAF50', icon: 'medal-outline', msg: '才华横溢，实至名归！' };
        if (percentage >= 80) return { label: '良好', color: '#8BC34A', icon: 'emoticon-happy-outline', msg: '表现出色，继续保持！' };
        if (percentage >= 60) return { label: '合格', color: '#FFB300', icon: 'emoticon-neutral-outline', msg: '基础扎实，尚有空间。' };
        return { label: '待加强', color: '#F44336', icon: 'emoticon-sad-outline', msg: '不积跬步，无以至千里。' };
    };

    const info = getScoreInfo();

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}分${s}秒`;
    };

    const handleExit = () => {
        navigation.dispatch(
            CommonActions.reset({
                index: 0,
                routes: [{ name: 'Main' }],
            })
        );
    };

    const wrongQuestions = results.filter((r: any) => !r.isCorrect);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
            <ScrollView contentContainerStyle={styles.content}>
                {/* Header Score Section */}
                <Surface style={[styles.headerSurface, { backgroundColor: theme.colors.primary }]} elevation={2}>
                    <IconButton icon={info.icon} iconColor="#fff" size={48} style={{ marginBottom: 0 }} />
                    <Text variant="displayLarge" style={styles.scoreText}>{percentage}</Text>
                    <Text variant="titleMedium" style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 'bold' }}>模拟考试：{info.label}</Text>
                    <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{info.msg}</Text>
                </Surface>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <Card style={styles.statCard} mode="contained">
                        <Card.Content style={styles.statContent}>
                            <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.primary }}>{score}/{total}</Text>
                            <Text variant="labelSmall" style={{ opacity: 0.6 }}>答对题目</Text>
                        </Card.Content>
                    </Card>
                    <Card style={styles.statCard} mode="contained">
                        <Card.Content style={styles.statContent}>
                            <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>{formatTime(duration)}</Text>
                            <Text variant="labelSmall" style={{ opacity: 0.6 }}>答题耗时</Text>
                        </Card.Content>
                    </Card>
                </View>

                {/* Wrong Questions Section */}
                {wrongQuestions.length > 0 ? (
                    <View style={{ marginTop: 24 }}>
                        <View style={styles.sectionHeader}>
                            <Divider style={{ flex: 1 }} />
                            <Text variant="titleSmall" style={styles.sectionTitle}>错题解析 ({wrongQuestions.length})</Text>
                            <Divider style={{ flex: 1 }} />
                        </View>

                        {wrongQuestions.map((item: any, index: number) => (
                            <Card key={index} style={styles.wrongCard} mode="outlined">
                                <Card.Content>
                                    <View style={styles.questionIdRow}>
                                        <Text variant="labelMedium" style={{ color: theme.colors.error }}>错题 #{index + 1}</Text>
                                        <Text variant="labelSmall" style={{ opacity: 0.5 }}>{item.question.type === 'single' ? '单选题' : '多选题'}</Text>
                                    </View>
                                    <View style={{ marginVertical: 12 }}>
                                        <MathText content={item.question.content} />
                                    </View>

                                    <View style={styles.answerBox}>
                                        <View style={styles.answerItem}>
                                            <Text variant="labelSmall" style={{ opacity: 0.6 }}>您的回答</Text>
                                            <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>{Array.isArray(item.userAnswer) ? item.userAnswer.join(', ') : (item.userAnswer || '未作答')}</Text>
                                        </View>
                                        <View style={[styles.answerItem, { borderLeftWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }]}>
                                            <Text variant="labelSmall" style={{ opacity: 0.6 }}>正确答案</Text>
                                            <Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>{item.question.correct_answer}</Text>
                                        </View>
                                    </View>

                                    {item.question.explanation && (
                                        <View style={styles.explanationBox}>
                                            <Text variant="labelSmall" style={{ fontWeight: 'bold', marginBottom: 4 }}>解析：</Text>
                                            <MathText content={item.question.explanation} />
                                        </View>
                                    )}
                                </Card.Content>
                            </Card>
                        ))}
                    </View>
                ) : (
                    <View style={styles.perfectState}>
                        <IconButton icon="trophy-outline" iconColor="#FFD700" size={64} />
                        <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>满分之姿！</Text>
                        <Text variant="bodySmall" style={{ opacity: 0.6 }}>您已经完全掌握了这些知识点。</Text>
                    </View>
                )}

                <Button
                    mode="contained"
                    onPress={handleExit}
                    style={styles.exitButton}
                    contentStyle={{ height: 50 }}
                >
                    返回首页
                </Button>
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16 },
    headerSurface: {
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        marginBottom: 20,
    },
    scoreText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 72,
        lineHeight: 80,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    statCard: {
        flex: 1,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    statContent: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        marginHorizontal: 16,
        paddingHorizontal: 8,
        opacity: 0.5,
        fontWeight: 'bold',
    },
    wrongCard: {
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: '#fff',
        borderColor: 'rgba(0,0,0,0.05)',
    },
    questionIdRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        paddingBottom: 8,
    },
    answerBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 12,
        marginTop: 8,
    },
    answerItem: {
        flex: 1,
        padding: 12,
        alignItems: 'center',
    },
    explanationBox: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
    },
    perfectState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    exitButton: {
        marginTop: 32,
        borderRadius: 12,
        elevation: 2,
    },
});
