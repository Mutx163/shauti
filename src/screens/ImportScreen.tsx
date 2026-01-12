import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Text, Card, ProgressBar, HelperText, useTheme, TextInput, Divider, IconButton } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import Papa from 'papaparse';
import { getDB } from '../db/database';
import { useNavigation } from '@react-navigation/native';

export default function ImportScreen() {
    const navigation = useNavigation();
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [pasteText, setPasteText] = useState('');

    const handleSelectFile = async () => {
        setError('');
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets[0];
            await processFile(file.uri, file.name);
        } catch (err) {
            setError('选择文件失败');
            console.error(err);
        }
    };

    const processFile = async (uri: string, name: string) => {
        setLoading(true);
        setProgress(0);

        try {
            const fileContent = await FileSystem.readAsStringAsync(uri);
            handleCSVImport(fileContent, name);
        } catch (err) {
            setError('读取文件失败');
            setLoading(false);
        }
    };

    const handleCSVImport = (csvContent: string, bankName: string) => {
        Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    await saveToDatabase(results.data, bankName);
                    setLoading(false);
                    Alert.alert('成功', '题库已导入');
                    navigation.goBack();
                } catch (e) {
                    setError('保存失败');
                    setLoading(false);
                }
            },
            error: (err: any) => {
                setError('解析 CSV 失败: ' + err.message);
                setLoading(false);
            }
        });
    };

    const saveToDatabase = async (data: any[], fileName: string) => {
        const db = getDB();

        try {
            // 1. Create Question Bank
            const bankResult = await db.runAsync(
                'INSERT INTO question_banks (name, description) VALUES (?, ?)',
                fileName.replace('.csv', ''),
                `导入时间: ${new Date().toLocaleString()}`
            );

            //@ts-ignore
            const bankId = bankResult.lastInsertRowId;
            const total = data.length;

            // 2. Insert Questions
            for (let i = 0; i < total; i++) {
                const row = data[i];

                const options = {
                    A: row.A || '',
                    B: row.B || '',
                    C: row.C || '',
                    D: row.D || '',
                };

                const typeMapping: any = {
                    '单选': 'single',
                    'single': 'single',
                    '多选': 'multi',
                    'multi': 'multi',
                    '判断': 'true_false',
                    'true_false': 'true_false',
                    '填空': 'fill',
                    'fill': 'fill',
                    '简答': 'short',
                    'short': 'short'
                };

                const type = typeMapping[row.type] || 'single';

                await db.runAsync(
                    `INSERT INTO questions (bank_id, type, content, options, correct_answer, explanation) 
           VALUES (?, ?, ?, ?, ?, ?)`,
                    bankId,
                    type,
                    row.content || '题目内容丢失',
                    JSON.stringify(options),
                    row.answer?.toString() || '',
                    row.explanation || ''
                );

                setProgress((i + 1) / total);
            }
        } catch (err) {
            console.error(err);
            setError('保存到数据库失败');
            throw err;
        }
    };

    const handlePasteImport = async () => {
        if (!pasteText.trim()) {
            Alert.alert('提示', '请先输入或粘贴内容');
            return;
        }

        setLoading(true);
        setError('');
        try {
            // Try as Share Code first
            try {
                const jsonStr = decodeURIComponent(escape(atob(pasteText.trim())));
                const shareData = JSON.parse(jsonStr);

                if (shareData.name && shareData.questions) {
                    const dbData = shareData.questions.map((q: any) => ({
                        type: q.type,
                        content: q.content,
                        ...q.options,
                        answer: q.answer,
                        explanation: q.explanation
                    }));
                    await saveToDatabase(dbData, shareData.name);
                    Alert.alert('成功', `已导入分享题库: ${shareData.name}`);
                    navigation.goBack();
                    return;
                }
            } catch (e) {
                // Not a share code, try as CSV
                handleCSVImport(pasteText.trim(), '粘贴导入题库_' + new Date().getHours() + new Date().getMinutes());
            }
        } catch (e) {
            Alert.alert('错误', '解析内容失败，请检查格式');
            setLoading(false);
        }
    };

    const handleImportSample = async () => {
        const sampleData = [
            { type: 'single', content: '求二次方程 $ax^2 + bx + c = 0$ 的根公式是？', A: '$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$', B: '$x = \\frac{b \\pm \\sqrt{b^2-4ac}}{2a}$', C: '$x = -b \\pm \\sqrt{b^2-4ac}$', D: '$x = \\frac{-b \\pm \\sqrt{b^2+4ac}}{2a}$', answer: 'A', explanation: '经典的求根公式。' },
            { type: 'multi', content: '以下哪些公式正确？', A: '$e^{i\\pi} + 1 = 0$', B: '$\\sin^2\\theta + \\cos^2\\theta = 1$', C: '$E = mc^2$', D: '$F = ma^2$', answer: 'ABC', explanation: '最后一个应该是 $F=ma$。' },
            { type: 'true_false', content: '对于任意矩阵 $A$，都有 $AA^{-1} = I$。', answer: 'F', explanation: '只有可逆矩阵才有逆矩阵。' },
            { type: 'fill', content: '圆的面积公式是 $A = $ ____。', answer: '$\\pi r^2$', explanation: '其中 r 是半径。' },
            { type: 'short', content: '写出牛顿第二定律的数学表达式。', answer: '$F = ma$', explanation: '力等于质量乘以加速度。' }
        ];

        setLoading(true);
        try {
            await saveToDatabase(sampleData, '数学公式示例题库');
            Alert.alert('成功', '公式示例题库已导入，支持 LaTeX 渲染！');
            navigation.goBack();
        } catch (e) {
            Alert.alert('错误', '导入失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>
                <Text variant="headlineSmall" style={{ marginBottom: 20 }}>导入题库</Text>

                <Card style={styles.card} mode="outlined">
                    <Card.Content>
                        <Text variant="titleMedium" style={{ marginBottom: 10 }}>文件导入 (CSV)</Text>
                        <Text variant="bodySmall" style={{ marginBottom: 15, color: 'gray' }}>
                            格式要求：type, content, A, B, C, D, answer, explanation
                        </Text>
                        <Button
                            mode="contained"
                            onPress={handleSelectFile}
                            loading={loading}
                            disabled={loading}
                            icon="file-upload"
                        >
                            选择 CSV 文件
                        </Button>
                    </Card.Content>
                </Card>

                <Card style={[styles.card, { backgroundColor: '#f0f4ff', borderColor: '#d0d7ff' }]} mode="outlined">
                    <Card.Content>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <IconButton icon="robot" size={20} iconColor={theme.colors.primary} style={{ margin: 0, marginRight: 4 }} />
                            <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>AI 辅助整理</Text>
                        </View>
                        <Text variant="bodySmall" style={{ marginBottom: 12, color: '#555', lineHeight: 18 }}>
                            手头题目格式乱？点击下方按钮复制“AI 整理指令”，发送给 ChatGPT/Claude 帮你秒变标准格式。
                        </Text>
                        <Button
                            mode="contained-tonal"
                            icon="content-copy"
                            onPress={async () => {
                                const prompt = `请帮我将以下题目整理成标准 CSV 格式。要求如下：
1. 列名必须严格为：type,content,A,B,C,D,answer,explanation
2. type 取值：单选(single), 多选(multi), 判断(true_false), 填空(fill), 简答(short)
3. **支持数学公式**：数学公式请使用 LaTeX 格式，用 $ 符号包裹（如 $E=mc^2$ 或 $$\\int_0^1 x dx$$）
4. A-D 列：选择题填内容；非选择题留空；判断题留空
5. answer 格式：单选填 A/B/C/D；多选填 ABCD；判断填 T/F；填空简答题填答案文本
6. 请直接输出 CSV 纯文本，不要包含代码块标记（如 \`\`\`）`;
                                await Clipboard.setStringAsync(prompt);
                                Alert.alert('已复制', '支持数学公式的 AI 指令已复制！');
                            }}
                        >
                            复制 AI 整理指令
                        </Button>
                    </Card.Content>
                </Card>

                <Card style={styles.card} mode="outlined">
                    <Card.Content>
                        <Text variant="titleMedium" style={{ marginBottom: 10 }}>粘贴代码导入</Text>
                        <Text variant="bodySmall" style={{ marginBottom: 10, color: 'gray' }}>
                            在此粘贴分享码或 CSV 格式题目代码
                        </Text>
                        <TextInput
                            mode="outlined"
                            placeholder="在这里粘贴题库分享码或 CSV 代码..."
                            multiline
                            numberOfLines={6}
                            value={pasteText}
                            onChangeText={setPasteText}
                            style={styles.textInput}
                        />
                        <Button
                            mode="contained-tonal"
                            onPress={handlePasteImport}
                            loading={loading}
                            disabled={loading || !pasteText.trim()}
                            style={{ marginTop: 10 }}
                            icon="content-paste"
                        >
                            解析并导入
                        </Button>
                    </Card.Content>
                </Card>

                <Divider style={{ marginVertical: 20 }} />

                <View style={{ alignItems: 'center' }}>
                    <Button
                        mode="text"
                        onPress={handleImportSample}
                        disabled={loading}
                        icon="flash-outline"
                    >
                        导入公式示例题库
                    </Button>
                </View>

                {loading && (
                    <View style={{ marginTop: 20 }}>
                        <Text variant="bodySmall" style={{ textAlign: 'center', marginBottom: 5 }}>
                            正在导入: {Math.round(progress * 100)}%
                        </Text>
                        <ProgressBar progress={progress} />
                    </View>
                )}

                {error ? <HelperText type="error" visible={!!error}>{error}</HelperText> : null}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20 },
    card: { marginBottom: 16, borderRadius: 12 },
    textInput: {
        backgroundColor: 'white',
        fontSize: 14,
        marginBottom: 10,
    }
});
