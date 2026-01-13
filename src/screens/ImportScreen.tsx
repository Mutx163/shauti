import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Text, Card, ProgressBar, HelperText, useTheme, TextInput, Divider, IconButton, Avatar, Portal, Modal, ActivityIndicator } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import Papa from 'papaparse';
import { getDB } from '../db/database';
import { useNavigation } from '@react-navigation/native';

export default function ImportScreen() {
    const navigation = useNavigation<any>();
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [pasteText, setPasteText] = useState('');

    const handleSelectFile = async () => {
        setError('');
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain'],
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
                    Alert.alert('成功', '题库已同步至本地');
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
                fileName.replace('.csv', '').replace('.txt', ''),
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
            Alert.alert('成功', '示例已同步，支持 LaTeX 渲染！');
            navigation.goBack();
        } catch (e) {
            Alert.alert('错误', '导入失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                    <IconButton icon="database-import" iconColor={theme.colors.primary} size={32} />
                </View>
                <Text variant="headlineSmall" style={styles.title}>同步导入中心</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>您可以手动录入或多种方式批量导入题库</Text>
            </View>

            <View style={styles.content}>
                {/* Manual Add - Primary Action */}
                <Card
                    style={[styles.mainCard, { backgroundColor: theme.colors.primary }]}
                    onPress={() => navigation.navigate('ManualAdd')}
                >
                    <Card.Content style={styles.mainCardContent}>
                        <View style={styles.mainCardText}>
                            <Text variant="titleLarge" style={{ color: 'white', fontWeight: 'bold' }}>手动录入题目</Text>
                            <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                逐题手写添加，支持 LaTeX 公式预览及所有题型
                            </Text>
                        </View>
                        <Avatar.Icon icon="plus" size={48} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} color="white" />
                    </Card.Content>
                </Card>

                <View style={styles.sectionTitleRow}>
                    <Divider style={styles.sectionDivider} />
                    <Text variant="labelLarge" style={styles.sectionTitle}>批量导入方案</Text>
                    <Divider style={styles.sectionDivider} />
                </View>

                {/* CSV File Import */}
                <Card style={styles.card} mode="outlined" onPress={handleSelectFile}>
                    <Card.Title
                        title="标准 CSV/TXT 文件"
                        subtitle="从外部电子表格批量拉取题目"
                        left={(props) => <Avatar.Icon {...props} icon="file-delimited" style={{ backgroundColor: "#4CAF50" }} />}
                        right={(props) => <IconButton {...props} icon="chevron-right" />}
                    />
                </Card>

                {/* Paste Code */}
                <Card style={styles.card} mode="outlined">
                    <Card.Content>
                        <View style={styles.cardHeader}>
                            <Avatar.Icon icon="content-paste" size={40} style={{ backgroundColor: "#FF9800" }} />
                            <View style={{ marginLeft: 12 }}>
                                <Text variant="titleMedium">粘贴代码导入</Text>
                                <Text variant="bodySmall" style={{ color: 'gray' }}>分享码或 CSV 代码段</Text>
                            </View>
                        </View>
                        <TextInput
                            mode="flat"
                            placeholder="在此粘贴分享码或 CSV 内容..."
                            multiline
                            numberOfLines={3}
                            value={pasteText}
                            onChangeText={setPasteText}
                            style={styles.textInput}
                        />
                        <Button
                            mode="contained-tonal"
                            onPress={handlePasteImport}
                            loading={loading}
                            disabled={loading || !pasteText.trim()}
                            style={{ marginTop: 8 }}
                        >
                            解析并同步
                        </Button>
                    </Card.Content>
                </Card>

                {/* AI Helper */}
                <Card style={[styles.card, { backgroundColor: '#f0f4ff', borderColor: '#d0d7ff' }]} mode="outlined">
                    <Card.Content>
                        <View style={styles.cardHeader}>
                            <Avatar.Icon icon="robot" size={40} style={{ backgroundColor: theme.colors.primary }} />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text variant="titleMedium" style={{ color: theme.colors.primary }}>AI 整理助手</Text>
                                <Text variant="bodySmall" style={{ color: '#555' }}>
                                    将杂乱文字秒变标准格式
                                </Text>
                            </View>
                        </View>
                        <Button
                            mode="outlined"
                            icon="content-copy"
                            style={{ marginTop: 12, borderColor: theme.colors.primary }}
                            onPress={async () => {
                                const prompt = `请帮我将以下题目整理成标准 CSV 格式。要求如下：
1. 列名必须严格为：type,content,A,B,C,D,answer,explanation
2. type 取值：单选(single), 多选(multi), 判断(true_false), 填空(fill), 简答(short)
3. **支持数学公式**：数学公式请使用 LaTeX 格式，用 $ 符号包裹
4. A-D 列：选择题填内容；非选择题留空；判断题留空
5. answer 格式：单选填 A/B/C/D；多选填 ABCD；判断填 T/F；填空简答题填答案文本
6. 请直接输出 CSV 纯文本，不要包含代码块标记`;
                                await Clipboard.setStringAsync(prompt);
                                Alert.alert('已复制', 'AI 整理指令已复制，请发送给 AI 助手。');
                            }}
                        >
                            获取 AI 整理指令
                        </Button>
                    </Card.Content>
                </Card>

                <View style={styles.footer}>
                    <Button
                        mode="text"
                        onPress={handleImportSample}
                        disabled={loading}
                        icon="lightbulb-outline"
                        textColor="gray"
                    >
                        导入 LaTeX 公式演示题库
                    </Button>
                </View>

                <Portal>
                    <Modal visible={loading} dismissable={false} contentContainerStyle={styles.loadingModal}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text variant="titleMedium" style={{ marginTop: 16 }}>正在飞速处理题库...</Text>
                        <Text variant="bodySmall" style={{ marginTop: 8, color: 'gray' }}>
                            已完成 {Math.round(progress * 100)}%
                        </Text>
                        <ProgressBar progress={progress} style={{ width: 200, marginTop: 12, height: 6, borderRadius: 3 }} />
                    </Modal>
                </Portal>

                {error ? <HelperText type="error" visible={!!error} style={{ textAlign: 'center' }}>{error}</HelperText> : null}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 20,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: { fontWeight: 'bold', marginBottom: 4 },
    subtitle: { color: 'gray', textAlign: 'center' },
    content: { padding: 16 },
    mainCard: { marginBottom: 24, borderRadius: 20, elevation: 4 },
    mainCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 20,
        paddingHorizontal: 16,
    },
    mainCardText: { flex: 1, marginRight: 16 },
    card: { marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    sectionTitle: { marginHorizontal: 12, color: 'gray', opacity: 0.8 },
    sectionDivider: { flex: 1, height: 1, opacity: 0.2 },
    textInput: {
        backgroundColor: '#f9f9f9',
        fontSize: 13,
        paddingHorizontal: 0,
    },
    footer: { marginTop: 16, alignItems: 'center', paddingBottom: 40 },
    loadingModal: {
        backgroundColor: 'white',
        padding: 32,
        margin: 40,
        borderRadius: 28,
        alignItems: 'center',
    }
});
