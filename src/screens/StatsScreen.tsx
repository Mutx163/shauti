import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Text, Card, useTheme, ActivityIndicator, Divider, Chip } from 'react-native-paper';
import { useIsFocused } from '@react-navigation/native';
import { getDB } from '../db/database';
// @ts-ignore
import { BarChart } from 'react-native-gifted-charts';

const SCREEN_WIDTH = Dimensions.get('window').width;

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StatsScreen() {
    const theme = useTheme();
    const isFocused = useIsFocused();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const isFirstLoad = useRef(true);

    const [stats, setStats] = useState({
        totalAnswered: 0,
        correctCount: 0,
        mistakeCount: 0,
        accuracy: 0
    });

    const [heatmapData, setHeatmapData] = useState<any[]>([]);
    const [masteryData, setMasteryData] = useState<any[]>([]);
    const [maxMasteryVal, setMaxMasteryVal] = useState(10);
    const [banks, setBanks] = useState<any[]>([]);
    const [selectedBankId, setSelectedBankId] = useState<number | null>(null);

    useEffect(() => {
        if (isFocused) {
            loadStats();
        }
    }, [isFocused, selectedBankId]);

    const loadStats = useCallback(async () => {
        if (isFirstLoad.current) {
            setLoading(true);
        }

        const db = getDB();
        try {
            // 0. Load Banks for selector
            const bankList = await db.getAllAsync('SELECT id, name FROM question_banks ORDER BY name ASC');
            setBanks(bankList);

            // 1. Basic Stats
            let totalQuery = 'SELECT COUNT(*) as count FROM user_progress';
            let correctQuery = 'SELECT COUNT(*) as count FROM user_progress WHERE is_correct = 1';

            if (selectedBankId) {
                totalQuery = `
                    SELECT COUNT(*) as count 
                    FROM user_progress up 
                    JOIN questions q ON up.question_id = q.id 
                    WHERE q.bank_id = ?
                `;
                correctQuery = `
                    SELECT COUNT(*) as count 
                    FROM user_progress up 
                    JOIN questions q ON up.question_id = q.id 
                    WHERE q.bank_id = ? AND up.is_correct = 1
                `;
            }

            const totalRes: any = selectedBankId
                ? await db.getFirstAsync(totalQuery, selectedBankId)
                : await db.getFirstAsync(totalQuery);
            const correctRes: any = selectedBankId
                ? await db.getFirstAsync(correctQuery, selectedBankId)
                : await db.getFirstAsync(correctQuery);

            const total = totalRes?.count || 0;
            const correct = correctRes?.count || 0;
            const mistake = total - correct;
            const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

            setStats({
                totalAnswered: total,
                correctCount: correct,
                mistakeCount: mistake,
                accuracy: accuracy
            });

            // 4. Heatmap Data (90 days)
            let heatmapQuery = `
                SELECT strftime('%Y-%m-%d', up.timestamp, 'localtime') as date, COUNT(*) as count 
                FROM user_progress up
            `;
            if (selectedBankId) {
                heatmapQuery += ' JOIN questions q ON up.question_id = q.id WHERE q.bank_id = ? AND up.timestamp >= date(\'now\', \'-89 days\')';
            } else {
                heatmapQuery += ' WHERE up.timestamp >= date(\'now\', \'-89 days\')';
            }
            heatmapQuery += ' GROUP BY date';

            const rawHeatmap: any[] = selectedBankId
                ? await db.getAllAsync(heatmapQuery, selectedBankId)
                : await db.getAllAsync(heatmapQuery);
            setHeatmapData(rawHeatmap);

            // 5. Mastery/Forgetting Curve Data
            let masteryQuery = 'SELECT mastery_level, COUNT(*) as count FROM question_mastery GROUP BY mastery_level';
            let totalQQuery = 'SELECT COUNT(*) as count FROM questions';

            if (selectedBankId) {
                masteryQuery = `
                    SELECT qm.mastery_level, COUNT(*) as count 
                    FROM question_mastery qm 
                    JOIN questions q ON qm.question_id = q.id 
                    WHERE q.bank_id = ? 
                    GROUP BY qm.mastery_level
                `;
                totalQQuery = 'SELECT COUNT(*) as count FROM questions WHERE bank_id = ?';
            }

            const masteryRes: any[] = selectedBankId
                ? await db.getAllAsync(masteryQuery, selectedBankId)
                : await db.getAllAsync(masteryQuery);
            const totalQuestionsRes: any = selectedBankId
                ? await db.getFirstAsync(totalQQuery, selectedBankId)
                : await db.getFirstAsync(totalQQuery);
            const totalQuestions = totalQuestionsRes?.count || 0;

            const masteryCounts: Record<number, number> = {};
            masteryRes.forEach(r => masteryCounts[r.mastery_level] = r.count);

            const level0 = totalQuestions - masteryRes.reduce((acc, r) => acc + r.count, 0);

            const rawData = [
                { value: level0, label: '0', color: theme.colors.outlineVariant + '33' },
                { value: masteryCounts[1] || 0, label: '1', color: theme.colors.primary + '33' },
                { value: masteryCounts[2] || 0, label: '2', color: theme.colors.primary + '66' },
                { value: masteryCounts[3] || 0, label: '3', color: theme.colors.primary + '99' },
                { value: masteryCounts[4] || 0, label: '4', color: theme.colors.primary + 'CC' },
                { value: masteryCounts[5] || 0, label: '5', color: theme.colors.primary },
                { value: (masteryCounts[6] || 0) + (masteryCounts[7] || 0), label: '6+', color: theme.colors.onPrimaryContainer },
            ];

            const currentMax = Math.max(...rawData.map(d => d.value), 10);
            setMaxMasteryVal(currentMax);

            const distribution = rawData.map(item => ({
                value: item.value,
                label: item.label,
                frontColor: item.color,
                topLabelComponent: () => (
                    <Text style={{ fontSize: 9, marginBottom: 2, textAlign: 'center', width: 25, color: theme.colors.onSurfaceVariant }}>{item.value}</Text>
                ),
            }));

            setMasteryData(distribution);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            isFirstLoad.current = false;
        }
    }, [theme, selectedBankId]);

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>
                {/* Bank Selector */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.bankSelector}
                    contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 16 }}
                >
                    <Chip
                        selected={selectedBankId === null}
                        onPress={() => setSelectedBankId(null)}
                        mode="outlined"
                        style={[
                            styles.chip,
                            { 
                                backgroundColor: selectedBankId === null ? theme.colors.primary : theme.colors.surface,
                                borderColor: selectedBankId === null ? theme.colors.primary : theme.colors.outline,
                            }
                        ]}
                        selectedColor={theme.colors.onPrimary}
                        textStyle={{ 
                            color: selectedBankId === null ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
                            fontSize: 13
                        }}
                        showSelectedCheck={false}
                    >
                        全局统计
                    </Chip>
                    {banks.map(bank => (
                        <Chip
                            key={bank.id}
                            selected={selectedBankId === bank.id}
                            onPress={() => setSelectedBankId(bank.id)}
                            mode="outlined"
                            style={[
                                styles.chip,
                                { 
                                    backgroundColor: selectedBankId === bank.id ? theme.colors.primary : theme.colors.surface,
                                    borderColor: selectedBankId === bank.id ? theme.colors.primary : theme.colors.outline,
                                }
                            ]}
                            selectedColor={theme.colors.onPrimary}
                            textStyle={{ 
                                color: selectedBankId === bank.id ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
                                fontSize: 13
                            }}
                            showSelectedCheck={false}
                        >
                            {bank.name}
                        </Chip>
                    ))}
                </ScrollView>

                <View style={styles.grid}>
                    <Card style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]} mode="outlined">
                        <Card.Content>
                            <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>{stats.totalAnswered}</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>累计刷题</Text>
                        </Card.Content>
                    </Card>
                    <Card style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]} mode="outlined">
                        <Card.Content>
                            <Text variant="titleLarge" style={{ color: stats.accuracy >= 60 ? (theme.colors.primary === '#006D3A' ? '#4CAF50' : theme.colors.primary) : theme.colors.error }}>
                                {stats.accuracy}%
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>正确率</Text>
                        </Card.Content>
                    </Card>
                    <Card style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]} mode="outlined">
                        <Card.Content>
                            <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>{stats.mistakeCount}</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>错题数</Text>
                        </Card.Content>
                    </Card>
                </View>

                {/* Heatmap */}
                <Card style={[styles.chartCard, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]} mode="outlined">
                    <Card.Title 
                        title="学习热力图" 
                        subtitle="最近 90 天的学习频率" 
                        titleStyle={{ color: theme.colors.onSurface }}
                        subtitleStyle={{ color: theme.colors.onSurfaceVariant }}
                    />
                    <Card.Content>
                        <StudyHeatmap data={heatmapData} theme={theme} />
                    </Card.Content>
                </Card>

                {/* Forgetting Curve Distribution */}
                <Card style={[styles.chartCard, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]} mode="outlined">
                    <Card.Title
                        title="艾宾浩斯记忆分布"
                        subtitle="题目在不同掌握阶段的分布数量"
                        titleStyle={{ color: theme.colors.onSurface }}
                        subtitleStyle={{ color: theme.colors.onSurfaceVariant }}
                    />
                    <Card.Content>
                        {loading ? <ActivityIndicator size="large" /> : (
                            <View>
                                <BarChart
                                    data={masteryData}
                                    barWidth={(SCREEN_WIDTH - 80) / 7 - 6}
                                    spacing={6}
                                    noOfSections={4}
                                    barBorderRadius={4}
                                    height={200}
                                    xAxisThickness={0.5}
                                    yAxisThickness={0}
                                    hideRules
                                    yAxisLabelWidth={0}
                                    initialSpacing={10}
                                    endSpacing={10}
                                    xAxisLabelTextStyle={{ fontSize: 10, color: theme.colors.onSurfaceVariant }}
                                    maxValue={maxMasteryVal * 1.3}
                                />
                                <View style={styles.masteryLegend}>
                                    <View style={styles.legendRow}>
                                        <Text variant="labelSmall" style={{ opacity: 0.6, color: theme.colors.onSurfaceVariant }}>掌握阶段：0 (未学) → 6+ (永生难忘)</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </Card.Content>
                </Card>
            </View>
        </ScrollView>
    );
}

