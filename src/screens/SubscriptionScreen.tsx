import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, Card, FAB, Portal, Dialog, TextInput, Button, IconButton, useTheme, ActivityIndicator, Switch } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SubscriptionService } from '../services/SubscriptionService';

export default function SubscriptionScreen() {
    const theme = useTheme();
    const navigation = useNavigation();
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [url, setUrl] = useState('');
    const [name, setName] = useState('');
    const [syncingId, setSyncingId] = useState<number | null>(null);

    const loadSubscriptions = useCallback(async () => {
        try {
            const list = await SubscriptionService.getSubscriptions();
            setSubscriptions(list);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const handleToggleAuto = async (id: number, currentValue: boolean) => {
        try {
            // Optimistic update
            setSubscriptions(prev => prev.map(item => item.id === id ? { ...item, auto_update: !currentValue } : item));
            await SubscriptionService.toggleAutoUpdate(id, !currentValue);
        } catch (e) {
            console.error(e);
            loadSubscriptions(); // Revert on error
        }
    };

    useEffect(() => {
        loadSubscriptions();
    }, [loadSubscriptions]);

    const handleAdd = async () => {
        if (!url) {
            Alert.alert('错误', '请输入链接');
            return;
        }
        setLoading(true);
        try {
            await SubscriptionService.addSubscription(url, name);
            setDialogVisible(false);
            setUrl('');
            setName('');
            loadSubscriptions();
            Alert.alert('成功', '订阅添加并同步成功');
        } catch (e: any) {
            Alert.alert('添加失败', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async (id: number) => {
        setSyncingId(id);
        try {
            await SubscriptionService.syncSubscription(id);
            loadSubscriptions();
            Alert.alert('同步成功', '题库已更新到最新版本');
        } catch (e: any) {
            Alert.alert('同步失败', e.message);
        } finally {
            setSyncingId(null);
        }
    };

    const handleDelete = (item: any) => {
        Alert.alert('确认取消订阅', `这将删除订阅 "${item.name}" 及其所有关联题库。删除后无法恢复。`, [
            { text: '取消', style: 'cancel' },
            {
                text: '删除',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await SubscriptionService.deleteSubscription(item.id);
                        loadSubscriptions();
                    } catch (e: any) {
                        Alert.alert('删除失败', e.message);
                    }
                }
            }
        ]);
    };

    const renderItem = ({ item }: { item: any }) => (
        <Card style={styles.card} mode="elevated">
            <Card.Content>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{item.name || '未命名订阅'}</Text>
                        <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.outline, marginTop: 4 }}>
                            {item.url}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.secondary, marginTop: 4 }}>
                            上次更新: {new Date(item.last_updated).toLocaleString()}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                            <Switch
                                value={!!item.auto_update}
                                onValueChange={() => handleToggleAuto(item.id, !!item.auto_update)}
                                color={theme.colors.primary}
                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            />
                            <Text variant="labelSmall" style={{ marginLeft: 4, color: theme.colors.outline }}>
                                {item.auto_update ? '自动更新' : '手动更新'}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.actions}>
                        <IconButton
                            icon={syncingId === item.id ? "loading" : "sync"}
                            mode="contained-tonal"
                            onPress={() => !syncingId && handleSync(item.id)}
                            disabled={syncingId !== null}
                            loading={syncingId === item.id}
                        />
                        <IconButton
                            icon="delete-outline"
                            mode="contained-tonal"
                            iconColor={theme.colors.error}
                            onPress={() => handleDelete(item)}
                            disabled={syncingId !== null}
                        />
                    </View>
                </View>
            </Card.Content>
        </Card>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {subscriptions.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <IconButton icon="rss" size={64} iconColor={theme.colors.surfaceVariant} />
                    <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>暂无订阅</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 8 }}>
                        点击右下角按钮添加题库订阅
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={subscriptions}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                />
            )}

            <FAB
                icon="plus"
                label="添加订阅"
                style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                color={theme.colors.onPrimary}
                onPress={() => setDialogVisible(true)}
            />

            <Portal>
                <Dialog visible={dialogVisible} onDismiss={() => !loading && setDialogVisible(false)}>
                    <Dialog.Title>添加题库订阅</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="订阅链接 (URL)"
                            value={url}
                            onChangeText={setUrl}
                            mode="outlined"
                            style={{ marginBottom: 12 }}
                            autoCapitalize="none"
                            keyboardType="url"
                        />
                        <TextInput
                            label="订阅名称 (可选)"
                            value={name}
                            onChangeText={setName}
                            mode="outlined"
                            placeholder="如果不填，将使用文件中的名称"
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setDialogVisible(false)} disabled={loading}>取消</Button>
                        <Button onPress={handleAdd} loading={loading} disabled={loading}>添加</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    listContent: { padding: 16, paddingBottom: 80 },
    card: { marginBottom: 12, borderRadius: 12 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    actions: { flexDirection: 'row', alignItems: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.7 },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
});
