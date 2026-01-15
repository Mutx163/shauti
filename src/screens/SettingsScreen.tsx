import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, RadioButton, Divider, Button, useTheme, Portal, Modal, Switch, List, IconButton } from 'react-native-paper';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { getDB } from '../db/database';
import { SettingsManager, AutoSkipMode, ThemeMode } from '../utils/settings';
import { useAppTheme } from '../theme/ThemeContext';

export default function SettingsScreen() {
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const theme = useTheme();

    const { themeMode, setThemeMode, seedColor, setSeedColor } = useAppTheme();
    const [autoSkipMode, setAutoSkipMode] = useState<AutoSkipMode>('off');
    const [autoRemoveMistake, setAutoRemoveMistake] = useState(true);
    const [mistakeCount, setMistakeCount] = useState(0);
    const [showSkipModal, setShowSkipModal] = useState(false);
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [showColorModal, setShowColorModal] = useState(false);

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
                {/* 核心引擎：错题与复习策略 */}
                <List.Section>
                    <List.Subheader style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>核心引擎</List.Subheader>
                    <Card style={styles.card} mode="outlined">
                        <List.Item
                            title="错题管理"
                            titleStyle={{ fontWeight: '600' }}
                            description={`当前积压：${mistakeCount} 题`}
                            left={props => <View style={{ backgroundColor: '#FFF5F5', padding: 8, borderRadius: 10, alignSelf: 'center', marginLeft: 12 }}>
                                <List.Icon {...props} icon="shield-alert-outline" color="#FF3B30" style={{ margin: 0 }} />
                            </View>}
                            right={() => (
                                <Button
                                    mode="contained"
                                    onPress={() => navigation.navigate('Quiz', { mode: 'mistake' })}
                                    disabled={mistakeCount === 0}
                                    style={{ alignSelf: 'center', marginRight: 8, borderRadius: 8 }}
                                    labelStyle={{ fontSize: 12, fontWeight: 'bold' }}
                                    compact
                                >
                                    立即处理
                                </Button>
                            )}
                        />
                        <Divider horizontalInset style={{ backgroundColor: '#F2F2F7' }} />
                        <List.Item
                            title="自动出库策略"
                            titleStyle={{ fontWeight: '600' }}
                            description="答对后自动从错题本移除"
                            left={props => <View style={{ backgroundColor: theme.colors.primary + '10', padding: 8, borderRadius: 10, alignSelf: 'center', marginLeft: 12 }}>
                                <List.Icon {...props} icon="auto-fix" color={theme.colors.primary} style={{ margin: 0 }} />
                            </View>}
                            right={() => (
                                <Switch
                                    value={autoRemoveMistake}
                                    onValueChange={handleAutoRemoveChange}
                                    style={{ transform: [{ scale: 0.85 }] }}
                                />
                            )}
                        />
                    </Card>
                </List.Section>

                {/* 内容获取：订阅系统 */}
                <List.Section>
                    <List.Subheader style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>内容获取</List.Subheader>
                    <Card style={styles.card} mode="outlined">
                        <List.Item
                            title="在线题库订阅"
                            titleStyle={{ fontWeight: '600' }}
                            description="自动同步云端最新题库资源"
                            left={props => <View style={{ backgroundColor: theme.colors.secondary + '10', padding: 8, borderRadius: 10, alignSelf: 'center', marginLeft: 12 }}>
                                <List.Icon {...props} icon="rss-box" color={theme.colors.secondary} style={{ margin: 0 }} />
                            </View>}
                            right={() => (
                                <Button
                                    mode="outlined"
                                    onPress={() => navigation.navigate('AddBank', { screen: 'OnlineSubscription' })}
                                    style={{ alignSelf: 'center', marginRight: 8, borderRadius: 8, borderColor: '#E5E5EA' }}
                                    labelStyle={{ fontSize: 12, fontWeight: 'bold' }}
                                    compact
                                >
                                    管理
                                </Button>
                            )}
                        />
                    </Card>
                </List.Section>

                {/* 交互体验：个性化定制 */}
                <List.Section>
                    <List.Subheader style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>交互体验</List.Subheader>
                    <Card style={styles.card} mode="outlined">
                        <List.Item
                            title="显示模式"
                            titleStyle={{ fontWeight: '600' }}
                            description={
                                themeMode === 'system' ? '智能跟随系统' :
                                    themeMode === 'light' ? '明亮模式' :
                                        themeMode === 'dark' ? '深邃模式' : '舒适护眼模式'
                            }
                            left={props => <View style={{ backgroundColor: theme.colors.tertiary + '10', padding: 8, borderRadius: 10, alignSelf: 'center', marginLeft: 12 }}>
                                <List.Icon {...props} icon="palette-outline" color={theme.colors.tertiary} style={{ margin: 0 }} />
                            </View>}
                            onPress={() => setShowThemeModal(true)}
                            right={props => <List.Icon {...props} icon="chevron-right" color="#C7C7CC" />}
                        />
                        <Divider horizontalInset style={{ backgroundColor: '#F2F2F7' }} />
                        <List.Item
                            title="全局主题色"
                            titleStyle={{ fontWeight: '600' }}
                            description="自定义视觉基调"
                            left={props => <View style={{ backgroundColor: seedColor + '15', padding: 8, borderRadius: 10, alignSelf: 'center', marginLeft: 12 }}>
                                <List.Icon {...props} icon="format-color-fill" color={seedColor} style={{ margin: 0 }} />
                            </View>}
                            onPress={() => setShowColorModal(true)}
                            right={() => (
                                <View style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 9,
                                    backgroundColor: seedColor,
                                    alignSelf: 'center',
                                    marginRight: 12,
                                    borderWidth: 1,
                                    borderColor: 'rgba(0,0,0,0.05)'
                                }} />
                            )}
                        />
                        <Divider horizontalInset style={{ backgroundColor: '#F2F2F7' }} />
                        <List.Item
                            title="自动化流程"
                            titleStyle={{ fontWeight: '600' }}
                            description={`${skipModes.find(m => m.value === autoSkipMode)?.label}`}
                            left={props => <View style={{ backgroundColor: theme.colors.primary + '10', padding: 8, borderRadius: 10, alignSelf: 'center', marginLeft: 12 }}>
                                <List.Icon {...props} icon="robot-outline" color={theme.colors.primary} style={{ margin: 0 }} />
                            </View>}
                            onPress={() => setShowSkipModal(true)}
                            right={props => <List.Icon {...props} icon="chevron-right" color="#C7C7CC" />}
                        />
                    </Card>
                </List.Section>
            </View>

            {/* 主题色选择弹窗 */}
            <Portal>
                <Modal
                    visible={showColorModal}
                    onDismiss={() => setShowColorModal(false)}
                    contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
                >
                    <Text variant="titleMedium" style={{ marginBottom: 16 }}>选择应用主题色</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
                        {[
                            '#6750A4', // Purple (Default)
                            '#006A6A', // Teal
                            '#3F51B5', // Indigo
                            '#2196F3', // Blue
                            '#4CAF50', // Green
                            '#FF9800', // Orange
                            '#F44336', // Red
                            '#E91E63', // Pink
                            '#795548', // Brown
                            '#607D8B', // Blue Grey
                        ].map((color) => (
                            <TouchableOpacity
                                key={color}
                                onPress={() => {
                                    setSeedColor(color);
                                    setShowColorModal(false);
                                }}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 24,
                                    backgroundColor: color,
                                    borderWidth: seedColor === color ? 3 : 1,
                                    borderColor: seedColor === color ? theme.colors.onSurface : theme.colors.outlineVariant,
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                {seedColor === color && (
                                    <IconButton icon="check" iconColor="#FFFFFF" size={24} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                        <Button mode="text" onPress={() => setShowColorModal(false)}>
                            取消
                        </Button>
                    </View>
                </Modal>
            </Portal>

            {/* 主题选择弹窗 */}
            <Portal>
                <Modal
                    visible={showThemeModal}
                    onDismiss={() => setShowThemeModal(false)}
                    contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
                >
                    <Text variant="titleMedium" style={{ marginBottom: 16 }}>选择显示主题</Text>
                    <RadioButton.Group onValueChange={(value) => {
                        setThemeMode(value as ThemeMode);
                        setShowThemeModal(false);
                    }} value={themeMode}>
                        <RadioButton.Item label="跟随系统" value="system" />
                        <RadioButton.Item label="浅色模式" value="light" />
                        <RadioButton.Item label="深色模式" value="dark" />
                        <RadioButton.Item label="护眼模式" value="eye" />
                    </RadioButton.Group>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                        <Button mode="text" onPress={() => setShowThemeModal(false)}>
                            取消
                        </Button>
                    </View>
                </Modal>
            </Portal>

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
                                    <Text variant="bodySmall" style={{ marginLeft: 56, marginTop: -8, marginBottom: 8, color: theme.colors.onSurfaceVariant }}>
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
    content: { padding: 8, paddingHorizontal: 12 },
    card: {
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E5EA',
        overflow: 'hidden',
    },
    radioItem: { paddingVertical: 4 },
    modalContent: {
        margin: 24,
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E5E5EA',
    },
});
