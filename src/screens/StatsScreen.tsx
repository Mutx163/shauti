import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import { useIsFocused } from '@react-navigation/native';
import { getDB } from '../db/database';

export default function StatsScreen() {
    const theme = useTheme();
    const isFocused = useIsFocused();
    const [stats, setStats] = useState({
        totalAnswered: 0,
        correctCount: 0,
        mistakeCount: 0,
        accuracy: 0
    });

    useEffect(() => {
        if (isFocused) loadStats();
    }, [isFocused]);

    const loadStats = async () => {
        const db = getDB();
        try {
            const totalRes: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM user_progress');
            const correctRes: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM user_progress WHERE is_correct = 1');

            const total = totalRes?.count || 0;
            const correct = correctRes?.count || 0;

            setStats({
                totalAnswered: total,
                correctCount: correct,
                mistakeCount: total - correct,
                accuracy: total > 0 ? Math.round((correct / total) * 100) : 0
            });
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Redundant title removed */}

                <View style={styles.grid}>
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text variant="titleLarge">{stats.totalAnswered}</Text>
                            <Text variant="bodyMedium">已刷题数</Text>
                        </Card.Content>
                    </Card>
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text variant="titleLarge" style={{ color: 'green' }}>{stats.accuracy}%</Text>
                            <Text variant="bodyMedium">正确率</Text>
                        </Card.Content>
                    </Card>
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text variant="titleLarge" style={{ color: 'red' }}>{stats.mistakeCount}</Text>
                            <Text variant="bodyMedium">错题总数</Text>
                        </Card.Content>
                    </Card>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    card: { width: '48%', marginBottom: 10 }
});
