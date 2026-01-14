import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Dimensions, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Text, useTheme, ActivityIndicator, IconButton, Portal, Modal, Card, Divider, Surface } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getDB } from '../db/database';
import MathText from '../components/MathText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 6;
const CONTAINER_PADDING = 16;
const ITEM_MARGIN = 4;
const GRID_SIZE = (SCREEN_WIDTH - (CONTAINER_PADDING * 2) - (ITEM_MARGIN * 2 * COLUMN_COUNT)) / COLUMN_COUNT;

const MASTERY_LABELS = [
    '未开始', '学习中', '初见成效', '稳步前进', '已经掌握', '印象深刻', '了然于胸', '永生难忘'
];

export default function MasteryListScreen() {
    const theme = useTheme();
    const route = useRoute<any>();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { bankId, bankName } = route.params;

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

    const isEyeCare = theme.colors.primary === '#006D3A';
    
    // 获取掌握度颜色 - 使用更柔和、更具层次感的颜色系统
    const getMasteryColor = (level: number) => {
        if (level === 0) return theme.dark ? 'rgba(255,255,255,0.05)' : '#F5F5F5';
        
        if (isEyeCare) {
            const EYE_CARE_COLORS = [
                '#F5F5F5',
                '#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784', '#66BB6A', '#4CAF50', '#2E7D32'
            ];
            return EYE_CARE_COLORS[level];
        } else {
            const primary = theme.colors.primary;
            // 使用主色调的透明度来模拟等级，更加科学统一
            const opacities = [0.05, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];
            return `${primary}${Math.round(opacities[level] * 255).toString(16).padStart(2, '0')}`;
        }
    };

    const renderGridItem = ({ item, index }: { item: any, index: number }) => {
        const masteryLevel = Math.min(item.mastery_level || 0, 7);
        const bgColor = getMasteryColor(masteryLevel);
        
        // 只有高等级才显示白色文字，否则显示主题文字色
        const textColor = masteryLevel >= 5 ? '#FFFFFF' : theme.colors.onSurface;
        const opacity = masteryLevel === 0 ? 0.4 : 1;

        return (
            <TouchableOpacity
                style={[
                    styles.gridBox, 
                    { 
                        backgroundColor: bgColor,
                    }
                ]}
                onPress={() => showDetail(item)}
                activeOpacity={0.7}
            >
                <Text style={[styles.gridText, { color: textColor, opacity }]}>{index + 1}</Text>
            </TouchableOpacity>
        );
    };

    const renderOptions = (optionsStr: string) => {
        try {
            const options = JSON.parse(optionsStr);
            if (options && typeof options === 'object') {
                return Object.entries(options).map(([key, value]: any, idx) => (
                    <View key={key} style={styles.optionRow}>
                        <View style={[styles.optionBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <Text style={[styles.optionLabel, { color: theme.colors.primary }]}>{key}</Text>
                        </View>
                        <MathText content={value} fontSize={15} baseStyle={{ flex: 1, marginLeft: 12 }} />
                    </View>
                ));
            }
        } catch (e) {
            return <MathText content={optionsStr} fontSize={15} />;
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
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>正在生成认知地图...</Text>
                </View>
            ) : (
                <FlatList
                    data={questions}
                    renderItem={renderGridItem}
                    keyExtractor={item => item.id.toString()}
                    numColumns={COLUMN_COUNT}
                    contentContainerStyle={[styles.gridContent, { paddingBottom: insets.bottom + 20 }]}
                    ListHeaderComponent={
                        <View style={styles.headerSection}>
                            <Surface style={styles.statsSurface} elevation={1}>
                                <View style={styles.dashboardHeader}>
                                    <View>
                                        <Text variant="headlineSmall" style={styles.dashboardTitle}>学习洞察</Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{bankName}</Text>
                                    </View>
                                    <View style={styles.scoreContainer}>
                                        <Text variant="displaySmall" style={[styles.scoreText, { color: theme.colors.primary }]}>
                                            {stats.masteredPercent}
                                            <Text variant="titleMedium" style={{ color: theme.colors.primary }}>%</Text>
                                        </Text>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>总掌握度</Text>
                                    </View>
                                </View>

                                <View style={styles.metricsRow}>
                                    <View style={styles.metricItem}>
                                        <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>{stats.mastered}</Text>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>精通题目</Text>
                                    </View>
                                    <Divider style={styles.verticalDivider} />
                                    <View style={styles.metricItem}>
                                        <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>{stats.started - stats.mastered}</Text>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>巩固中</Text>
                                    </View>
                                    <Divider style={styles.verticalDivider} />
                                    <View style={styles.metricItem}>
                                        <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>{questions.length - stats.started}</Text>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>未触达</Text>
                                    </View>
                                </View>

                                <View style={styles.progressTrack}>
                                    <View style={[styles.trackBase, { backgroundColor: theme.colors.surfaceVariant }]}>
                                        <View style={[styles.trackStarted, { width: `${stats.startedPercent}%`, backgroundColor: theme.colors.primary + '40' }]} />
                                        <View style={[styles.trackMastered, { width: `${stats.masteredPercent}%`, backgroundColor: theme.colors.primary }]} />
                                    </View>
                                </View>
                            </Surface>

                            <View style={styles.heatmapHeader}>
                                <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>认知分布图谱</Text>
                                <View style={styles.heatmapLegend}>
                                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginRight: 4 }}>低</Text>
                                    {[0, 2, 4, 6, 7].map(i => (
                                        <View key={i} style={[styles.legendDot, { backgroundColor: getMasteryColor(i) }]} />
                                    ))}
                                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>高</Text>
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
                        <Card style={[styles.detailCard, { backgroundColor: theme.colors.surface }]}>
                            <View style={styles.modalHeader}>
                                <View style={[styles.modalTitleBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                                    <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>#{questions.indexOf(selectedQuestion) + 1}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>题目详情</Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>记忆等级：{MASTERY_LABELS[Math.min(selectedQuestion.mastery_level, 7)]}</Text>
                                </View>
                                <IconButton icon="close" size={20} onPress={() => setModalVisible(false)} />
                            </View>
                            
                            <Divider />
                            
                            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                                <View style={styles.detailSection}>
                                    <View style={styles.sectionHeader}>
                                        <View style={[styles.sectionDot, { backgroundColor: theme.colors.primary }]} />
                                        <Text variant="labelLarge" style={styles.sectionTitle}>题目内容</Text>
                                    </View>
                                    <View style={styles.contentBox}>
                                        <MathText content={selectedQuestion.content} fontSize={17} color={theme.colors.onSurface} />
                                    </View>
                                </View>

                                {selectedQuestion.options && (
                                    <View style={styles.detailSection}>
                                        <View style={styles.sectionHeader}>
                                            <View style={[styles.sectionDot, { backgroundColor: theme.colors.secondary }]} />
                                            <Text variant="labelLarge" style={styles.sectionTitle}>候选项</Text>
                                        </View>
                                        <View style={styles.optionsBox}>
                                            {renderOptions(selectedQuestion.options)}
                                        </View>
                                    </View>
                                )}

                                <View style={styles.answerSection}>
                                    <View style={[styles.answerCard, { backgroundColor: theme.colors.primary + '08', borderColor: theme.colors.primary + '20' }]}>
                                        <Text variant="labelSmall" style={{ color: theme.colors.primary, fontWeight: 'bold', marginBottom: 4 }}>正确答案</Text>
                                        <Text variant="titleLarge" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{selectedQuestion.correct_answer}</Text>
                                    </View>
                                    
                                    <View style={[styles.statItemMini, { backgroundColor: theme.colors.surfaceVariant + '50' }]}>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>练习次数</Text>
                                        <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{selectedQuestion.attempt_count}</Text>
                                    </View>
                                </View>

                                {selectedQuestion.explanation && (
                                    <View style={styles.detailSection}>
                                        <View style={styles.sectionHeader}>
                                            <View style={[styles.sectionDot, { backgroundColor: theme.colors.tertiary }]} />
                                            <Text variant="labelLarge" style={styles.sectionTitle}>深度解析</Text>
                                        </View>
                                        <View style={[styles.explanationBox, { backgroundColor: theme.colors.surfaceVariant + '30' }]}>
                                            <MathText content={selectedQuestion.explanation} fontSize={15} color={theme.colors.onSurfaceVariant} />
                                        </View>
                                    </View>
                                )}

                                <View style={{ height: 30 }} />
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
    gridContent: { padding: CONTAINER_PADDING },
    gridBox: {
        width: GRID_SIZE,
        height: GRID_SIZE,
        margin: ITEM_MARGIN,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gridText: { fontSize: 13, fontWeight: '700' },
    headerSection: { marginBottom: 24 },
    statsSurface: {
        padding: 20,
        borderRadius: 24,
        backgroundColor: '#fff',
        marginBottom: 24,
    },
    dashboardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    dashboardTitle: {
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    scoreContainer: {
        alignItems: 'flex-end',
    },
    scoreText: {
        fontWeight: '900',
        lineHeight: 40,
    },
    metricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0,0,0,0.02)',
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
    },
    metricItem: {
        flex: 1,
        alignItems: 'center',
    },
    verticalDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    progressTrack: {
        height: 8,
        width: '100%',
    },
    trackBase: {
        flex: 1,
        borderRadius: 4,
        flexDirection: 'row',
        overflow: 'hidden',
    },
    trackStarted: {
        height: '100%',
        position: 'absolute',
        left: 0,
        zIndex: 1,
    },
    trackMastered: {
        height: '100%',
        position: 'absolute',
        left: 0,
        zIndex: 2,
    },
    heatmapHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 4,
        marginBottom: 12,
    },
    heatmapLegend: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 3,
    },
    modalContent: {
        margin: 16,
        justifyContent: 'center',
    },
    detailCard: {
        borderRadius: 28,
        maxHeight: '85%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    modalTitleBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalScroll: {
        paddingHorizontal: 20,
    },
    detailSection: {
        marginTop: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 8,
    },
    sectionTitle: {
        fontWeight: 'bold',
        opacity: 0.8,
    },
    contentBox: {
        padding: 4,
    },
    optionsBox: {
        gap: 12,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    optionBadge: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionLabel: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    answerSection: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    answerCard: {
        flex: 2,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
    },
    statItemMini: {
        flex: 1,
        padding: 16,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    explanationBox: {
        padding: 16,
        borderRadius: 16,
    },
});
