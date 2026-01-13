import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { Text, useTheme, ActivityIndicator, IconButton, Portal, Modal, Card, Divider } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import { getDB } from '../db/database';
import MathText from '../components/MathText';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_SIZE = (SCREEN_WIDTH - 48) / 5; // 5 columns

const MASTERY_COLORS = [
    '#F5F5F5', // Level 0: Not started
    '#C6E48B', // Level 1
    '#7BC96F', // Level 2
    '#239A3B', // Level 3
    '#196127', // Level 4
    '#12451C', // Level 5
    '#0A2B12', // Level 6
    '#051509', // Level 7
];

const MASTERY_LABELS = [
    '未开始', '学习中', '初见成效', '稳步前进', '已经掌握', '印象深刻', '了然于胸', '永生难忘'
];

export default function MasteryListScreen() {
    const theme = useTheme();
    const route = useRoute<any>();
    const { bankId } = route.params;

    const [loading, setLoading] = useState(true);
    const [questions, setQuestions] = useState<any[]>([]);
    const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const loadMasteryData = useCallback(async () => {
        setLoading(true);
        const db = getDB();
        try {
            const result = await db.getAllAsync(`
                SELECT 
                    q.id, 
                    q.content, 
                    q.type,
                    q.options,
                    q.correct_answer,
                    q.explanation,
                    COALESCE(qm.mastery_level, 0) as mastery_level,
                    qm.next_review_time,
                    (SELECT COUNT(*) FROM user_progress WHERE question_id = q.id) as attempt_count
                FROM questions q
                LEFT JOIN question_mastery qm ON q.id = qm.question_id
                WHERE q.bank_id = ?
                ORDER BY q.id ASC
            `, bankId);
            setQuestions(result);
        } catch (e) {
            console.error('Failed to load mastery data:', e);
        } finally {
            setLoading(false);
        }
    }, [bankId]);

    useEffect(() => {
        loadMasteryData();
    }, [loadMasteryData]);

    const showDetail = (item: any) => {
        setSelectedQuestion(item);
        setModalVisible(true);
    };

    const renderGridItem = ({ item, index }: { item: any, index: number }) => {
        const masteryLevel = Math.min(item.mastery_level || 0, 7);
        const bgColor = MASTERY_COLORS[masteryLevel];
        const textColor = masteryLevel > 3 ? '#fff' : '#333';

        return (
            <TouchableOpacity
                style={[styles.gridBox, { backgroundColor: bgColor }]}
                onPress={() => showDetail(item)}
            >
                <Text style={[styles.gridText, { color: textColor }]}>{index + 1}</Text>
            </TouchableOpacity>
        );
    };

    const renderOptions = (optionsStr: string) => {
        try {
            const options = JSON.parse(optionsStr);
            if (Array.isArray(options)) {
                return options.map((opt, idx) => (
                    <View key={idx} style={styles.optionRow}>
                        <Text variant="labelLarge" style={styles.optionLabel}>{String.fromCharCode(65 + idx)}.</Text>
                        <MathText content={opt} fontSize={14} baseStyle={{ flex: 1 }} />
                    </View>
                ));
            }
        } catch (e) {
            return <MathText content={optionsStr} fontSize={14} />;
        }
        return null;
    };

    const getProgressStats = () => {
        if (questions.length === 0) return { percent: 0, learned: 0 };
        const mastered = questions.filter(q => q.mastery_level >= 5).length;
        const started = questions.filter(q => q.mastery_level > 0).length;
        return {
            masteredPercent: Math.round((mastered / questions.length) * 100),
            startedPercent: Math.round((started / questions.length) * 100),
            mastered,
            started
        };
    };

    const stats = getProgressStats();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" />
                    <Text style={{ marginTop: 16 }}>正在构建知识图谱...</Text>
                </View>
            ) : (
                <FlatList
                    data={questions}
                    renderItem={renderGridItem}
                    keyExtractor={item => item.id.toString()}
                    numColumns={5}
                    contentContainerStyle={styles.gridContent}
                    ListHeaderComponent={
                        <View style={styles.headerSection}>
                            <Card style={styles.progressSummaryCard} mode="elevated">
                                <Card.Content style={{ padding: 16 }}>
                                    {/* 头部区域 */}
                                    <View style={[styles.cardHeader, { backgroundColor: theme.colors.primaryContainer }]}>
                                        <View style={{ flex: 1 }}>
                                            <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.onPrimaryContainer }}>
                                                📊 掌握进度
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                                <View style={[styles.statBadge, { backgroundColor: theme.colors.primary }]}>
                                                    <Text variant="labelSmall" style={{ color: '#fff', fontWeight: 'bold' }}>
                                                        精通 {stats.mastered}
                                                    </Text>
                                                </View>
                                                <View style={[styles.statBadge, { backgroundColor: '#C6E48B' }]}>
                                                    <Text variant="labelSmall" style={{ color: '#333', fontWeight: 'bold' }}>
                                                        学习中 {stats.started - stats.mastered}
                                                    </Text>
                                                </View>
                                                <View style={[styles.statBadge, { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#ddd' }]}>
                                                    <Text variant="labelSmall" style={{ color: '#666', fontWeight: 'bold' }}>
                                                        未开始 {questions.length - stats.started}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={[styles.percentCircle, { backgroundColor: theme.colors.surface }]}>
                                            <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                                                {stats.masteredPercent}
                                            </Text>
                                            <Text variant="labelSmall" style={{ color: theme.colors.primary }}>%</Text>
                                        </View>
                                    </View>

                                    {/* 进度条区域 */}
                                    <View style={{ marginTop: 16 }}>
                                        <View style={styles.progressBarContainer}>
                                            <View style={[styles.progressBar, { width: `${stats.masteredPercent}%`, backgroundColor: theme.colors.primary }]} />
                                            <View style={[styles.progressBarBase, { width: `${stats.startedPercent}%`, backgroundColor: '#C6E48B' }]} />
                                        </View>
                                        <Text variant="labelSmall" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                                            总计 {questions.length} 道题目
                                        </Text>
                                    </View>
                                </Card.Content>
                            </Card>

                            <View style={styles.legendContainer}>
                                <Text variant="labelMedium" style={styles.legendTitle}>💡 掌握等级颜色分布 (0-7级)</Text>
                                <View style={styles.legendRow}>
                                    {MASTERY_COLORS.map((color, i) => (
                                        <View key={i} style={styles.legendItem}>
                                            <View style={[styles.legendBox, { backgroundColor: color, borderWidth: i === 0 ? 1 : 0, borderColor: '#ddd' }]} />
                                            <Text variant="labelSmall" style={{ fontSize: 9 }}>{i}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>
                    }
                />
            )}

            <Portal>
                <Modal
                    visible={modalVisible}
                    onDismiss={() => setModalVisible(false)}
                    contentContainerStyle={styles.modalContent}
                >
                    {selectedQuestion && (
                        <Card style={styles.detailCard}>
                            <Card.Title
                                title={`题目 #${questions.indexOf(selectedQuestion) + 1}`}
                                subtitle={MASTERY_LABELS[Math.min(selectedQuestion.mastery_level, 7)]}
                                right={(props) => (
                                    <View style={styles.modalHeaderRight}>
                                        <Text variant="labelSmall" style={{ opacity: 0.5 }}>已练 {selectedQuestion.attempt_count} 次</Text>
                                        <IconButton {...props} icon="close" onPress={() => setModalVisible(false)} />
                                    </View>
                                )}
                            />
                            <Divider />
                            <ScrollView style={styles.modalScroll}>
                                <View style={styles.section}>
                                    <Text variant="labelMedium" style={styles.sectionLabel}>题目内容</Text>
                                    <MathText content={selectedQuestion.content} fontSize={16} />
                                </View>

                                {selectedQuestion.options && (
                                    <View style={styles.section}>
                                        <Text variant="labelMedium" style={styles.sectionLabel}>选项</Text>
                                        {renderOptions(selectedQuestion.options)}
                                    </View>
                                )}

                                <View style={[styles.section, styles.answerSection]}>
                                    <Text variant="labelMedium" style={styles.sectionLabel}>正确答案</Text>
                                    <Text variant="titleMedium" style={styles.answerText}>{selectedQuestion.correct_answer}</Text>
                                </View>

                                {selectedQuestion.explanation && (
                                    <View style={styles.section}>
                                        <Text variant="labelMedium" style={styles.sectionLabel}>解析</Text>
                                        <MathText content={selectedQuestion.explanation} fontSize={14} color="#666" />
                                    </View>
                                )}

                                <View style={{ height: 20 }} />
                            </ScrollView>
                        </Card>
                    )}
                </Modal>
            </Portal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    gridContent: { padding: 12, paddingBottom: 40 },
    gridBox: {
        width: GRID_SIZE,
        height: GRID_SIZE,
        margin: 4,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    gridText: { fontSize: 14, fontWeight: 'bold' },
    legendContainer: { padding: 8, marginBottom: 12, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 12 },
    legendTitle: { opacity: 0.6, marginBottom: 8, textAlign: 'center' },
    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
    legendItem: { alignItems: 'center' },
    legendBox: { width: 16, height: 16, borderRadius: 4, marginBottom: 2 },
    headerSection: { paddingHorizontal: 4, marginBottom: 16 },
    progressSummaryCard: {
        borderRadius: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
    },
    statBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    percentCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    progressBarContainer: { height: 10, borderRadius: 5, backgroundColor: '#eee', overflow: 'hidden', position: 'relative' },
    progressBar: { height: '100%', borderRadius: 5, position: 'absolute', zIndex: 2 },
    progressBarBase: { height: '100%', borderRadius: 5, position: 'absolute', zIndex: 1 },
    legendRowMini: { flexDirection: 'row', justifyContent: 'flex-start', gap: 12 },
    legendDotGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    modalContent: { margin: 20 },
    detailCard: { maxHeight: '90%', borderRadius: 20, overflow: 'hidden' },
    modalHeaderRight: { flexDirection: 'row', alignItems: 'center' },
    modalScroll: { padding: 16 },
    section: { marginBottom: 20 },
    sectionLabel: { color: 'gray', marginBottom: 6, opacity: 0.7 },
    optionRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-start' },
    optionLabel: { marginRight: 8, fontWeight: 'bold', width: 20 },
    answerSection: { backgroundColor: 'rgba(76, 175, 80, 0.05)', padding: 12, borderRadius: 12 },
    answerText: { color: '#2E7D32', fontWeight: 'bold' },
});
