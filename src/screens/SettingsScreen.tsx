import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, RadioButton, Divider, Button, useTheme, Portal, Modal, Switch } from 'react-native-paper';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { getDB } from '../db/database';
import { SettingsManager, AutoSkipMode } from '../utils/settings';

export default function SettingsScreen() {
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const theme = useTheme();

    const [autoSkipMode, setAutoSkipMode] = useState<AutoSkipMode>('off');
    const [autoRemoveMistake, setAutoRemoveMistake] = useState(true);
    const [mistakeCount, setMistakeCount] = useState(0);
    const [showSkipModal, setShowSkipModal] = useState(false);

    useEffect(() => {
        if (isFocused) {
            loadSettings();
            loadMistakeCount();
        }
    }, [isFocused]);

    const loadSettings = async () => {
        const mode = await SettingsManager.getAutoSkipMode();
        const remove = await SettingsManager.getAutoRemoveMistake();
        setAutoSkipMode(mode);
        setAutoRemoveMistake(remove);
    };

    const loadMistakeCount = async () => {
        try {
            const db = getDB();
            const result = await db.getAllAsync<{ count: number }>('SELECT COUNT(DISTINCT question_id) as count FROM user_progress WHERE is_correct = 0');
            setMistakeCount(result[0]?.count || 0);
        } catch (error) {
            console.error('Failed to load mistake count:', error);
        }
    };

    const handleAutoSkipChange = async (mode: AutoSkipMode) => {
        setAutoSkipMode(mode);
        await SettingsManager.setAutoSkipMode(mode);
    };

    const handleAutoRemoveChange = async (value: boolean) => {
        setAutoRemoveMistake(value);
        await SettingsManager.setAutoRemoveMistake(value);
    };

    const skipModes = [
        { value: 'off', label: '关闭', desc: '手动点击下一题' },
        { value: 'correct_only', label: '答对立刻跳', desc: '答错时停留查看' },
        { value: '1s', label: '延迟 1 秒', desc: '答题后 1 秒自动跳转' },
        { value: '2s', label: '延迟 2 秒', desc: '答题后 2 秒自动跳转' },
        { value: '3s', label: '延迟 3 秒', desc: '答题后 3 秒自动跳转' },
    ];

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>
                {/* 错题管理 */}
                <Card style={styles.card} mode="elevated">
                    <Card.Content>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text variant="titleMedium">错题管理</Text>
                                <Text variant="bodySmall" style={{ color: 'gray', marginTop: 4 }}>当前错题：{mistakeCount} 题</Text>
                            </View>
                            <Button
                                mode="contained-tonal"
                                onPress={() => navigation.navigate('Quiz', { mode: 'mistake' })}
                                disabled={mistakeCount === 0}
                            >
                                查看错题
                            </Button>
                        </View>
                        <Divider style={{ marginVertical: 12 }} />
                        <View style={styles.settingRow}>
                            <View style={{ flex: 1 }}>
                                <Text variant="bodyMedium">答对后自动移除</Text>
                                <Text variant="bodySmall" style={{ color: 'gray', marginTop: 2 }}>
                                    在错题本中答对题目后，将其标记为已掌握
                                </Text>
                            </View>
                            <Switch
                                value={autoRemoveMistake}
                                onValueChange={handleAutoRemoveChange}
                            />
                        </View>
                    </Card.Content>
                </Card>

                {/* 在线题库订阅 */}
                <Card style={styles.card} mode="elevated">
                    <Card.Content>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flex: 1, marginRight: 16 }}>
                                <Text variant="titleMedium">在线题库订阅</Text>
                                <Text variant="bodySmall" style={{ color: 'gray', marginTop: 4 }}>
                                    订阅远程题库链接，自动获取最新题目更新
                                </Text>
                            </View>
                            <Button
                                mode="contained"
                                onPress={() => navigation.navigate('Subscription')}
                                icon="rss"
                            >
                                管理订阅
                            </Button>
                        </View>
                    </Card.Content>
                </Card>

                {/* 刷题设置 */}
                <Card style={styles.card} mode="elevated">
                    <Card.Content>
                        <Text variant="titleMedium" style={{ marginBottom: 8 }}>刷题设置</Text>
                        <View style={styles.settingRow}>
                            <View style={{ flex: 1 }}>
                                <Text variant="bodyMedium">自动跳题</Text>
                                <Text variant="bodySmall" style={{ color: 'gray', marginTop: 2 }}>
                                    {skipModes.find(m => m.value === autoSkipMode)?.label}
                                </Text>
                            </View>
                            <Button
                                mode="outlined"
                                onPress={() => setShowSkipModal(true)}
                                compact
                            >
                                修改
                            </Button>
                        </View>
                    </Card.Content>
                </Card>
            </View>

            {/* 自动跳题选择弹窗 */}
            <Portal>
                <Modal
                    visible={showSkipModal}
                    onDismiss={() => setShowSkipModal(false)}
                    contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
                >
                    <Text variant="titleMedium" style={{ marginBottom: 16 }}>选择自动跳题模式</Text>
                    <ScrollView style={{ maxHeight: 400 }}>
                        <RadioButton.Group onValueChange={(value) => {
                            handleAutoSkipChange(value as AutoSkipMode);
                            setShowSkipModal(false);
                        }} value={autoSkipMode}>
                            {skipModes.map((mode) => (
                                <View key={mode.value}>
                                    <RadioButton.Item
                                        label={mode.label}
                                        value={mode.value}
                                        style={styles.radioItem}
                                    />
                                    <Text variant="bodySmall" style={{ marginLeft: 56, marginTop: -8, marginBottom: 8, color: 'gray' }}>
                                        {mode.desc}
                                    </Text>
                                </View>
                            ))}
                        </RadioButton.Group>
                    </ScrollView>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                        <Button mode="text" onPress={() => setShowSkipModal(false)}>
                            取消
                        </Button>
                    </View>
                </Modal>
            </Portal>
        </ScrollView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16 },
    card: { marginBottom: 16, borderRadius: 12 },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    radioItem: { paddingVertical: 4 },
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    modalContent: {
        margin: 20,
        padding: 24,
        borderRadius: 28, // Material 3 uses larger border radius for dialogues
        backgroundColor: 'white',
        minWidth: 280,
    },
});
