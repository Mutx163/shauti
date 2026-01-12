import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, Button, useTheme, Divider, Avatar, IconButton } from 'react-native-paper'; // Added Avatar, IconButton
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { getDB, Question } from '../db/database';
import MathText from '../components/MathText';

interface MistakeByBank {
    bankId: number;
    bankName: string;
    mistakes: Question[];
}

export default function MistakeScreen() {
    const navigation = useNavigation<any>();
    const theme = useTheme();
    const isFocused = useIsFocused();
    const [groupedMistakes, setGroupedMistakes] = useState<MistakeByBank[]>([]);

    useEffect(() => {
        if (isFocused) {
            loadMistakes();
        }
    }, [isFocused]);

    const loadMistakes = async () => {
        try {
            const db = getDB();
            // 获取所有错题及其题库信息
            const mistakes = await db.getAllAsync<Question & { bank_name: string }>(
                `SELECT DISTINCT q.*, qb.name as bank_name
                 FROM questions q 
                 JOIN question_banks qb ON q.bank_id = qb.id
                 JOIN user_progress up ON q.id = up.question_id 
                 WHERE up.is_correct = 0
                 ORDER BY qb.name, q.id`
            );

            // 按题库分组
            const grouped = mistakes.reduce((acc, mistake) => {
                const existing = acc.find(g => g.bankId === mistake.bank_id);
                if (existing) {
                    existing.mistakes.push(mistake);
                } else {
                    acc.push({
                        bankId: mistake.bank_id,
                        bankName: mistake.bank_name,
                        mistakes: [mistake]
                    });
                }
                return acc;
            }, [] as MistakeByBank[]);

            setGroupedMistakes(grouped);
        } catch (error) {
            console.error('Failed to load mistakes:', error);
        }
    };

    const renderHeader = () => (
        <View style={{ marginBottom: 24 }}>
            <Card
                style={{ backgroundColor: theme.colors.primaryContainer, marginBottom: 16 }}
                onPress={() => navigation.navigate('MockConfig')}
                mode="elevated"
            >
                <Card.Title
                    title="全真模拟考试"
                    subtitle="随机抽题 · 限时测验 · 智能组卷"
                    titleVariant="titleMedium"
                    subtitleVariant="bodySmall"
                    left={(props) => <Avatar.Icon {...props} icon="clipboard-text-clock" style={{ backgroundColor: theme.colors.primary }} />}
                    right={(props) => <IconButton {...props} icon="chevron-right" />}
                />
            </Card>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>错题专项复习</Text>
                {groupedMistakes.length === 0 && (
                    <Text variant="bodySmall" style={{ color: 'gray', marginLeft: 8 }}>暂无错题</Text>
                )}
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <FlatList
                data={groupedMistakes}
                keyExtractor={(item) => item.bankId.toString()}
                contentContainerStyle={{ padding: 16 }}
                ListHeaderComponent={renderHeader}
                renderItem={({ item }) => (
                    <Card style={styles.bankCard} mode="elevated">
                        <Card.Content>
                            <View style={styles.bankHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text variant="titleMedium">{item.bankName}</Text>
                                    <Text variant="bodySmall" style={{ color: 'gray', marginTop: 4 }}>
                                        错题数：{item.mistakes.length}
                                    </Text>
                                </View>
                                <Button
                                    mode="contained"
                                    onPress={() => navigation.navigate('Quiz', {
                                        mode: 'mistake',
                                        bankId: item.bankId,
                                        bankName: item.bankName
                                    })}
                                    compact
                                >
                                    开始复习
                                </Button>
                            </View>
                            <Divider style={{ marginVertical: 12 }} />
                            {item.mistakes.slice(0, 3).map((mistake, index) => (
                                <View key={mistake.id} style={styles.previewItem}>
                                    <Text variant="bodySmall" style={{ color: 'gray' }}>
                                        {index + 1}.
                                    </Text>
                                    <MathText content={mistake.content} fontSize={13} color="#666" />
                                </View>
                            ))}
                            {item.mistakes.length > 3 && (
                                <Text variant="bodySmall" style={{ color: 'gray', marginTop: 4, textAlign: 'center' }}>
                                    还有 {item.mistakes.length - 3} 道错题...
                                </Text>
                            )}
                        </Card.Content>
                    </Card>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    emptyContainer: { justifyContent: 'center', alignItems: 'center' },
    bankCard: { marginBottom: 16, borderRadius: 12 },
    bankHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    previewItem: { flexDirection: 'row', marginTop: 8, gap: 8 },
});
