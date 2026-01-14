import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, RadioButton, Card, useTheme, Divider, IconButton, Portal, Modal, TextInput, Menu } from 'react-native-paper';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDB } from '../db/database';

export default function QuizConfigScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const theme = useTheme();
    const isFocused = useIsFocused();
    const insets = useSafeAreaInsets();
    const { bankId, bankName: initialBankName } = route.params;

    // 状态颜色逻辑
    const dueColor = theme.colors.primary === '#006D3A' 
        ? '#FFD54F' // 护眼模式下使用琥珀色表示待复习
        : (theme.dark ? '#FFB74D' : '#F57C00');
    
    // 统一成功颜色逻辑 (护眼模式使用柔和绿色，其他模式使用主题主色)
    const successColor = theme.colors.primary === '#006D3A' 
        ? '#4CAF50' 
        : theme.colors.primary;

    const [bankName, setBankName] = useState(initialBankName || '题库');
    const [selectedType, setSelectedType] = useState('all');
    const [examModalVisible, setExamModalVisible] = useState(false);
    const [resetModalVisible, setResetModalVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [examQuestionCount, setExamQuestionCount] = useState('30');

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

    const [hasSession, setHasSession] = useState<{ study: boolean, practice: boolean }>({ study: false, practice: false });

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <IconButton
                    icon="refresh"
                    onPress={() => setResetModalVisible(true)}
                />
            ),
        });
    }, [navigation]);

    useEffect(() => {
        if (isFocused) {
            loadBankStats();
            checkSessions();
        }
    }, [isFocused]);

    const checkSessions = async () => {
        try {
            const db = getDB();
            const study: any = await db.getFirstAsync('SELECT 1 FROM quiz_sessions WHERE bank_id = ? AND quiz_mode = ?', bankId, 'study');
            const practice: any = await db.getFirstAsync('SELECT 1 FROM quiz_sessions WHERE bank_id = ? AND quiz_mode = ?', bankId, 'practice');
            setHasSession({ study: !!study, practice: !!practice });
        } catch (e) { console.error(e); }
    };

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

    const handleStart = (mode: 'study' | 'practice') => {
        navigation.navigate('Quiz', {
            bankId,
            bankName,
            mode: 'bank',
            questionType: selectedType,
            quizMode: mode,
        });
    };

    const handleStartExam = () => {
        setExamModalVisible(true);
    };

    const confirmStartExam = () => {
        const count = parseInt(examQuestionCount) || 30;
        setExamModalVisible(false);
        navigation.navigate('MockExam', {
            bankIds: [bankId],
            count: Math.min(stats.total, count),
            duration: count * 60, // 1 minute per question as default
        });
    };

    const handleResetProgress = async () => {
        try {
            const db = getDB();
            
            // 1. 将所有已背过的题目的下次复习时间设置为现在（使其进入待复习队列）
            // 这样既保留了记忆等级，又让用户可以立即重新复习所有题目
            await db.runAsync(`
                UPDATE question_mastery 
                SET next_review_time = datetime('now', 'localtime')
                WHERE question_id IN (SELECT id FROM questions WHERE bank_id = ?)
            `, bankId);

            // 2. 删除该题库的刷题进度会话（重置背题/刷题的进度位置）
            await db.runAsync('DELETE FROM quiz_sessions WHERE bank_id = ?', bankId);

            setResetModalVisible(false);
            loadBankStats();
            checkSessions();
        } catch (e) {
            console.error('Failed to reset progress:', e);
        }
    };

    const QuickStat = ({ label, count, color, icon, onPress }: any) => (
        <Card style={[styles.statItem, { flex: 1, shadowColor: theme.colors.shadow }]} mode="contained" onPress={onPress}>
            <Card.Content style={styles.statContent}>
                <IconButton icon={icon} iconColor={color} size={20} style={{ margin: 0 }} />
                <Text variant="titleLarge" style={{ color: color, fontWeight: 'bold' }}>{count}</Text>
                <Text variant="labelSmall" style={{ opacity: 0.6 }}>{label}</Text>
            </Card.Content>
        </Card>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text variant="headlineMedium" style={[styles.bankTitle, { color: theme.colors.primary }]}>{bankName}</Text>

                    <View style={styles.statsRow}>
                            <QuickStat
                                label="总题目"
                                count={stats.total}
                                icon="book-multiple"
                                color={theme.colors.primary}
                                onPress={() => navigation.navigate('MasteryList', { bankId, bankName })}
                            />
                            <QuickStat
                                label="待复习"
                                count={stats.due}
                                icon="calendar-clock"
                                color={dueColor}
                                onPress={() => stats.due > 0 && navigation.navigate('Quiz', { mode: 'review', bankId, bankName })}
                            />
                            <QuickStat
                                label="错题本"
                                count={stats.mistakes}
                                icon="alert-octagon"
                                color={theme.colors.error}
                                onPress={() => stats.mistakes > 0 && navigation.navigate('Quiz', { mode: 'mistake', bankId, bankName })}
                            />
                    </View>
                </View>

                    {/* Mock Exam Entry */}
                    <Button
                        mode="outlined"
                        onPress={handleStartExam}
                        style={[styles.inlineExamButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
                        contentStyle={{ height: 48 }}
                        icon="timer-outline"
                        textColor={theme.colors.onSurfaceVariant}
                    >
                        开启模拟考试
                    </Button>

                    {/* Question Type */}
                    <Card style={[styles.card, { shadowColor: theme.colors.shadow }]} mode="outlined">
                        <Card.Content>
                            <Text variant="titleMedium" style={{ marginBottom: 12, fontWeight: 'bold' }}>题型过滤</Text>
                            <View style={styles.typeGrid}>
                                {questionTypes.map((type) => (
                                    <TouchableOpacity
                                        key={type.value}
                                        style={[
                                            styles.typeButton,
                                            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
                                            selectedType === type.value && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                                        ]}
                                        onPress={() => setSelectedType(type.value)}
                                    >
                                        <IconButton 
                                            icon={type.icon} 
                                            size={20} 
                                            iconColor={selectedType === type.value ? theme.colors.onPrimary : theme.colors.onSurfaceVariant} 
                                        />
                                        <Text 
                                            variant="labelMedium" 
                                            style={{ color: selectedType === type.value ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}
                                        >
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Card.Content>
                    </Card>

                    <View style={{ height: 20 }} />
            </ScrollView>

            <Portal>
                <Modal
                    visible={examModalVisible}
                    onDismiss={() => setExamModalVisible(false)}
                    contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
                >
                    <Text variant="headlineSmall" style={{ marginBottom: 16, fontWeight: 'bold' }}>模拟考试设置</Text>
                    <Text variant="bodyMedium" style={{ marginBottom: 8, opacity: 0.7 }}>请输入本次模拟考试的题目数量：</Text>
                    <TextInput
                        mode="outlined"
                        label="题目数量"
                        value={examQuestionCount}
                        onChangeText={setExamQuestionCount}
                        keyboardType="numeric"
                        style={{ marginBottom: 20 }}
                        placeholder="建议 20-50 题"
                    />
                    <View style={styles.modalButtons}>
                        <Button onPress={() => setExamModalVisible(false)} style={{ flex: 1 }}>取消</Button>
                        <Button mode="contained" onPress={confirmStartExam} style={{ flex: 1, marginLeft: 8 }}>开始考试</Button>
                    </View>
                </Modal>
            </Portal>

            <Portal>
                <Modal
                    visible={resetModalVisible}
                    onDismiss={() => setResetModalVisible(false)}
                    contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
                >
                    <Text variant="headlineSmall" style={{ marginBottom: 16, fontWeight: 'bold' }}>重新开始复习</Text>
                    <Text variant="bodyMedium" style={{ marginBottom: 20 }}>
                        确定要重新开始本题库的复习吗？
                        {"\n\n"}
                        此操作将：
                        {"\n"}• 将所有题目标记为"立即待复习"
                        {"\n"}• 重置当前的刷题队列位置
                        {"\n"}• <Text style={{ fontWeight: 'bold' }}>保留</Text> 之前的记忆等级数据
                        {"\n"}• <Text style={{ fontWeight: 'bold' }}>保留</Text> 所有的历史做题统计
                        {"\n\n"}
                        您可以在保留历史数据的同时，对所有题目进行新一轮的巩固复习。
                    </Text>
                    <View style={styles.modalButtons}>
                        <Button onPress={() => setResetModalVisible(false)} style={{ flex: 1 }}>取消</Button>
                        <Button 
                            mode="contained" 
                            onPress={handleResetProgress} 
                            style={{ flex: 1, marginLeft: 8 }} 
                        >
                            确认开始
                        </Button>
                    </View>
                </Modal>
            </Portal>

            {/* Fixed Footer Buttons */}
            <View style={[
                styles.footer, 
                { 
                    paddingBottom: Math.max(insets.bottom, 16),
                    backgroundColor: theme.colors.surface,
                    borderTopColor: theme.colors.outlineVariant,
                    shadowColor: theme.colors.shadow
                }
            ]}>
                <View style={styles.footerRow}>
                    <Button
                        mode="outlined"
                        onPress={() => handleStart('study')}
                        style={[styles.footerButton, { borderColor: theme.colors.primary }]}
                        contentStyle={{ height: 48 }}
                        labelStyle={{ fontSize: 14, fontWeight: 'bold' }}
                    >
                        {hasSession.study ? '继续背题' : '开始背题'}
                    </Button>
                    <Button
                        mode="contained"
                        onPress={() => handleStart('practice')}
                        style={styles.footerButton}
                        contentStyle={{ height: 48 }}
                        labelStyle={{ fontSize: 14, fontWeight: 'bold' }}
                    >
                        {hasSession.practice ? '继续刷题' : '开始刷题'}
                    </Button>
                </View>
            </View>
        </View>
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
    },
    integratedTitle: { fontWeight: 'bold', marginBottom: 16, textAlign: 'left', opacity: 0.8 },
    footer: {
        padding: 16,
        gap: 8,
        borderTopWidth: 1,
        elevation: 10,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    footerRow: { flexDirection: 'row', gap: 8 },
    footerButton: { flex: 1, borderRadius: 12 },
    inlineExamButton: { borderRadius: 12, marginBottom: 20 },
    modalContent: { padding: 24, margin: 20, borderRadius: 16 },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
});