function StudyHeatmap({ data, theme }: any) {
    const today = new Date();
    const squares = [];
    for (let i = 89; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const found = data.find((r: any) => r.date === dateStr);
        squares.push({ count: found ? found.count : 0 });
    }

    const getHeatColor = (count: number) => {
        if (count === 0) return theme.colors.outlineVariant + '33';
        if (count < 5) return theme.colors.primary + '33';
        if (count < 15) return theme.colors.primary + '66';
        if (count < 40) return theme.colors.primary + '99';
        return theme.colors.primary;
    };

    return (
        <View style={styles.heatmapContainer}>
            <View style={styles.heatmapGrid}>
                {squares.map((s, i) => (
                    <View key={i} style={[styles.heatmapSquare, { backgroundColor: getHeatColor(s.count) }]} />
                ))}
            </View>
            <View style={styles.heatmapLegend}>
                <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>少</Text>
                {[0, 2, 10, 30, 50].map((c, i) => (
                    <View key={i} style={[styles.heatmapSquareSmall, { backgroundColor: getHeatColor(c) }]} />
                ))}
                <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>多</Text>
            </View>
        </View>
    );
}

// Remove the global getHeatColor function since it's now inside StudyHeatmap with theme support

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 12 },
    grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    card: { width: '32%', borderRadius: 12 },
    chartCard: { marginBottom: 12, borderRadius: 12 },
    heatmapContainer: { paddingVertical: 8 },
    heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-start' },
    heatmapSquare: { width: (SCREEN_WIDTH - 60) / 18, height: (SCREEN_WIDTH - 60) / 18, margin: 1, borderRadius: 2 },
    heatmapSquareSmall: { width: 10, height: 10, margin: 1, borderRadius: 1 },
    heatmapLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8 },
    legendText: { fontSize: 10, marginHorizontal: 4 },
    masteryLegend: { marginTop: 12, paddingHorizontal: 4 },
    legendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    bankSelector: { marginBottom: 8 },
    chip: { marginRight: 8, height: 32 }
});
