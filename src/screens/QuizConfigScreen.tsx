import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, RadioButton, Card, useTheme, Divider } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function QuizConfigScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const theme = useTheme();
    const { bankId, bankName } = route.params;

    const [selectedType, setSelectedType] = useState('all');
    const [selectedMode, setSelectedMode] = useState('practice'); // practice or study

    const questionTypes = [
        { value: 'all', label: '全部题型' },
        { value: 'single', label: '单选题' },
        { value: 'multi', label: '多选题' },
        { value: 'true_false', label: '判断题' },
        { value: 'fill', label: '填空题' },
        { value: 'short', label: '简答题' },
    ];

    const modes = [
        { value: 'study', label: '背题模式', desc: '题目顺序，选项固定' },
        { value: 'practice', label: '刷题模式', desc: '题目随机，选项打乱' },
    ];

    const handleStart = () => {
        navigation.replace('Quiz', {
            bankId,
            bankName,
            mode: 'bank',
            questionType: selectedType,
            quizMode: selectedMode,
        });
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>
                <Text variant="headlineSmall" style={{ marginBottom: 20, textAlign: 'center' }}>
                    开始刷题
                </Text>

                <Card style={styles.card} mode="outlined">
                    <Card.Content>
                        <Text variant="titleMedium" style={{ marginBottom: 12 }}>
                            题型选择
                        </Text>
                        <RadioButton.Group onValueChange={setSelectedType} value={selectedType}>
                            {questionTypes.map((type) => (
                                <RadioButton.Item
                                    key={type.value}
                                    label={type.label}
                                    value={type.value}
                                    style={styles.radioItem}
                                />
                            ))}
                        </RadioButton.Group>
                    </Card.Content>
                </Card>

                <Card style={styles.card} mode="outlined">
                    <Card.Content>
                        <Text variant="titleMedium" style={{ marginBottom: 12 }}>
                            刷题模式
                        </Text>
                        <RadioButton.Group onValueChange={setSelectedMode} value={selectedMode}>
                            {modes.map((mode) => (
                                <View key={mode.value}>
                                    <RadioButton.Item
                                        label={mode.label}
                                        value={mode.value}
                                        style={styles.radioItem}
                                    />
                                    <Text variant="bodySmall" style={{ marginLeft: 56, marginTop: -8, marginBottom: 8, color: 'gray' }}>
                                        {mode.desc}
                                    </Text>
                                </View>
                            ))}
                        </RadioButton.Group>
                    </Card.Content>
                </Card>

                <Button
                    mode="contained"
                    onPress={handleStart}
                    style={styles.startButton}
                    contentStyle={{ height: 50 }}
                >
                    开始刷题
                </Button>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20 },
    card: { marginBottom: 16, borderRadius: 12 },
    radioItem: { paddingVertical: 4 },
    startButton: { marginTop: 20, borderRadius: 25 },
});
