import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, useTheme, IconButton, Avatar, Portal, Modal, TextInput, Button } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { getDB, QuestionBank } from '../db/database';
import { Swipeable } from 'react-native-gesture-handler';

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const theme = useTheme();

    const [banks, setBanks] = useState<(QuestionBank & { due_count?: number; mistake_count?: number })[]>([]);
    const [reviewCount, setReviewCount] = useState(0);

    // Rename State
    const [renameVisible, setRenameVisible] = useState(false);
    const [targetBank, setTargetBank] = useState<QuestionBank | null>(null);
    const [newName, setNewName] = useState('');

    // Merge State
    const [mergeVisible, setMergeVisible] = useState(false);
    const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);

    const loadBanks = async () => {
        try {
            const db = getDB();
            const result = await db.getAllAsync<QuestionBank & { due_count: number; mistake_count: number }>(`
                SELECT 
                    qb.*, 
                    (SELECT COUNT(*) FROM questions q 
                     JOIN question_mastery qm ON q.id = qm.question_id 
                     WHERE q.bank_id = qb.id AND datetime(qm.next_review_time, 'localtime') <= datetime('now', 'localtime')) as due_count,
                    (SELECT COUNT(*) FROM questions q 
                     WHERE q.bank_id = qb.id AND EXISTS (
                         SELECT 1 FROM user_progress up 
                         WHERE up.question_id = q.id 
                         AND up.id = (SELECT id FROM user_progress WHERE question_id = q.id ORDER BY timestamp DESC LIMIT 1)
                         AND up.is_correct = 0
                     )) as mistake_count
                FROM question_banks qb
                ORDER BY qb.created_at DESC
            `);
            setBanks(result);
        } catch (error) {
            console.error(error);
        }
    };

    const loadReviewCount = async () => {
        try {
            const db = getDB();
            // Fetch count of items due for review
            const result: any = await db.getFirstAsync(`
                SELECT COUNT(*) as count 
                FROM questions q
                JOIN question_mastery qm ON q.id = qm.question_id
                WHERE datetime(qm.next_review_time, 'localtime') <= datetime('now', 'localtime')
            `);
            setReviewCount(result?.count || 0);
        } catch (error) {
            console.error('Failed to load review count:', error);
        }
    };

    useEffect(() => {
        if (isFocused) {
            loadBanks();
            loadReviewCount();
        }
    }, [isFocused]);

    const swipeableRefs = React.useRef<Map<number, any>>(new Map());

    const closeSwipeable = (id: number) => {
        const ref = swipeableRefs.current.get(id);
        if (ref) {
            ref.close();
        }
    };

    const handleDeleteBank = async (id: number, name: string) => {
        closeSwipeable(id);
        Alert.alert(
            '确认删除',
            `确定要删除题库 "${name}" 吗？此操作不可撤销。`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '删除',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const db = getDB();
                            await db.runAsync('DELETE FROM question_banks WHERE id = ?', id);
                            loadBanks();
                            Alert.alert('已删除', '题库已从本地移除');
                        } catch (e) {
                            Alert.alert('错误', '删除失败');
                        }
                    }
                }
            ]
        );
    };

    const handleShare = async (bank: QuestionBank) => {
        closeSwipeable(bank.id);
        try {
            const db = getDB();
            const questions = await db.getAllAsync('SELECT * FROM questions WHERE bank_id = ?', bank.id);
            const shareData = {
                name: bank.name,
                description: bank.description,
                questions: questions.map((q: any) => ({
                    type: q.type,
                    content: q.content,
                    options: JSON.parse(q.options),
                    answer: q.correct_answer,
                    explanation: q.explanation
                }))
            };
            // Simple base64 for transfer
            const shareCode = btoa(unescape(encodeURIComponent(JSON.stringify(shareData))));
            await Clipboard.setStringAsync(shareCode);
            Alert.alert('分享成功', '题库分享码已复制到剪贴板，快发给小伙伴吧！');
        } catch (e) {
            Alert.alert('错误', '生成分享码失败');
        }
    };

    const confirmRename = async () => {
        if (!targetBank || !newName.trim()) return;
        try {
            const db = getDB();
            await db.runAsync('UPDATE question_banks SET name = ? WHERE id = ?', newName.trim(), targetBank.id);
            setRenameVisible(false);
            setTargetBank(null);
            setNewName('');
            loadBanks();
        } catch (e) {
            Alert.alert('错误', '重命名失败');
        }
    };

    const openRename = (bank: QuestionBank) => {
        closeSwipeable(bank.id);
        setTargetBank(bank);
        setNewName(bank.name);
        setRenameVisible(true);
    };

    const openMerge = (bank: QuestionBank) => {
        closeSwipeable(bank.id);
        setTargetBank(bank);
        setMergeTargetId(null);
        setMergeVisible(true);
    };

    const confirmMerge = async () => {
        if (!targetBank || !mergeTargetId) return;
        if (targetBank.id === mergeTargetId) {
            Alert.alert('错误', '不能合并到自己');
            return;
        }

        try {
            const db = getDB();
            await db.runAsync('UPDATE questions SET bank_id = ? WHERE bank_id = ?', mergeTargetId, targetBank.id);
            await db.runAsync('DELETE FROM question_banks WHERE id = ?', targetBank.id);

            setMergeVisible(false);
            setTargetBank(null);
            setMergeTargetId(null);
            loadBanks();
            Alert.alert('成功', '题库已合并');
        } catch (e) {
            Alert.alert('错误', '合并失败');
        }
    };

    const renderRightActions = (item: QuestionBank) => (
        <View style={styles.swipeActions}>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: theme.colors.tertiaryContainer }]}
                onPress={() => openRename(item)}
            >
                <IconButton icon="pencil-outline" iconColor={theme.colors.onTertiaryContainer} size={20} />
                <Text style={{ color: theme.colors.onTertiaryContainer, fontSize: 10 }}>重命名</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: theme.colors.secondaryContainer }]}
                onPress={() => handleShare(item)}
            >
                <IconButton icon="share-variant" iconColor={theme.colors.onSecondaryContainer} size={20} />
                <Text style={{ color: theme.colors.onSecondaryContainer, fontSize: 10 }}>分享</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: '#BBDEFB' }]}
                onPress={() => {
                    closeSwipeable(item.id);
                    navigation.navigate('MasteryList', { bankId: item.id, bankName: item.name });
                }}
            >
                <IconButton icon="format-list-checks" iconColor="#1976D2" size={20} />
                <Text style={{ color: '#1976D2', fontSize: 10 }}>清单</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: '#e0e0e0' }]}
                onPress={() => openMerge(item)}
            >
                <IconButton icon="call-merge" iconColor="#333" size={20} />
                <Text style={{ color: '#333', fontSize: 10 }}>合并</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.swipeAction, { backgroundColor: theme.colors.errorContainer }]}
                onPress={() => handleDeleteBank(item.id, item.name)}
            >
                <IconButton icon="delete-outline" iconColor={theme.colors.error} size={20} />
                <Text style={{ color: theme.colors.error, fontSize: 10 }}>删除</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <FlatList
                data={banks}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ padding: 16 }}
                ListHeaderComponent={
                    reviewCount > 0 ? (
                        <Card
                            style={styles.reviewCard}
                            onPress={() => navigation.navigate('SrsReview')}
                        >
                            <Card.Title
                                title="今日待复习"
                                subtitle={`已有 ${reviewCount} 道题目等待巩固`}
                                titleStyle={{ color: theme.colors.onPrimaryContainer, fontWeight: 'bold' }}
                                left={(props) => <Avatar.Icon {...props} icon="calendar-check" style={{ backgroundColor: theme.colors.primary }} />}
                                right={(props) => <IconButton {...props} icon="chevron-right" iconColor={theme.colors.onPrimaryContainer} />}
                                style={{ backgroundColor: theme.colors.primaryContainer, borderRadius: 16 }}
                            />
                        </Card>
                    ) : null
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <IconButton icon="book-off-outline" size={64} style={{ opacity: 0.2 }} />
                        <Text variant="bodyLarge">暂无题库，请点击右上角按钮导入。</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <Swipeable
                        activeOffsetX={[-30, 30]} // Increase threshold to avoid accidental trigger during vertical scroll
                        ref={ref => {
                            if (ref) swipeableRefs.current.set(item.id, ref);
                            else swipeableRefs.current.delete(item.id);
                        }}
                        renderRightActions={() => renderRightActions(item)}
                    >
                        <Card
                            style={styles.card}
                            onPress={() => navigation.navigate('QuizConfig', { bankId: item.id, bankName: item.name })}
                            mode="elevated"
                        >
                            <Card.Title
                                title={item.name}
                                subtitle={item.description || '开始学习之旅'}
                                titleVariant="titleMedium"
                                subtitleVariant="bodySmall"
                                right={(props) => (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {item.due_count! > 0 && (
                                            <View style={[styles.dueBadge, { backgroundColor: theme.colors.secondaryContainer }]}>
                                                <Text style={[styles.dueBadgeText, { color: theme.colors.secondary }]}>
                                                    {item.due_count} 复习
                                                </Text>
                                            </View>
                                        )}
                                        {item.mistake_count! > 0 && (
                                            <View style={[styles.dueBadge, { backgroundColor: theme.colors.errorContainer }]}>
                                                <Text style={[styles.dueBadgeText, { color: theme.colors.error }]}>
                                                    {item.mistake_count} 错题
                                                </Text>
                                            </View>
                                        )}
                                        <IconButton {...props} icon="chevron-right" />
                                    </View>
                                )}
                            />
                        </Card>
                    </Swipeable>
                )}
            />
            <Portal>
                <Modal visible={renameVisible} onDismiss={() => setRenameVisible(false)} contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                    <Text variant="titleMedium" style={{ marginBottom: 16 }}>重命名题库</Text>
                    <TextInput
                        label="名称"
                        value={newName}
                        onChangeText={setNewName}
                        mode="outlined"
                        style={{ marginBottom: 16 }}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                        <Button onPress={() => setRenameVisible(false)}>取消</Button>
                        <Button mode="contained" onPress={confirmRename} style={{ marginLeft: 8 }}>确定</Button>
                    </View>
                </Modal>

                <Modal visible={mergeVisible} onDismiss={() => setMergeVisible(false)} contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                    <Text variant="titleMedium" style={{ marginBottom: 8 }}>合并题库</Text>
                    <Text variant="bodySmall" style={{ color: 'gray', marginBottom: 16 }}>
                        将 "{targetBank?.name}" 的所有题目移动到：
                    </Text>
                    <FlatList
                        data={banks.filter(b => b.id !== targetBank?.id)}
                        keyExtractor={item => item.id.toString()}
                        style={{ maxHeight: 250, marginBottom: 16 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[
                                    styles.bankOption,
                                    item.id === mergeTargetId && { backgroundColor: theme.colors.secondaryContainer }
                                ]}
                                onPress={() => setMergeTargetId(item.id)}
                            >
                                <Text style={{ color: item.id === mergeTargetId ? theme.colors.onSecondaryContainer : theme.colors.onSurface }}>
                                    {item.name}
                                </Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={{ padding: 10 }}>无其他题库可选</Text>}
                    />
                    <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 16 }}>
                        注意：合并后原题库 "{targetBank?.name}" 将被删除。
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                        <Button onPress={() => setMergeVisible(false)}>取消</Button>
                        <Button mode="contained" onPress={confirmMerge} disabled={!mergeTargetId} style={{ marginLeft: 8 }}>合并</Button>
                    </View>
                </Modal>
            </Portal>
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    emptyContainer: { alignItems: 'center', marginTop: 100, opacity: 0.5 },
    card: { marginBottom: 12, borderRadius: 12 },
    reviewCard: { marginBottom: 20, borderRadius: 16, overflow: 'hidden' },
    swipeActions: {
        width: 250,
        marginBottom: 12,
        flexDirection: 'row',
    },
    swipeAction: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        margin: 20,
        padding: 24,
        borderRadius: 28,
    },
    bankOption: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    dueBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 4,
    },
    dueBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    }
});
