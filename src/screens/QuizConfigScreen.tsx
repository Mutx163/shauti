import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, RadioButton, Card, useTheme, Divider, IconButton, Avatar } from 'react-native-paper';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import { getDB } from '../db/database';

export default function QuizConfigScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const theme = useTheme();
    const isFocused = useIsFocused();
    const { bankId, bankName } = route.params;

    const [selectedType, setSelectedType] = useState('all');
    const [selectedMode, setSelectedMode] = useState('practice'); // practice or study

    const [stats, setStats] = useState({
        total: 0,
        due: 0,
        mistakes: 0
    });

    const questionTypes = [
        { value: 'all', label: '全部题型', icon: 'all-inclusive' },
        { value: 'single', label: '单选题', icon: 'checkbox-marked-circle-outline' },
        { value: 'multi', label: '多选题', icon: 'checkbox-multiple-marked-outline' },
        { value: 'true_false', label: '判断题', icon: 'circle-edit-outline' },
        { value: 'fill', label: '填空题', icon: 'form-textbox' },
        { value: 'short', label: '简答题', icon: 'text-short' },
    ];

    useEffect(() => {
        if (isFocused) {
            loadBankStats();
        }
    }, [isFocused]);

    const loadBankStats = async () => {
        try {
            const db = getDB();

            // 1. Total
            const totalRes: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM questions WHERE bank_id = ?', bankId);

            // 2. Due
            const dueRes: any = await db.getFirstAsync(`
                SELECT COUNT(*) as count 
                FROM questions q 
                JOIN question_mastery qm ON q.id = qm.question_id 
                WHERE q.bank_id = ? AND datetime(qm.next_review_time, 'localtime') <= datetime('now', 'localtime')
            `, bankId);

            // 3. Mistakes
            const mistakeRes: any = await db.getFirstAsync(`
                SELECT COUNT(*) as count FROM questions q
                WHERE q.bank_id = ? AND EXISTS (
                    SELECT 1 FROM user_progress up 
                    WHERE up.question_id = q.id 
                    AND up.id = (SELECT id FROM user_progress WHERE question_id = q.id ORDER BY timestamp DESC LIMIT 1)
                    AND up.is_correct = 0
                )
            `, bankId);

            setStats({
                total: totalRes?.count || 0,
                due: dueRes?.count || 0,
                mistakes: mistakeRes?.count || 0
            });
        } catch (e) {
            console.error(e);
        }
    };

    const handleStart = () => {
        navigation.navigate('Quiz', {
            bankId,
            bankName,
            mode: 'bank',
            questionType: selectedType,
            quizMode: selectedMode,
        });
    };

    const QuickStat = ({ label, count, color, icon, onPress }: any) => (
        <Card style={[styles.statItem, { flex: 1 }]} mode="contained" onPress={onPress}>
            <Card.Content style={styles.statContent}>
                <IconButton icon={icon} iconColor={color} size={20} style={{ margin: 0 }} />
                <Text variant="titleLarge" style={{ color: color, fontWeight: 'bold' }}>{count}</Text>
                <Text variant="labelSmall" style={{ opacity: 0.6 }}>{label}</Text>
            </Card.Content>
        </Card>
    );

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>
                {/* Bank Header Info */}
                <View style={styles.header}>
                    <Text variant="headlineSmall" style={styles.bankTitle}>{bankName}</Text>
                    <View style={styles.statsRow}>
                        <QuickStat
                            label="总题目"
                            count={stats.total}
                            color={theme.colors.primary}
                            icon="database"
                        />
                        <QuickStat
                            label="待复习"
                            count={stats.due}
                            color="#FF9800"
                            icon="calendar-clock"
                            onPress={() => stats.due > 0 && navigation.navigate('Quiz', { mode: 'review', bankId, bankName })}
                        />
                        <QuickStat
                            label="错题本"
                            count={stats.mistakes}
                            color={theme.colors.error}
                            icon="alert-octagon"
                            onPress={() => stats.mistakes > 0 && navigation.navigate('Quiz', { mode: 'mistake', bankId, bankName })}
                        />
                    </View>
                </View>

                {/* Mode Selection */}
                <Text variant="titleMedium" style={styles.sectionTitle}>选择学习模式</Text>
                <View style={styles.modeRow}>
                    <TouchableOpacity
                        style={[styles.modeCard, selectedMode === 'study' && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryContainer }]}
                        onPress={() => setSelectedMode('study')}
                    >
                        <Avatar.Icon size={40} icon="book-open-variant" style={{ backgroundColor: selectedMode === 'study' ? theme.colors.primary : '#eee' }} />
                        <Text variant="titleSmall" style={{ marginTop: 8, fontWeight: 'bold' }}>背题模式</Text>
                        <Text variant="bodySmall" numberOfLines={1} style={{ opacity: 0.6 }}>顺序学习，查看答案</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.modeCard, selectedMode === 'practice' && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryContainer }]}
                        onPress={() => setSelectedMode('practice')}
                    >
                        <Avatar.Icon size={40} icon="sword-cross" style={{ backgroundColor: selectedMode === 'practice' ? theme.colors.primary : '#eee' }} />
                        <Text variant="titleSmall" style={{ marginTop: 8, fontWeight: 'bold' }}>刷题模式</Text>
                        <Text variant="bodySmall" numberOfLines={1} style={{ opacity: 0.6 }}>随机挑战，即时反馈</Text>
                    </TouchableOpacity>
                </View>

                {/* Question Type */}
                <Card style={styles.card} mode="outlined">
                    <Card.Content>
                        <Text variant="titleMedium" style={{ marginBottom: 12, fontWeight: 'bold' }}>题型过滤</Text>
                        <View style={styles.typeGrid}>
                            {questionTypes.map((type) => (
                                <TouchableOpacity
                                    key={type.value}
                                    style={[
                                        styles.typeButton,
                                        selectedType === type.value && { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary }
                                    ]}
                                    onPress={() => setSelectedType(type.value)}
                                >
                                    <IconButton icon={type.icon} size={20} iconColor={selectedType === type.value ? theme.colors.primary : '#666'} />
                                    <Text variant="labelMedium" style={{ color: selectedType === type.value ? theme.colors.primary : '#666' }}>{type.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Card.Content>
                </Card>

                <Button
                    mode="contained"
                    onPress={handleStart}
                    style={styles.startButton}
                    contentStyle={{ height: 56 }}
                    labelStyle={{ fontSize: 18, fontWeight: 'bold' }}
                    icon="play-circle"
                >
                    开启学习之旅
                </Button>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16 },
    header: { marginBottom: 24 },
    bankTitle: { fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
    statsRow: { flexDirection: 'row', gap: 8 },
    statItem: { borderRadius: 12 },
    statContent: { alignItems: 'center', paddingVertical: 12 },
    sectionTitle: { fontWeight: 'bold', marginBottom: 12, marginLeft: 4 },
    modeRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    modeCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'transparent',
        backgroundColor: '#f8f8f8',
        alignItems: 'center'
    },
    card: { marginBottom: 20, borderRadius: 16 },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeButton: {
        width: '31.5%',
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
        backgroundColor: '#fff'
    },
    startButton: { marginTop: 10, borderRadius: 16, elevation: 4 },
});
