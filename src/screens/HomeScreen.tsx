import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity, TouchableWithoutFeedback, Pressable, RefreshControl } from 'react-native';
import { Text, useTheme, IconButton, Avatar, Portal, Modal, TextInput, Button } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { getDB, QuestionBank } from '../db/database';
import { Swipeable } from 'react-native-gesture-handler';
import { getSyncDescription } from '../utils/timeFormat';
import { SubscriptionService } from '../services/SubscriptionService';

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const theme = useTheme();

    const [banks, setBanks] = useState<(QuestionBank & { due_count?: number; mistake_count?: number })[]>([]);
    const [reviewCount, setReviewCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const unsubscribe = SubscriptionService.subscribe(setIsSyncing);
        return () => { unsubscribe(); };
    }, []);

    // Rename State
    const [renameVisible, setRenameVisible] = useState(false);
    const [targetBank, setTargetBank] = useState<QuestionBank | null>(null);
    const [remarkVisible, setRemarkVisible] = useState(false);
    const [newName, setNewName] = useState('');
    const [newRemark, setNewRemark] = useState('');

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
                     WHERE q.bank_id = qb.id AND EXISTS(
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

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            // 下拉刷新执行“强同步”：强制击穿缓存并忽略冷却时间
            await SubscriptionService.syncGlobalSubscriptions(true);
            await SubscriptionService.autoSyncAll(true);
            await loadBanks();
            await loadReviewCount();
        } catch (e) {
            console.error('Manual refresh failed', e);
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (isFocused) {
            // 静默同步检查：仅在冷却期过后后台默默运行
            SubscriptionService.syncGlobalSubscriptions(false);
            SubscriptionService.autoSyncAll(false);

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

    const closeAllSwipeables = () => {
        swipeableRefs.current.forEach((ref) => {
            if (ref) ref.close();
        });
    };

    const handleSwipeableWillOpen = (id: number) => {
        swipeableRefs.current.forEach((ref, bankId) => {
            if (bankId !== id && ref) {
                ref.close();
            }
        });
    };

    const handleDeleteBank = async (id: number, name: string, isSubscription: boolean = false) => {
        closeSwipeable(id);

        if (isSubscription) {
            Alert.alert(
                '无法直接删除',
                `题库 "${name}" 是通过订阅获得的成果。如需删除，请前往 "添加题库 -> 在线订阅" 取消相应订阅。`,
                [{ text: '知道了' }]
            );
            return;
        }

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

    const openRenameOrRemark = (bank: QuestionBank) => {
        closeSwipeable(bank.id);
        setTargetBank(bank);

        if (bank.subscription_id) {
            setNewRemark(bank.remark || '');
            setRemarkVisible(true);
        } else {
            setNewName(bank.name);
            setRenameVisible(true);
        }
    };

    const confirmRemark = async () => {
        if (!targetBank) return;
        try {
            const db = getDB();
            await db.runAsync(
                'UPDATE question_banks SET remark = ? WHERE id = ?',
                newRemark.trim() || null,
                targetBank.id
            );
            setRemarkVisible(false);
            setTargetBank(null);
            setNewRemark('');
            loadBanks();
        } catch (e) {
            Alert.alert('错误', '保存备注失败');
        }
    };

    const openMerge = (bank: QuestionBank) => {
        closeSwipeable(bank.id);
        if (bank.subscription_id) {
            Alert.alert(
                '无法合并',
                '订阅获得的题库受系统保护，暂不支持合并操作，以维持云端同步的严谨性。',
                [{ text: '知道了' }]
            );
            return;
        }
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

    const renderRightActions = (item: QuestionBank) => {
        const isOfficial = !!item.subscription_id;

        return (
            <View style={styles.swipeActions}>
                <TouchableOpacity
                    style={[styles.swipeAction, { backgroundColor: theme.colors.tertiaryContainer }]}
                    onPress={() => openRenameOrRemark(item)}
                >
                    <IconButton icon={item.subscription_id ? "note-text-outline" : "pencil-outline"} iconColor={theme.colors.onTertiaryContainer} size={20} />
                    <Text style={{ color: theme.colors.onTertiaryContainer, fontSize: 10 }}>{item.subscription_id ? "备注" : "重命名"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.swipeAction, { backgroundColor: theme.colors.secondaryContainer }]}
                    onPress={() => handleShare(item)}
                >
                    <IconButton icon="share-variant" iconColor={theme.colors.onSecondaryContainer} size={20} />
                    <Text style={{ color: theme.colors.onSecondaryContainer, fontSize: 10 }}>分享</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.swipeAction, { backgroundColor: theme.colors.surfaceVariant }]}
                    onPress={() => {
                        closeSwipeable(item.id);
                        navigation.navigate('MasteryList', { bankId: item.id, bankName: item.name });
                    }}
                >
                    <IconButton icon="format-list-checks" iconColor={theme.colors.onSurfaceVariant} size={20} />
                    <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}>清单</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.swipeAction, { backgroundColor: isOfficial ? theme.colors.surface : theme.colors.surfaceVariant }]}
                    onPress={() => openMerge(item)}
                >
                    <IconButton icon={isOfficial ? "lock-outline" : "call-merge"} iconColor={isOfficial ? theme.colors.outline : theme.colors.onSurfaceVariant} size={20} />
                    <Text style={{ color: isOfficial ? theme.colors.outline : theme.colors.onSurfaceVariant, fontSize: 10 }}>{isOfficial ? "锁定" : "合并"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.swipeAction, { backgroundColor: isOfficial ? theme.colors.surface : theme.colors.errorContainer }]}
                    onPress={() => handleDeleteBank(item.id, item.name, isOfficial)}
                >
                    <IconButton icon={isOfficial ? "lock-reset" : "delete-outline"} iconColor={isOfficial ? theme.colors.outline : theme.colors.error} size={20} />
                    <Text style={{ color: isOfficial ? theme.colors.outline : theme.colors.error, fontSize: 10 }}>{isOfficial ? "受限" : "删除"}</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <TouchableWithoutFeedback onPress={closeAllSwipeables}>
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <FlatList
                    data={banks}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ padding: 16 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[theme.colors.primary]}
                            tintColor={theme.colors.primary}
                        />
                    }
                    ListHeaderComponent={
                        reviewCount > 0 ? (
                            <View style={[styles.modernCard, { backgroundColor: theme.colors.surface, marginBottom: 20, borderColor: theme.colors.outlineVariant, shadowColor: theme.colors.shadow, overflow: 'visible', borderWidth: 1 }]}>
                                <Pressable
                                    onPress={() => navigation.navigate('SrsReview')}
                                    style={({ pressed }) => [
                                        { flex: 1, borderRadius: 16, padding: 16 },
                                        pressed && { backgroundColor: theme.colors.onSurfaceVariant + '14' }
                                    ]}
                                >
                                    <View style={styles.headerCardContent}>
                                        <View style={styles.cardInfo}>
                                            <View style={styles.titleRow}>
                                                <Avatar.Icon size={24} icon="calendar-check" style={{ backgroundColor: theme.colors.primary, marginRight: 8 }} color={theme.colors.onPrimary} />
                                                <Text variant="titleMedium" style={[styles.bankName, { color: theme.colors.onSurface }]}>今日待复习</Text>
                                            </View>
                                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.8 }}>
                                                已有 {reviewCount} 道题目等待巩固
                                            </Text>
                                        </View>
                                        <IconButton icon="chevron-right" size={24} iconColor={theme.colors.onSurfaceVariant} />
                                    </View>
                                </Pressable>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <IconButton icon="book-off-outline" size={64} style={{ opacity: 0.2 }} iconColor={theme.colors.onSurfaceVariant} />
                            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>暂无题库，请点击右上角按钮导入。</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <Swipeable
                            activeOffsetX={[-20, 20]}
                            failOffsetY={[-30, 30]}
                            ref={ref => {
                                if (ref) swipeableRefs.current.set(item.id, ref);
                                else swipeableRefs.current.delete(item.id);
                            }}
                            onSwipeableWillOpen={() => handleSwipeableWillOpen(item.id)}
                            renderRightActions={() => renderRightActions(item)}
                        >
                            <View style={[styles.modernCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant, shadowColor: theme.colors.shadow }]}>
                                <Pressable
                                    onPress={() => navigation.navigate('QuizConfig', { bankId: item.id, bankName: item.name })}
                                    style={({ pressed }) => [
                                        { flex: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
                                        pressed && { backgroundColor: theme.colors.onSurfaceVariant + '14' }
                                    ]}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={styles.cardInfo}>
                                            <View style={styles.titleRow}>
                                                <Text variant="titleMedium" style={styles.bankName}>{item.name}</Text>
                                                {item.subscription_id ? (
                                                    <IconButton 
                                                        icon={isSyncing ? "cloud-outline" : "cloud-check-outline"} 
                                                        size={14} 
                                                        iconColor={theme.colors.primary} 
                                                        style={{ margin: 0, marginLeft: 4 }} 
                                                    />
                                                ) : null}
                                            </View>
                                            
                                            {item.remark ? (
                                                <View style={styles.remarkText}>
                                                    <IconButton icon="bookmark-outline" size={12} iconColor={theme.colors.outline} style={{ margin: 0, width: 14, height: 14 }} />
                                                    <Text variant="labelSmall" style={{ color: theme.colors.outline }}>{item.remark}</Text>
                                                </View>
                                            ) : null}

                                            <Text variant="bodySmall" style={[styles.syncTime, { color: theme.colors.onSurfaceVariant }]}>
                                                {item.description && item.description.match(/^\d{4}-\d{2}-\d{2}T/)
                                                    ? getSyncDescription(item.description)
                                                    : (item.description || '本地创建')}
                                            </Text>
                                        </View>

                                        <View style={styles.cardBadges}>
                                            {item.due_count! > 0 && (
                                                <View style={[styles.modernBadge, { backgroundColor: theme.colors.primary }]}>
                                                    <IconButton icon="clock-outline" size={14} iconColor={theme.colors.onPrimary} style={{ margin: 0, padding: 0, width: 14, height: 14 }} />
                                                    <Text style={[styles.modernBadgeText, { color: theme.colors.onPrimary }]}>{item.due_count}</Text>
                                                </View>
                                            )}
                                            {item.mistake_count! > 0 && (
                                                <View style={[styles.modernBadge, { backgroundColor: theme.colors.error }]}>
                                                    <IconButton icon="alert-circle-outline" size={14} iconColor={theme.colors.onError} style={{ margin: 0, padding: 0, width: 14, height: 14 }} />
                                                    <Text style={[styles.modernBadgeText, { color: theme.colors.onError }]}>{item.mistake_count}</Text>
                                                </View>
                                            )}
                                            <IconButton icon="chevron-right" size={20} iconColor={theme.colors.outlineVariant} style={{ marginRight: -8 }} />
                                        </View>
                                    </View>
                                </Pressable>
                            </View>
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
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
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
                                        { borderBottomColor: theme.colors.outlineVariant },
                                        item.id === mergeTargetId && { backgroundColor: theme.colors.secondaryContainer }
                                    ]}
                                    onPress={() => setMergeTargetId(item.id)}
                                >
                                    <Text style={{ color: item.id === mergeTargetId ? theme.colors.onSecondaryContainer : theme.colors.onSurface }}>
                                        {item.name}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={{ padding: 10, color: theme.colors.onSurfaceVariant }}>无其他题库可选</Text>}
                        />
                        <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 16 }}>
                            注意：合并后原题库 "{targetBank?.name}" 将被删除。
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                            <Button onPress={() => setMergeVisible(false)}>取消</Button>
                            <Button mode="contained" onPress={confirmMerge} disabled={!mergeTargetId} style={{ marginLeft: 8 }}>合并</Button>
                        </View>
                    </Modal>

                    <Modal visible={remarkVisible} onDismiss={() => setRenameVisible(false)} contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                        <Text variant="titleMedium" style={{ marginBottom: 8 }}>备注订阅题库</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
                            订阅题库名称由订阅源控制，建议通过备注来区分。
                        </Text>
                        {targetBank && (
                            <Text variant="bodyMedium" style={{ marginBottom: 16, fontWeight: 'bold' }}>
                                {targetBank.name}
                            </Text>
                        )}
                        <TextInput
                            label="备注（可选）"
                            value={newRemark}
                            onChangeText={setNewRemark}
                            placeholder="添加您的备注"
                            mode="outlined"
                            style={{ marginBottom: 16 }}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                            <Button onPress={() => setRemarkVisible(false)}>取消</Button>
                            <Button mode="contained" onPress={confirmRemark}>保存</Button>
                        </View>
                    </Modal>
                </Portal>
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    emptyContainer: { alignItems: 'center', marginTop: 100, opacity: 0.5 },
    reviewCard: { marginBottom: 20, borderRadius: 16, overflow: 'hidden' },

    modernCard: {
        marginBottom: 12,
        borderRadius: 20,
        padding: 0,
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        minHeight: 70,
        overflow: 'hidden',
    },
    headerCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flex: 1,
    },
    cardInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    bankName: {
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: -0.2,
    },
    remarkText: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    syncTime: {
        fontSize: 10,
        opacity: 0.6,
    },
    cardBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    modernBadge: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        minWidth: 40,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    modernBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
        lineHeight: 14,
    },

    swipeActions: {
        width: 250,
        marginBottom: 16,
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
    }
});
