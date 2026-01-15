import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Button, Text, TextInput, useTheme, SegmentedButtons, Card, Divider, IconButton, Portal, Modal, List, Avatar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import MathText from '../components/MathText';
import { getDB, QuestionBank } from '../db/database';

type QuestionType = 'single' | 'multi' | 'true_false' | 'fill' | 'short';

export default function ManualAddScreen() {
    const navigation = useNavigation<any>();
    const theme = useTheme();

    const [banks, setBanks] = useState<QuestionBank[]>([]);
    const [bankName, setBankName] = useState('');
    const [bankId, setBankId] = useState<number | null>(null);
    const [isExistingBank, setIsExistingBank] = useState(false);
    const [showBankPicker, setShowBankPicker] = useState(false);

    // Question State
    const [type, setType] = useState<QuestionType>('single');
    const [content, setContent] = useState('');
    const [options, setOptions] = useState({ A: '', B: '', C: '', D: '' });
    const [answer, setAnswer] = useState('');
    const [explanation, setExplanation] = useState('');

    const [count, setCount] = useState(0);

    useEffect(() => {
        loadBanks();
    }, []);

    const loadBanks = async () => {
        try {
            const db = getDB();
            const result = await db.getAllAsync<QuestionBank>('SELECT * FROM question_banks ORDER BY created_at DESC');
            setBanks(result);
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreateBank = async () => {
        if (!bankName.trim()) {
            Alert.alert('错误', '请输入题库名称');
            return;
        }
        try {
            const db = getDB();
            const result = await db.runAsync(
                'INSERT INTO question_banks (name, description) VALUES (?, ?)',
                bankName.trim(),
                `手动创建: ${new Date().toLocaleString()}`
            );
            //@ts-ignore
            setBankId(result.lastInsertRowId);
            setIsExistingBank(true);
        } catch (e) {
            Alert.alert('错误', '创建题库失败');
        }
    };

    const handleSelectBank = (bank: QuestionBank) => {
        setBankId(bank.id);
        setBankName(bank.name);
        setIsExistingBank(true);
        setShowBankPicker(false);
        // Load existing count for this bank
        loadQuestionCount(bank.id);
    };

    const loadQuestionCount = async (id: number) => {
        try {
            const db = getDB();
            const result: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM questions WHERE bank_id = ?', id);
            setCount(result.count || 0);
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddQuestion = async () => {
        if (!bankId) return;
        if (!content.trim()) {
            Alert.alert('错误', '题目内容不能为空');
            return;
        }
        if (!answer.trim()) {
            Alert.alert('错误', '正确答案不能为空');
            return;
        }

        try {
            const db = getDB();
            await db.runAsync(
                `INSERT INTO questions (bank_id, type, content, options, correct_answer, explanation) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                bankId,
                type,
                content.trim(),
                JSON.stringify(options),
                answer.trim().toUpperCase(),
                explanation.trim()
            );

            setCount(prev => prev + 1);
            // Clear current inputs for next question
            setContent('');
            setOptions({ A: '', B: '', C: '', D: '' });
            setAnswer('');
            setExplanation('');
            Alert.alert('成功', '题目已添加');
        } catch (e) {
            Alert.alert('错误', '保存题目失败');
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>
                {!isExistingBank ? (
                    <View>
                        <Card style={[styles.card, { backgroundColor: '#FFFFFF' }]} mode="outlined">
                            <Card.Content>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                                    <IconButton icon="plus-box" iconColor={theme.colors.primary} size={28} />
                                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>创建新题库</Text>
                                </View>
                                <TextInput
                                    label="题库名称"
                                    value={bankName}
                                    onChangeText={setBankName}
                                    mode="outlined"
                                    placeholder="输入题库名称..."
                                    style={{ marginBottom: 16 }}
                                />
                                <Button mode="contained" onPress={handleCreateBank} style={{ borderRadius: 12 }}>
                                    确认创建并录入
                                </Button>
                            </Card.Content>
                        </Card>

                        <Divider style={{ marginVertical: 20 }} />

                        <Card style={[styles.card, { backgroundColor: '#FFFFFF' }]} mode="outlined" onPress={() => setShowBankPicker(true)}>
                            <Card.Title
                                title="选择已有题库"
                                titleStyle={{ fontWeight: 'bold' }}
                                subtitle="向现有的题库中追加题目"
                                left={(props) => <Avatar.Icon {...props} icon="folder-outline" size={40} style={{ backgroundColor: theme.colors.primary + '15' }} color={theme.colors.primary} />}
                                right={(props) => <IconButton {...props} icon="chevron-right" />}
                            />
                        </Card>
                    </View>
                ) : (
                    <View>
                        <View style={[styles.headerInfo, { backgroundColor: '#FFFFFF', borderColor: '#E5E5EA', borderWidth: 1 }]}>
                            <View>
                                <Text variant="titleMedium" style={{ color: '#1C1C1E', fontWeight: 'bold' }}>{bankName}</Text>
                                <Text variant="bodySmall" style={{ color: '#8E8E93' }}>当前题量：{count}</Text>
                            </View>
                            <Button mode="text" onPress={() => setIsExistingBank(false)} textColor={theme.colors.primary}>更换</Button>
                        </View>

                        <Card style={[styles.card, { backgroundColor: '#FFFFFF' }]} mode="outlined">
                            <Card.Content>
                                <Text variant="labelLarge" style={{ marginBottom: 8, opacity: 0.7, color: theme.colors.onSurface }}>题目类型</Text>
                                <SegmentedButtons
                                    value={type}
                                    onValueChange={v => setType(v as QuestionType)}
                                    buttons={[
                                        { value: 'single', label: '单选' },
                                        { value: 'multi', label: '多选' },
                                        { value: 'true_false', label: '判断' },
                                        { value: 'short', label: '简答' },
                                    ]}
                                    style={{ marginBottom: 20 }}
                                />

                                <TextInput
                                    label="题目内容"
                                    value={content}
                                    onChangeText={setContent}
                                    mode="outlined"
                                    multiline
                                    numberOfLines={4}
                                    style={{ marginBottom: 12 }}
                                />

                                {content.trim() !== '' && (
                                    <View style={[styles.previewBox, { backgroundColor: '#F2F2F7', borderColor: '#E5E5EA' }]}>
                                        <Text variant="labelSmall" style={{ marginBottom: 6, color: '#8E8E93', fontWeight: 'bold' }}>LaTeX 预览：</Text>
                                        <MathText content={content} fontSize={16} color="#1C1C1E" />
                                    </View>
                                )}

                                {(type === 'single' || type === 'multi') && (
                                    <View style={{ marginBottom: 16 }}>
                                        <Text variant="labelLarge" style={{ marginBottom: 8, opacity: 0.7, color: theme.colors.onSurface }}>选项内容</Text>
                                        {(['A', 'B', 'C', 'D'] as const).map(opt => (
                                            <TextInput
                                                key={opt}
                                                label={`选项 ${opt}`}
                                                value={options[opt]}
                                                onChangeText={txt => setOptions(prev => ({ ...prev, [opt]: txt }))}
                                                mode="outlined"
                                                dense
                                                style={{ marginBottom: 8 }}
                                            />
                                        ))}
                                    </View>
                                )}

                                <TextInput
                                    label="正确答案"
                                    value={answer}
                                    onChangeText={setAnswer}
                                    mode="outlined"
                                    placeholder={type === 'true_false' ? 'T(正确) 或 F(错误)' : (type === 'multi' ? '如 ABCD' : '单选直接填字母')}
                                    style={{ marginBottom: 12 }}
                                    autoCapitalize="characters"
                                />

                                <TextInput
                                    label="试题解析 (可选)"
                                    value={explanation}
                                    onChangeText={setExplanation}
                                    mode="outlined"
                                    multiline
                                    style={{ marginBottom: 24 }}
                                />

                                <Button
                                    mode="contained"
                                    onPress={handleAddQuestion}
                                    icon="plus"
                                    style={{ borderRadius: 12, paddingVertical: 4 }}
                                >
                                    保存当前题并继续
                                </Button>

                                <Button
                                    mode="outlined"
                                    onPress={() => navigation.navigate('Home')}
                                    style={{ marginTop: 12, borderRadius: 12 }}
                                >
                                    完成并返回首页
                                </Button>
                            </Card.Content>
                        </Card>
                    </View>
                )}
            </View>

            <Portal>
                <Modal visible={showBankPicker} onDismiss={() => setShowBankPicker(false)} contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                    <Text variant="titleMedium" style={{ marginBottom: 16 }}>请选择目标题库</Text>
                    <ScrollView style={{ maxHeight: 300 }}>
                        {banks.map(bank => (
                            <List.Item
                                key={bank.id}
                                title={bank.name}
                                description={`题目数量：载入中...`}
                                onPress={() => handleSelectBank(bank)}
                                left={props => <List.Icon {...props} icon="folder" />}
                            />
                        ))}
                    </ScrollView>
                    <Button onPress={() => setShowBankPicker(false)} style={{ marginTop: 16 }}>关闭</Button>
                </Modal>
            </Portal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16 },
    card: {
        borderRadius: 20,
        marginBottom: 16,
        overflow: 'hidden',
        borderColor: '#E5E5EA',
    },
    headerInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
    },
    previewBox: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
    },
    modalContent: {
        margin: 20,
        padding: 24,
        borderRadius: 24,
        borderColor: '#E5E5EA',
        borderWidth: 1,
    }
});
