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

    const successColor = theme.colors.primary === '#006D3A' ? '#4CAF50' : theme.colors.primary;

    const getScoreInfo = () => {
        const isEyeCare = theme.colors.primary === '#006D3A';
        if (percentage >= 90) return { label: '优秀', color: successColor, icon: 'medal-outline', msg: '才华横溢，实至名归！' };
        if (percentage >= 80) return { 
            label: '良好', 
            color: isEyeCare ? '#81C784' : theme.colors.primary, 
            icon: 'emoticon-happy-outline', 
            msg: '表现出色，继续保持！' 
        };
        if (percentage >= 60) return { 
            label: '及格', 
            color: isEyeCare ? '#FFD54F' : (theme.dark ? '#FFB74D' : '#F57C00'), 
            icon: 'emoticon-neutral-outline', 
            msg: '基础扎实，尚有空间。' 
        };
        return { label: '待加强', color: theme.colors.error, icon: 'emoticon-sad-outline', msg: '不积跬步，无以至千里。' };
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
                <Surface style={[styles.headerSurface, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.shadow }]} elevation={2}>
                    <IconButton icon={info.icon} iconColor={theme.colors.onPrimary} size={48} style={{ marginBottom: 0 }} />
                    <Text variant="displayLarge" style={[styles.scoreText, { color: theme.colors.onPrimary }]}>{percentage}</Text>
                    <Text variant="titleMedium" style={{ color: theme.colors.onPrimary, opacity: 0.9, fontWeight: 'bold' }}>模拟考试：{info.label}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onPrimary, opacity: 0.7, marginTop: 4 }}>{info.msg}</Text>
                </Surface>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <Card style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant, shadowColor: theme.colors.shadow }]} mode="contained">
                        <Card.Content style={styles.statContent}>
                            <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.primary }}>{score}/{total}</Text>
                            <Text variant="labelSmall" style={{ opacity: 0.6, color: theme.colors.onSurfaceVariant }}>答对题目</Text>
                        </Card.Content>
                    </Card>
                    <Card style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant, shadowColor: theme.colors.shadow }]} mode="contained">
                        <Card.Content style={styles.statContent}>
                            <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{formatTime(duration)}</Text>
                            <Text variant="labelSmall" style={{ opacity: 0.6, color: theme.colors.onSurfaceVariant }}>答题耗时</Text>
                        </Card.Content>
                    </Card>
                </View>

                {/* Wrong Questions Section */}
                {wrongQuestions.length > 0 ? (
                    <View style={{ marginTop: 24 }}>
                        <View style={styles.sectionHeader}>
                            <Divider style={{ flex: 1 }} />
                            <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>错题解析 ({wrongQuestions.length})</Text>
                            <Divider style={{ flex: 1 }} />
                        </View>

                        {wrongQuestions.map((item: any, index: number) => (
                            <Card key={index} style={[styles.wrongCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant, shadowColor: theme.colors.shadow }]} mode="outlined">
                                <Card.Content>
                                    <View style={[styles.questionIdRow, { borderBottomColor: theme.colors.outlineVariant }]}>
                                        <Text variant="labelMedium" style={{ color: theme.colors.error }}>错题 #{index + 1}</Text>
                                        <Text variant="labelSmall" style={{ opacity: 0.5, color: theme.colors.onSurfaceVariant }}>{item.question.type === 'single' ? '单选题' : '多选题'}</Text>
                                    </View>
                                    <View style={{ marginVertical: 12 }}>
                                        <MathText content={item.question.content} color={theme.colors.onSurface} />
                                    </View>

                                    <View style={[styles.answerBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                                        <View style={styles.answerItem}>
                                            <Text variant="labelSmall" style={{ opacity: 0.6, color: theme.colors.onSurfaceVariant }}>您的回答</Text>
                                            <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>{Array.isArray(item.userAnswer) ? item.userAnswer.join(', ') : (item.userAnswer || '未作答')}</Text>
                                        </View>
                                        <View style={[styles.answerItem, { borderLeftWidth: 1, borderColor: theme.colors.outlineVariant }]}>
                                            <Text variant="labelSmall" style={{ opacity: 0.6, color: theme.colors.onSurfaceVariant }}>正确答案</Text>
                                            <Text style={{ color: successColor, fontWeight: 'bold' }}>{item.question.correct_answer}</Text>
                                        </View>
                                    </View>

                                    {item.question.explanation && (
                                        <View style={[styles.explanationBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                                            <Text variant="labelSmall" style={{ fontWeight: 'bold', marginBottom: 4, color: theme.colors.onSurfaceVariant }}>解析：</Text>
                                            <MathText content={item.question.explanation} color={theme.colors.onSurfaceVariant} />
                                        </View>
                                    )}
                                </Card.Content>
                            </Card>
                        ))}
                    </View>
                ) : (
                    <View style={styles.perfectState}>
                        <IconButton icon="trophy-outline" iconColor={theme.colors.primary} size={64} />
                        <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>满分之姿！</Text>
                        <Text variant="bodySmall" style={{ opacity: 0.6, color: theme.colors.onSurfaceVariant }}>您已经完全掌握了这些知识点。</Text>
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
        borderWidth: 1,
    },
    questionIdRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        paddingBottom: 8,
    },
    answerBox: {
        flexDirection: 'row',
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
