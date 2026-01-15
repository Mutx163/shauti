import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
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
                <Surface style={[styles.headerSurface, { backgroundColor: theme.colors.primary }]} elevation={0}>
                    <IconButton icon={info.icon} iconColor={theme.colors.onPrimary} size={42} style={{ marginBottom: -8 }} />
                    <Text variant="displayLarge" style={[styles.scoreText, { color: theme.colors.onPrimary }]}>{percentage}</Text>
                    <Text variant="titleMedium" style={{ color: theme.colors.onPrimary, opacity: 0.9, fontWeight: 'bold' }}>模拟考试：{info.label}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onPrimary, opacity: 0.7, marginTop: 4 }}>{info.msg}</Text>
                </Surface>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <Card style={[styles.statCard, { backgroundColor: '#FFFFFF', borderColor: '#E5E5EA' }]} mode="outlined">
                        <Card.Content style={styles.statContent}>
                            <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.primary }}>{score}/{total}</Text>
                            <Text variant="labelSmall" style={{ opacity: 0.6, color: '#8E8E93' }}>答对题目</Text>
                        </Card.Content>
                    </Card>
                    <Card style={[styles.statCard, { backgroundColor: '#FFFFFF', borderColor: '#E5E5EA' }]} mode="outlined">
                        <Card.Content style={styles.statContent}>
                            <Text variant="titleLarge" style={{ fontWeight: 'bold', color: '#1C1C1E' }}>{formatTime(duration)}</Text>
                            <Text variant="labelSmall" style={{ opacity: 0.6, color: '#8E8E93' }}>答题耗时</Text>
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
                            <Card key={index} style={styles.wrongCard} mode="outlined">
                                <Card.Content style={{ padding: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <View style={[styles.miniBadge, { backgroundColor: '#FFF5F5' }]}>
                                            <Text style={{ color: '#FF3B30', fontSize: 11, fontWeight: 'bold' }}>#{index + 1}</Text>
                                        </View>
                                        <Text variant="labelSmall" style={{ color: '#8E8E93', marginLeft: 8, fontWeight: '600', marginTop: 1 }}>
                                            {item.question.type === 'single' ? '单选题' : (item.question.type === 'multi' ? '多选题' : '题目')}
                                        </Text>
                                    </View>

                                    <View style={{ paddingLeft: 4, marginBottom: 16 }}>
                                        <MathText
                                            content={item.question.content.length > 50 ? item.question.content.substring(0, 47) + '...' : item.question.content}
                                            color="#1C1C1E"
                                            fontSize={16}
                                        />
                                    </View>

                                    <View style={styles.answerRowCompact}>
                                        <View style={[styles.answerPill, { backgroundColor: '#F2F2F7' }]}>
                                            <Text style={styles.pillLabel}>您的回答</Text>
                                            <Text style={[styles.pillValue, { color: '#FF3B30' }]}>
                                                {Array.isArray(item.userAnswer) ? item.userAnswer.join(', ') : (item.userAnswer || '未作答')}
                                            </Text>
                                        </View>
                                        <View style={[styles.answerPill, { backgroundColor: theme.colors.primary + '10' }]}>
                                            <Text style={[styles.pillLabel, { color: theme.colors.primary }]}>正确答案</Text>
                                            <Text style={[styles.pillValue, { color: successColor }]}>{item.question.correct_answer}</Text>
                                        </View>
                                    </View>

                                    {item.question.explanation && (
                                        <View style={styles.explanationSection}>
                                            <View style={styles.explanationHeader}>
                                                <IconButton icon="book-open-variant" size={14} style={{ margin: 0 }} iconColor="#8E8E93" />
                                                <Text variant="labelSmall" style={{ fontWeight: 'bold', color: '#8E8E93', marginLeft: -4 }}>解析详情</Text>
                                            </View>
                                            <View style={{ paddingLeft: 4 }}>
                                                <MathText content={item.question.explanation} color="#48484A" fontSize={14} />
                                            </View>
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
        marginBottom: 12,
    },
    statCard: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 1,
    },
    statContent: {
        alignItems: 'center',
        paddingVertical: 14,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    sectionTitle: {
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
        fontSize: 12,
    },
    wrongCard: {
        marginBottom: 16,
        borderRadius: 20,
        borderColor: '#E5E5EA',
        backgroundColor: '#FFFFFF',
    },
    miniBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    answerRowCompact: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    answerPill: {
        flex: 1,
        minWidth: '45%',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pillLabel: {
        fontSize: 12,
        opacity: 0.7,
        color: '#8E8E93',
    },
    pillValue: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    explanationSection: {
        marginTop: 16,
        padding: 12,
        borderRadius: 16,
        backgroundColor: '#F8F8F8',
        borderWidth: 1,
        borderColor: '#F2F2F7',
    },
    explanationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    perfectState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    exitButton: {
        marginTop: 32,
        borderRadius: 16,
    },
});
