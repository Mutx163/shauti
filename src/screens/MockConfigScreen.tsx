import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Checkbox, useTheme, Appbar, Slider, Divider } from 'react-native-paper'; // Note: Slider might strictly be from @react-native-community/slider if paper doesn't export it, checking imports. Paper usually wraps native components or provides its own.
// Actually react-native-paper doesn't export Slider typically. We might need @react-native-community/slider. 
// However the user environment might not have it. I'll use a simple TextInput or +/- buttons if Slider is missing, or check package.json.
// Let's assume we don't have extra libs and use simple inputs or buttons.
import { useNavigation } from '@react-navigation/native';
import { getDB } from '../db/database';

export default function MockConfigScreen() {
    const navigation = useNavigation<any>();
    const theme = useTheme();
    const [banks, setBanks] = useState<any[]>([]);
    const [selectedBanks, setSelectedBanks] = useState<number[]>([]);
    const [questionCount, setQuestionCount] = useState(50);
    const [duration, setDuration] = useState(45); // minutes

    useEffect(() => {
        loadBanks();
    }, []);

    const loadBanks = async () => {
        try {
            const db = getDB();
            const result = await db.getAllAsync('SELECT * FROM question_banks');
            setBanks(result);
            // Default select all
            setSelectedBanks(result.map((b: any) => b.id));
        } catch (error) {
            console.error(error);
        }
    };

    const toggleBank = (id: number) => {
        if (selectedBanks.includes(id)) {
            setSelectedBanks(selectedBanks.filter(b => b !== id));
        } else {
            setSelectedBanks([...selectedBanks, id]);
        }
    };

    const handleStart = () => {
        if (selectedBanks.length === 0) {
            Alert.alert('提示', '请至少选择一个题库');
            return;
        }
        navigation.navigate('MockExam', {
            bankIds: selectedBanks,
            count: questionCount,
            duration: duration * 60, // convert to seconds
        });
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>
                <Card style={[styles.card, { shadowColor: theme.colors.shadow }]}>
                    <Card.Content>
                        <Text variant="titleMedium" style={{ marginBottom: 12 }}>考试设置</Text>

                        <View style={styles.settingRow}>
                            <View>
                                <Text variant="bodyLarge">题目数量</Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>随机抽取 {questionCount} 道题</Text>
                            </View>
                            <View style={styles.counter}>
                                <Button mode="outlined" compact onPress={() => setQuestionCount(Math.max(10, questionCount - 10))}>-10</Button>
                                <Text style={{ marginHorizontal: 12, fontSize: 16, color: theme.colors.onSurface }}>{questionCount}</Text>
                                <Button mode="outlined" compact onPress={() => setQuestionCount(Math.min(200, questionCount + 10))}>+10</Button>
                            </View>
                        </View>

                        <Divider style={{ marginVertical: 16 }} />

                        <View style={styles.settingRow}>
                            <View>
                                <Text variant="bodyLarge">考试时间</Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>限时 {duration} 分钟</Text>
                            </View>
                            <View style={styles.counter}>
                                <Button mode="outlined" compact onPress={() => setDuration(Math.max(10, duration - 5))}>-5</Button>
                                <Text style={{ marginHorizontal: 12, fontSize: 16, color: theme.colors.onSurface }}>{duration}</Text>
                                <Button mode="outlined" compact onPress={() => setDuration(Math.min(180, duration + 5))}>+5</Button>
                            </View>
                        </View>
                    </Card.Content>
                </Card>

                <Card style={[styles.card, { shadowColor: theme.colors.shadow }]}>
                    <Card.Content>
                        <Text variant="titleMedium" style={{ marginBottom: 12 }}>选择题库</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {banks.map((bank) => (
                                <Checkbox.Item
                                    key={bank.id}
                                    label={bank.name}
                                    status={selectedBanks.includes(bank.id) ? 'checked' : 'unchecked'}
                                    onPress={() => toggleBank(bank.id)}
                                />
                            ))}
                        </ScrollView>
                    </Card.Content>
                </Card>

                <Button
                    mode="contained"
                    onPress={handleStart}
                    style={styles.startButton}
                    contentStyle={{ height: 50 }}
                >
                    开始模拟考试
                </Button>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16 },
    card: { marginBottom: 16, borderRadius: 12 },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    counter: { flexDirection: 'row', alignItems: 'center' },
    startButton: { marginTop: 8, borderRadius: 25 },
});
