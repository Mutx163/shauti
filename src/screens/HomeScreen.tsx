import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, useTheme, IconButton, Avatar, Portal, Modal, TextInput, Button, Menu } from 'react-native-paper'; // Added Menu for 'More' options if needed, but using Action Sheet logic via simple Buttons for now inside a Modal or just direct buttons. Actually I'll use a local state for modals.
import { Text as NativeText } from 'react-native'; // fallback if needed
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { getDB, QuestionBank } from '../db/database';
import { Swipeable } from 'react-native-gesture-handler';

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const theme = useTheme();
    const [banks, setBanks] = useState<QuestionBank[]>([]);

    // Rename State
    const [renameVisible, setRenameVisible] = useState(false);
    const [targetBank, setTargetBank] = useState<QuestionBank | null>(null);
    const [newName, setNewName] = useState('');

    // Merge State
    const [mergeVisible, setMergeVisible] = useState(false);
    const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
    // targetBank is the SOURCE bank to be merged. mergeTargetId is the DESTINATION bank id.

    const loadBanks = async () => {
        try {
            const db = getDB();
            const result = await db.getAllAsync<QuestionBank>('SELECT * FROM question_banks ORDER BY created_at DESC');
            setBanks(result);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        if (isFocused) {
            loadBanks();
        }
    }, [isFocused]);

    const handleDeleteBank = async (id: number, name: string) => {
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

    const openRename = (bank: QuestionBank) => {
        setTargetBank(bank);
        setNewName(bank.name);
        setRenameVisible(true);
    };

    const openMerge = (bank: QuestionBank) => {
        setTargetBank(bank); // This is the source bank
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
            // Move questions
            await db.runAsync('UPDATE questions SET bank_id = ? WHERE bank_id = ?', mergeTargetId, targetBank.id);
            // Delete source bank
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
                ListHeaderComponent={null}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text variant="bodyLarge">暂无题库，请点击右上角按钮导入。</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <Swipeable renderRightActions={() => renderRightActions(item)}>
                        <Card
                            style={styles.card}
                            onPress={() => navigation.navigate('QuizConfig', { bankId: item.id, bankName: item.name })}
                            mode="elevated"
                        >
                            <Card.Title
                                title={item.name}
                                subtitle={item.description || '左滑更多操作'}
                                titleVariant="titleMedium"
                                subtitleVariant="bodySmall"
                                right={(props) => (
                                    <IconButton {...props} icon="chevron-right" />
                                )}
                            />
                        </Card>
                    </Swipeable>
                )}
            />
            <Portal>
                {/* Rename Modal */}
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

                {/* Merge Modal */}
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
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    card: { marginBottom: 12, borderRadius: 12 },
    swipeActions: {
        width: 250, // Increased width for 4 actions
        marginBottom: 12,
        flexDirection: 'row',
    },
    swipeAction: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 0,
        marginLeft: 0,
    },
    modalContent: {
        margin: 20,
        padding: 24,
        borderRadius: 28,
        backgroundColor: 'white',
    },
    bankOption: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    }
});
