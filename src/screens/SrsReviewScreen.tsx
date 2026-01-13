import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, Button, useTheme, Divider, Avatar, IconButton } from 'react-native-paper';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { getDB, Question } from '../db/database';
import MathText from '../components/MathText';

interface ReviewByBank {
    bankId: number;
    bankName: string;
    dueCount: number;
    previewQuestions: Question[];
}

export default function SrsReviewScreen() {
    const navigation = useNavigation<any>();
    const theme = useTheme();
    const isFocused = useIsFocused();
    const [groupedReviews, setGroupedReviews] = useState<ReviewByBank[]>([]);
    const [totalDue, setTotalDue] = useState(0);

    useEffect(() => {
        if (isFocused) {
            loadReviews();
        }
    }, [isFocused]);

    const loadReviews = async () => {
        try {
            const db = getDB();

            // 1. Fetch total due count
            const totalResult: any = await db.getFirstAsync(`
                SELECT COUNT(*) as count 
                FROM question_mastery 
                WHERE datetime(next_review_time, 'localtime') <= datetime('now', 'localtime')
            `);
            setTotalDue(totalResult?.count || 0);

            // 2. Fetch due items grouped by bank
            const dueItems = await db.getAllAsync<Question & { bank_name: string }>(`
                SELECT q.*, qb.name as bank_name
                FROM questions q
                JOIN question_banks qb ON q.bank_id = qb.id
                JOIN question_mastery qm ON q.id = qm.question_id
                WHERE datetime(qm.next_review_time, 'localtime') <= datetime('now', 'localtime')
                ORDER BY qb.name, q.id
            `);

            // Group by bank
            const grouped = dueItems.reduce((acc, item) => {
                const existing = acc.find(g => g.bankId === item.bank_id);
                if (existing) {
                    existing.dueCount++;
                    if (existing.previewQuestions.length < 3) {
                        existing.previewQuestions.push(item);
                    }
                } else {
                    acc.push({
                        bankId: item.bank_id,
                        bankName: item.bank_name,
                        dueCount: 1,
                        previewQuestions: [item]
                    });
                }
                return acc;
            }, [] as ReviewByBank[]);

            setGroupedReviews(grouped);
        } catch (error) {
            console.error('Failed to load reviews:', error);
        }
    };

    const renderHeader = () => (
        <View style={{ marginBottom: 20 }}>
            <View style={styles.headerRow}>
                <Avatar.Icon icon="calendar-check" size={48} style={{ backgroundColor: theme.colors.primary }} />
                <View style={{ marginLeft: 16 }}>
                    <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>今日复习计划</Text>
                    <Text variant="bodyMedium" style={{ color: 'gray' }}>
                        共有 {totalDue} 道题目等待巩固
                    </Text>
                </View>
            </View>
            <Divider style={{ marginVertical: 20 }} />
            <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 12 }}>按题库复习</Text>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <FlatList
                data={groupedReviews}
                keyExtractor={(item) => item.bankId.toString()}
                contentContainerStyle={{ padding: 16 }}
                ListHeaderComponent={renderHeader}
                renderItem={({ item }) => (
                    <Card style={styles.bankCard} mode="elevated">
                        <Card.Content style={{ padding: 16 }}>
                            {/* 头部区域 - 圆角卡片 */}
                            <View style={[styles.cardHeader, { backgroundColor: theme.colors.tertiaryContainer }]}>
                                <View style={{ flex: 1 }}>
                                    <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.onTertiaryContainer }}>
                                        {item.bankName}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                        <View style={[styles.badge, { backgroundColor: theme.colors.errorContainer }]}>
                                            <Text variant="labelSmall" style={{ color: theme.colors.error, fontWeight: 'bold' }}>
                                                ⏰ 待复习 {item.dueCount} 道
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <Button
                                    mode="contained"
                                    onPress={() => navigation.navigate('Quiz', {
                                        mode: 'review',
                                        bankId: item.bankId,
                                        bankName: item.bankName
                                    })}
                                    icon="pencil"
                                    buttonColor={theme.colors.primary}
                                    style={{ borderRadius: 20 }}
                                >
                                    去复习
                                </Button>
                            </View>

                            {/* 题目预览区域 */}
                            <View style={{ marginTop: 16 }}>
                                <Text variant="labelMedium" style={{ color: theme.colors.primary, marginBottom: 12, fontWeight: 'bold' }}>
                                    📝 题目预览
                                </Text>
                                {item.previewQuestions.map((q, index) => (
                                    <View key={q.id} style={styles.questionPreview}>
                                        <View style={[styles.indexBadge, { backgroundColor: theme.colors.secondaryContainer }]}>
                                            <Text variant="labelSmall" style={{ color: theme.colors.onSecondaryContainer, fontWeight: 'bold' }}>
                                                {index + 1}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <MathText content={q.content} fontSize={14} color={theme.colors.onSurface} />
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </Card.Content>
                    </Card>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <IconButton icon="check-circle-outline" size={64} style={{ opacity: 0.2 }} />
                        <Text variant="bodyLarge">太棒了！今日复习任务已全部完成。</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    bankCard: {
        marginBottom: 16,
        borderRadius: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
    },
    bankHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    questionPreview: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 10,
    },
    indexBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewItem: { flexDirection: 'row', marginTop: 8, gap: 8 },
    emptyContainer: { marginTop: 100, alignItems: 'center', opacity: 0.5 },
});
