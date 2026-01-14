import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, Card, Button, useTheme, Divider, Avatar, IconButton, Portal, Dialog } from 'react-native-paper';
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
    const [clearAllDialog, setClearAllDialog] = useState(false);
    const [clearBankDialog, setClearBankDialog] = useState<number | null>(null);

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
                `SELECT q.*, qb.name as bank_name
                 FROM questions q 
                 JOIN question_banks qb ON q.bank_id = qb.id
                 WHERE EXISTS (
                     SELECT 1 FROM user_progress up 
                     WHERE up.question_id = q.id 
                     AND up.id = (SELECT id FROM user_progress WHERE question_id = q.id ORDER BY timestamp DESC LIMIT 1)
                     AND up.is_correct = 0
                 )
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

    // 清空所有错题
    const clearAllMistakes = async () => {
        try {
            const db = getDB();
            // 为所有错题添加一条正确的记录，将其从错题本移除
            await db.runAsync(
                `INSERT INTO user_progress (question_id, is_correct, timestamp)
                 SELECT DISTINCT up.question_id, 1, datetime('now')
                 FROM user_progress up
                 WHERE up.is_correct = 0
                 AND up.id = (SELECT id FROM user_progress WHERE question_id = up.question_id ORDER BY timestamp DESC LIMIT 1)`
            );
            setClearAllDialog(false);
            loadMistakes();
        } catch (error) {
            console.error('Failed to clear all mistakes:', error);
            Alert.alert('错误', '清空失败，请重试');
        }
    };

    // 清空指定题库的错题
    const clearBankMistakes = async (bankId: number) => {
        try {
            const db = getDB();
            // 为该题库的所有错题添加正确记录
            await db.runAsync(
                `INSERT INTO user_progress (question_id, is_correct, timestamp)
                 SELECT DISTINCT up.question_id, 1, datetime('now')
                 FROM user_progress up
                 JOIN questions q ON up.question_id = q.id
                 WHERE q.bank_id = ?
                 AND up.is_correct = 0
                 AND up.id = (SELECT id FROM user_progress WHERE question_id = up.question_id ORDER BY timestamp DESC LIMIT 1)`,
                bankId
            );
            setClearBankDialog(null);
            loadMistakes();
        } catch (error) {
            console.error('Failed to clear bank mistakes:', error);
            Alert.alert('错误', '清空失败，请重试');
        }
    };

    const renderHeader = () => (
        <View style={{ marginBottom: 24 }}>
            <Card
                style={{ 
                    backgroundColor: theme.colors.primary, 
                    marginBottom: 20, 
                    borderRadius: 16,
                    elevation: 4,
                    shadowColor: theme.colors.shadow 
                }}
                onPress={() => navigation.navigate('MockConfig')}
                mode="elevated"
            >
                <Card.Content style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 20 }}>
                    <View style={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                        borderRadius: 12, 
                        padding: 10,
                        marginRight: 16 
                    }}>
                        <Avatar.Icon 
                            size={32} 
                            icon="clipboard-text-clock" 
                            style={{ backgroundColor: 'transparent' }} 
                            color="#FFFFFF" 
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text variant="titleLarge" style={{ color: '#FFFFFF', fontWeight: 'bold' }}>全真模拟考试</Text>
                        <Text variant="bodySmall" style={{ color: 'rgba(255, 255, 255, 0.8)', marginTop: 2 }}>
                            基于艾宾浩斯曲线 · 智能组卷
                        </Text>
                    </View>
                    <IconButton icon="chevron-right" iconColor="#FFFFFF" />
                </Card.Content>
            </Card>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>错题专项复习</Text>
                    {groupedMistakes.length === 0 && (
                        <Text variant="bodySmall" style={{ color: theme.colors.outline, marginLeft: 8 }}>暂无错题</Text>
                    )}
                </View>
                {groupedMistakes.length > 0 && (
                    <Button
                        mode="text"
                        onPress={() => setClearAllDialog(true)}
                        icon="delete-sweep"
                        textColor={theme.colors.error}
                        compact
                    >
                        清空全部
                    </Button>
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
                    <Card
                        key={item.bankId}
                        style={[
                            styles.bankCard,
                            {
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.outlineVariant,
                                shadowColor: theme.colors.shadow,
                            }
                        ]}
                        mode="elevated"
                    >
                        <Card.Content style={{ padding: 16 }}>
                            {/* 头部区域 - 圆角卡片 */}
                            <View style={[styles.cardHeader, { backgroundColor: theme.colors.surfaceVariant }]}>
                                <View style={{ flex: 1 }}>
                                    <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.onSurfaceVariant }}>
                                        {item.bankName}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                        <View style={[styles.badge, { backgroundColor: theme.colors.errorContainer }]}>
                                            <Text variant="labelSmall" style={{ color: theme.colors.error, fontWeight: 'bold' }}>
                                                {item.mistakes.length} 道错题
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                    <IconButton
                                        icon="delete-outline"
                                        size={22}
                                        onPress={() => setClearBankDialog(item.bankId)}
                                        iconColor={theme.colors.error}
                                        style={{ margin: 0, backgroundColor: theme.colors.surface }}
                                    />
                                    <Button
                                        mode="contained"
                                        onPress={() => navigation.navigate('Quiz', {
                                            mode: 'mistake',
                                            bankId: item.bankId,
                                            bankName: item.bankName,
                                            reset: true // 强制重置进度，以便重新练习
                                        })}
                                        icon="play"
                                        buttonColor={theme.colors.primary}
                                        style={{ borderRadius: 20 }}
                                    >
                                        开始复习
                                    </Button>
                                </View>
                            </View>

                            {/* 错题预览区域 */}
                            <View style={{ marginTop: 16 }}>
                                <Text variant="labelMedium" style={{ color: theme.colors.primary, marginBottom: 12, fontWeight: 'bold' }}>
                                    📝 错题预览
                                </Text>
                                {item.mistakes.slice(0, 3).map((mistake, index) => (
                                    <View key={mistake.id} style={styles.mistakePreview}>
                                        <View style={[styles.indexBadge, { backgroundColor: theme.colors.secondaryContainer }]}>
                                            <Text variant="labelSmall" style={{ color: theme.colors.onSecondaryContainer, fontWeight: 'bold' }}>
                                                {index + 1}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <MathText content={mistake.content} fontSize={14} color={theme.colors.onSurface} />
                                        </View>
                                    </View>
                                ))}
                                {item.mistakes.length > 3 && (
                                    <View style={[styles.moreIndicator, { backgroundColor: theme.colors.surfaceVariant }]}>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            📚 还有 {item.mistakes.length - 3} 道错题等待复习
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </Card.Content>
                    </Card>
                )}
            />

            {/* 清空全部对话框 */}
            <Portal>
                <Dialog visible={clearAllDialog} onDismiss={() => setClearAllDialog(false)}>
                    <Dialog.Title>确认清空</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium">确定要清空所有错题吗？此操作不可恢复。</Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setClearAllDialog(false)}>取消</Button>
                        <Button onPress={clearAllMistakes} textColor={theme.colors.error}>确认清空</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* 清空题库对话框 */}
            <Portal>
                <Dialog visible={clearBankDialog !== null} onDismiss={() => setClearBankDialog(null)}>
                    <Dialog.Title>确认清空</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium">
                            确定要清空"{groupedMistakes.find(g => g.bankId === clearBankDialog)?.bankName}"的所有错题吗？
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setClearBankDialog(null)}>取消</Button>
                        <Button
                            onPress={() => clearBankDialog && clearBankMistakes(clearBankDialog)}
                            textColor={theme.colors.error}
                        >
                            确认清空
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    emptyContainer: { justifyContent: 'center', alignItems: 'center' },
    bankCard: {
        marginBottom: 16,
        borderRadius: 20,
        borderWidth: 1,
        elevation: 3,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
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
    mistakePreview: {
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
    moreIndicator: {
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 4,
    },
});
