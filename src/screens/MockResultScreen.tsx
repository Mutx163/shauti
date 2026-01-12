import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card, Divider, useTheme, List } from 'react-native-paper';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import MathText from '../components/MathText';

export default function MockResultScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const theme = useTheme();
    // results: { question, userAnswer, isCorrect }[]
    const { results, score, total, duration } = route.params;

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
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <Card style={styles.scoreCard}>
                    <Card.Content style={{ alignItems: 'center' }}>
                        <Text variant="titleMedium">考试得分</Text>
                        <Text variant="displayLarge" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                            {Math.round((score / total) * 100)}
                        </Text>
                        <View style={styles.statsRow}>
                            <View style={styles.stat}>
                                <Text variant="titleSmall">{score}/{total}</Text>
                                <Text variant="bodySmall">答对</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.stat}>
                                <Text variant="titleSmall">{formatTime(duration)}</Text>
                                <Text variant="bodySmall">用时</Text>
                            </View>
                        </View>
                    </Card.Content>
                </Card>

                <Button mode="contained" onPress={handleExit} style={{ marginBottom: 16 }}>
                    返回首页
                </Button>

                {wrongQuestions.length > 0 && (
                    <View>
                        <Text variant="titleMedium" style={{ marginBottom: 12 }}>错题回顾 ({wrongQuestions.length})</Text>
                        {wrongQuestions.map((item: any, index: number) => (
                            <Card key={index} style={styles.wrongCard}>
                                <Card.Content>
                                    <View style={{ marginBottom: 8 }}>
                                        <MathText content={item.question.content} />
                                    </View>
                                    <Text style={{ color: theme.colors.error }}>
                                        您的答案: {JSON.stringify(item.userAnswer) || '未作答'}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                        <Text style={{ fontWeight: 'bold' }}>正确答案: </Text>
                                        <MathText content={item.question.correct_answer} />
                                    </View>
                                </Card.Content>
                            </Card>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16 },
    scoreCard: { marginBottom: 24, paddingVertical: 16, borderRadius: 16 },
    statsRow: { flexDirection: 'row', marginTop: 16, width: '100%', justifyContent: 'space-evenly' },
    stat: { alignItems: 'center' },
    divider: { width: 1, backgroundColor: '#eee' },
    wrongCard: { marginBottom: 12, borderRadius: 12, backgroundColor: '#fff5f5' },
});
