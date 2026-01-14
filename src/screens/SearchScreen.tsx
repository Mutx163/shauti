import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Text, Searchbar, Card, useTheme, Chip, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { getDB, Question } from '../db/database';
import MathText from '../components/MathText';
// Or inline it if I don't want to create a file. Inline is safer for this context.

// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

export default function SearchScreen() {
    const navigation = useNavigation<any>();
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Using useRef to keep the debounced function stable across renders
    const performSearch = React.useCallback(
        debounce(async (query: string) => {
            if (!query.trim()) {
                setResults([]);
                setLoading(false);
                return;
            }

            try {
                const db = getDB();
                // Search in content and options, join with bank name
                const sql = `
                    SELECT q.*, b.name as bank_name 
                    FROM questions q 
                    JOIN question_banks b ON q.bank_id = b.id 
                    WHERE q.content LIKE ? OR q.options LIKE ? 
                    LIMIT 50
                `;
                const searchTerm = `%${query}%`;
                const searchResults = await db.getAllAsync(sql, searchTerm, searchTerm);
                setResults(searchResults);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setLoading(false);
            }
        }, 500),
        []
    );

    const onChangeSearch = (query: string) => {
        setSearchQuery(query);
        if (query.trim()) {
            setLoading(true);
            performSearch(query);
        } else {
            setResults([]);
        }
    };

    const getTypeLabel = (type: string) => {
        const map: any = { 'single': '单选', 'multi': '多选', 'true_false': '判断', 'fill': '填空', 'short': '简答' };
        return map[type] || '题目';
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Searchbar
                    placeholder="搜索题目内容..."
                    onChangeText={onChangeSearch}
                    value={searchQuery}
                    autoFocus
                    style={styles.searchbar}
                />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" />
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={
                        searchQuery.trim() ? (
                            <View style={styles.center}>
                                <Text style={{ color: theme.colors.onSurfaceVariant }}>未找到相关题目</Text>
                            </View>
                        ) : (
                            <View style={styles.center}>
                                <Text style={{ color: theme.colors.onSurfaceVariant }}>输入关键词搜索所有题库</Text>
                            </View>
                        )
                    }
                    renderItem={({ item }) => (
                        <Card
                            style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}
                            mode="outlined"
                            onPress={() => {
                                // Navigate to QuizScreen in "single question" mode or similar?
                                // Currently QuizScreen takes bankId. Let's make a special "search" mode logic later?
                                // Or better: Filter quiz by this specific question ID?
                                // For now, let's just create a temporary bank of 1 result OR pass the single question content?
                                // Actually user might want to jump to the context. Update QuizScreen to accept questionIds?
                                // Let's make it simple: Pass [item] as pre-loaded questions to QuizScreen? 
                                // QuizScreen logic needs adaptation.
                                // ALTERNATIVE: Just Preview it here? NO, user wants to practice.
                                // Let's try passing 'questionIds' param to QuizScreen.
                                navigation.navigate('Quiz', {
                                    mode: 'custom',
                                    customQuestions: [item],
                                    bankName: '搜索结果',
                                    quizMode: 'study'
                                });
                            }}
                        >
                            <Card.Content>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Chip 
                                mode="outlined"
                                textStyle={{ fontSize: 10, height: 16, lineHeight: 16 }} 
                                style={{ height: 24, backgroundColor: theme.colors.surface }} 
                                compact
                            >
                                {getTypeLabel(item.type)}
                            </Chip>
                                    <Text variant="bodySmall" style={{ color: theme.colors.primary }}>{item.bank_name}</Text>
                                </View>
                                <MathText content={item.content} fontSize={15} color={theme.colors.onSurface} />
                            </Card.Content>
                        </Card>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 16, paddingBottom: 8 },
    searchbar: { borderRadius: 12 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 50 },
    card: { marginBottom: 12 },
});
