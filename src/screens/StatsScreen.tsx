import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Text, Card, useTheme, ActivityIndicator } from 'react-native-paper';
import { useIsFocused } from '@react-navigation/native';
import { getDB } from '../db/database';
// @ts-ignore
import { BarChart, PieChart } from 'react-native-gifted-charts';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function StatsScreen() {
    const theme = useTheme();
    const isFocused = useIsFocused();
    const [loading, setLoading] = useState(true);
    // Use ref to track if it's the first load to prevent flickering on subsequent focuses
    const isFirstLoad = useRef(true);

    const [stats, setStats] = useState({
        totalAnswered: 0,
        correctCount: 0,
        mistakeCount: 0,
        accuracy: 0
    });

    // Charts Data
    const [trendData, setTrendData] = useState<any[]>([]);
    const [pieData, setPieData] = useState<any[]>([]);

    useEffect(() => {
        if (isFocused) {
            loadStats();
        }
    }, [isFocused]);

    const loadStats = useCallback(async () => {
        // Only show full loading spinner on initial load or manual refresh
        // On subsequent tab switches, we do a "silent update" (keep showing old data until new data arrives)
        if (isFirstLoad.current) {
            setLoading(true);
        }

        const db = getDB();
        try {
            // 1. Basic Stats
            const totalRes: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM user_progress');
            const correctRes: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM user_progress WHERE is_correct = 1');

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

            // 2. Pie Chart Data
            setPieData([
                { value: correct, color: '#4CAF50', text: `${Math.round((correct / total) * 100) | 0}%` }, // Green
                { value: mistake, color: '#F44336', text: `${Math.round((mistake / total) * 100) | 0}%` }, // Red
            ]);

            // 3. Trend Data (Last 7 days)
            const rawTrend: any[] = await db.getAllAsync(`
                SELECT 
                    strftime('%Y-%m-%d', timestamp, 'localtime') as date, 
                    COUNT(*) as count 
                FROM user_progress 
                WHERE timestamp >= date('now', '-6 days')
                GROUP BY date
                ORDER BY date ASC
            `);

            // Normalize data (fill missing days with 0)
            const filledTrend = [];
            const today = new Date();
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];

                const found = rawTrend.find((r: any) => r.date === dateStr);
                filledTrend.push({
                    value: found ? found.count : 0,
                    label: d.getDate().toString(),
                    frontColor: theme.colors.primary,
                    topLabelComponent: () => (
                        <Text style={{ fontSize: 10, marginBottom: 4 }}>{found ? found.count : ''}</Text>
                    )
                });
            }
            setTrendData(filledTrend);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            isFirstLoad.current = false;
        }
    }, []);

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>

                {/* Header Cards */}
                <View style={styles.grid}>
                    <Card style={[styles.card, { backgroundColor: theme.colors.secondaryContainer }]}>
                        <Card.Content>
                            <Text variant="titleLarge" style={{ color: theme.colors.onSecondaryContainer }}>{stats.totalAnswered}</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer }}>累计刷题</Text>
                        </Card.Content>
                    </Card>
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text variant="titleLarge" style={{ color: stats.accuracy >= 60 ? '#4CAF50' : '#F44336' }}>
                                {stats.accuracy}%
                            </Text>
                            <Text variant="bodySmall">正确率</Text>
                        </Card.Content>
                    </Card>
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text variant="titleLarge">{stats.mistakeCount}</Text>
                            <Text variant="bodySmall">错题数</Text>
                        </Card.Content>
                    </Card>
                </View>

                {/* Accuracy Pie Chart */}
                <Card style={styles.chartCard} mode="outlined">
                    <Card.Title title="正确率分布" subtitle="累计答题情况" />
                    <Card.Content style={{ alignItems: 'center' }}>
                        {loading ? <ActivityIndicator size="large" /> : (
                            stats.totalAnswered > 0 ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <PieChart
                                        data={pieData}
                                        donut
                                        showText
                                        textColor="white"
                                        radius={80}
                                        innerRadius={50}
                                        textSize={12}
                                        focusOnPress
                                    />
                                    <View style={{ marginLeft: 20 }}>
                                        <Legend color="#4CAF50" label={`正确 (${stats.correctCount})`} />
                                        <Legend color="#F44336" label={`错误 (${stats.mistakeCount})`} />
                                    </View>
                                </View>
                            ) : (
                                <Text style={{ color: 'gray', padding: 20 }}>暂无数据，快去刷题吧！</Text>
                            )
                        )}
                    </Card.Content>
                </Card>

                {/* Trend Bar Chart */}
                <Card style={styles.chartCard} mode="outlined">
                    <Card.Title title="近期趋势" subtitle="过去 7 天每日刷题数量" />
                    <Card.Content>
                        {loading ? <ActivityIndicator size="large" /> : (
                            <View style={{ overflow: 'hidden' }}>
                                <BarChart
                                    data={trendData}
                                    barWidth={22}
                                    noOfSections={4}
                                    barBorderRadius={4}
                                    frontColor={theme.colors.primary}
                                    yAxisThickness={0}
                                    xAxisThickness={0}
                                    isAnimated
                                    height={180}
                                    width={SCREEN_WIDTH - 80} // Adjust based on padding
                                />
                            </View>
                        )}
                    </Card.Content>
                </Card>

            </View>
        </ScrollView>
    );
}

const Legend = ({ color, label }: { color: string, label: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 6 }} />
        <Text variant="bodySmall">{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16 },
    grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    card: { width: '31%', borderRadius: 12 },
    chartCard: { marginBottom: 16, borderRadius: 12, backgroundColor: 'white' }
});
