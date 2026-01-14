import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Text, Card, ProgressBar, HelperText, useTheme, TextInput, Divider, IconButton, Avatar, Portal, Modal, ActivityIndicator } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import Papa from 'papaparse';
import { getDB } from '../db/database';
import { useNavigation } from '@react-navigation/native';

export default function LocalImportTab() {
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
                    navigation.navigate('Main', { screen: 'HomeTab' });
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
            const bankResult = await db.runAsync(
                'INSERT INTO question_banks (name, description) VALUES (?, ?)',
                fileName.replace('.csv', '').replace('.txt', ''),
                `导入时间: ${new Date().toLocaleString()}`
            );

            //@ts-ignore
            const bankId = bankResult.lastInsertRowId;
            const total = data.length;

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
                    navigation.navigate('Main', { screen: 'HomeTab' });
                    return;
                }
            } catch (e) {
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
            navigation.navigate('Main', { screen: 'HomeTab' });
        } catch (e) {
            Alert.alert('错误', '导入失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>
                <Card
                    style={[styles.mainCard, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.shadow }]}
                    onPress={() => navigation.navigate('ManualAdd')}
                >
                    <Card.Content style={styles.mainCardContent}>
                        <View style={styles.mainCardText}>
                            <Text variant="titleLarge" style={{ color: theme.colors.onPrimary, fontWeight: 'bold' }}>手动录入题目</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onPrimary, opacity: 0.8 }}>
                                逐题手写添加，支持 LaTeX 公式预览及所有题型
                            </Text>
                        </View>
                        <Avatar.Icon icon="plus" size={48} style={{ backgroundColor: theme.colors.onPrimary + '33' }} color={theme.colors.onPrimary} />
                    </Card.Content>
                </Card>

                <View style={styles.sectionTitleRow}>
                    <Divider style={[styles.sectionDivider, { backgroundColor: theme.colors.outlineVariant, opacity: 0.3 }]} />
                    <Text variant="labelLarge" style={[styles.sectionTitle, { color: theme.colors.outline }]}>批量导入方案</Text>
                    <Divider style={[styles.sectionDivider, { backgroundColor: theme.colors.outlineVariant, opacity: 0.3 }]} />
                </View>

                <Card style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]} mode="outlined" onPress={handleSelectFile}>
                    <Card.Title
                        title="标准 CSV/TXT 文件"
                        subtitle="从外部电子表格批量拉取题目"
                        left={(props) => <Avatar.Icon {...props} icon="file-delimited" style={{ backgroundColor: theme.colors.primaryContainer }} color={theme.colors.onPrimaryContainer} />}
                        right={(props) => <IconButton {...props} icon="chevron-right" />}
                    />
                </Card>

                <Card style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]} mode="outlined">
                    <Card.Content>
                        <View style={styles.cardHeader}>
                            <Avatar.Icon icon="content-paste" size={40} style={{ backgroundColor: theme.colors.secondaryContainer }} color={theme.colors.onSecondaryContainer} />
                            <View style={{ marginLeft: 12 }}>
                                <Text variant="titleMedium">粘贴代码导入</Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>分享码或 CSV 代码段</Text>
                            </View>
                        </View>
                        <TextInput
                            mode="flat"
                            placeholder="在此粘贴分享码或 CSV 内容..."
                            multiline
                            numberOfLines={3}
                            value={pasteText}
                            onChangeText={setPasteText}
                            style={[styles.textInput, { backgroundColor: theme.colors.surfaceVariant + '33' }]}
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

                <Card style={[styles.card, { backgroundColor: theme.colors.tertiaryContainer, borderColor: theme.colors.tertiary, shadowColor: theme.colors.shadow }]} mode="outlined">
                    <Card.Content>
                        <View style={styles.cardHeader}>
                            <Avatar.Icon icon="robot" size={40} style={{ backgroundColor: theme.colors.tertiary }} color={theme.colors.onTertiary} />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text variant="titleMedium" style={{ color: theme.colors.onTertiaryContainer }}>AI 整理助手</Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.onTertiaryContainer, opacity: 0.8 }}>
                                    将杂乱文字秒变标准格式
                                </Text>
                            </View>
                        </View>
                        <Button
                            mode="outlined"
                            icon="content-copy"
                            style={{ marginTop: 12, borderColor: theme.colors.tertiary }}
                            textColor={theme.colors.tertiary}
                            onPress={async () => {
                                const prompt = `请帮我将以下题目整理成标准 CSV 格式。

【格式要求】
1. 第一行必须是列名（表头）：bank_id,bank,type,content,A,B,C,D,answer,explanation
2. 从第二行开始才是题目数据
3. 每个字段用英文逗号分隔
4. 如果字段内容包含逗号、换行或引号，必须用双引号包裹整个字段
5. 字段内的双引号要写成两个双引号 ""

【列说明】
- bank_id: 题库唯一标识（必填，极其重要！）
  * **格式：16位随机十六进制数字**
  * **生成方法**：使用你的 UUID 生成能力，为每个题库生成一个全球唯一的16位hex字符串
  * 正确示例：\`a3f7b8c9d2e14f6a\`、\`7b2e9f4c1a8d6e3b\`
  * 错误示例：\`bank_001\`、\`math_01\`（太简单，容易碰撞）
  * **关键规则**：
    - 同一题库的所有题目必须使用完全相同的 bank_id
    - 即使题库名称改变，bank_id 也永远不能变
    - 每个题库的 bank_id 必须是独一无二的随机值
    - 确保16位长度，全部使用小写字母和数字

- bank: 题库名称（必填）
  * 题库的显示名称，可以包含中文
  * 例如：工程力学、高等数学、英语四级

- type: 题目类型（必填），只能是以下之一
  * single (单选题)
  * multi (多选题)
  * true_false (判断题)
  * fill (填空题)
  * short (简答题)
  
- content: 题目内容（必填）
  * 可以包含 LaTeX 公式，用 $ 符号包裹，例如：$x^2$
  * 如果内容有逗号或换行，用双引号包裹

- A, B, C, D: 选项内容
  * 只有选择题需要填写
  * 不要包含 "A."、"A、" 等前缀
  * 判断题、填空题、简答题这4列留空

- answer: 正确答案（必填）
  * 单选题：A 或 B 或 C 或 D
  * 多选题：ABCD（多个选项直接连写，如 ABC）
  * 判断题：T 或 F
  * 填空题/简答题：标准答案文本

- explanation: 解析（可选）

【正确示例 - 单题库】
bank_id,bank,type,content,A,B,C,D,answer,explanation
a3f7b8c9d2e14f6a,高等数学,single,以下哪个是质数？,2,4,6,8,A,质数只能被1和自身整除
a3f7b8c9d2e14f6a,高等数学,multi,以下哪些是偶数？,2,3,4,5,AC,2和4都是偶数
a3f7b8c9d2e14f6a,高等数学,fill,圆的面积公式是____。,,,,$\\pi r^2$,其中r是半径

【正确示例 - 多题库】
bank_id,bank,type,content,A,B,C,D,answer,explanation
7b2e9f4c1a8d6e3b,物理学,single,牛顿第一定律又称？,惯性定律,力学定律,能量定律,动量定律,A,
7b2e9f4c1a8d6e3b,物理学,true_false,光速是宇宙中最快的速度。,,,,T,根据相对论
d5a8c3f1e9b7243a,英语四级,single,Apple的中文意思是？,香蕉,苹果,橙子,梨,B,


【常见错误】
❌ 缺少 bank_id 列
❌ bank_id 使用简单字符串（如 bank_001）而不是16位随机hex
❌ 同一题库的题目使用了不同的 bank_id
❌ bank_id 包含中文、特殊符号或大写字母
❌ 列名写成中文或大小写错误
❌ 选项包含 "A." 前缀
❌ 多选题答案写成 "A,B,C" 而不是 "ABC"
❌ 判断题答案写成 "对/错" 而不是 "T/F"
❌ 字段包含逗号但没用双引号包裹
❌ 第一行直接写题目而不是表头

【重要说明】
- **为每个题库生成一个全球唯一的 bank_id**：使用16位随机十六进制数字（如 a3f7b8c9d2e14f6a）
- **生成方法**：调用你的 UUID 生成功能，确保每个题库的 ID 都是独一无二的随机值
- 同一题库的所有题目必须共享完全相同的 bank_id
- bank_id 一旦生成就永远不要修改，即使题库名称改变
- 16位hex格式示例："a3f7b8c9d2e14f6a"（全部小写，只包含0-9和a-f）

请严格按照以上格式输出，不要添加任何 Markdown 代码块标记，直接输出纯文本 CSV 内容。`;
                                await Clipboard.setStringAsync(prompt);
                                Alert.alert('已复制', 'AI 整理指令已复制到剪贴板\\n\\n使用步骤：\\n1. 将指令发送给 AI（如 ChatGPT）\\n2. 将您的题目粘贴在指令下方\\n3. 复制 AI 返回的 CSV 内容\\n4. 返回本应用，在"粘贴代码导入"中粘贴');
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
                        textColor={theme.colors.outline}
                    >
                        导入 LaTeX 公式演示题库
                    </Button>
                </View>

                <Portal>
                    <Modal visible={loading} dismissable={false} contentContainerStyle={[styles.loadingModal, { backgroundColor: theme.colors.elevation.level3 }]}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text variant="titleMedium" style={{ marginTop: 16, color: theme.colors.onSurface }}>正在飞速处理题库...</Text>
                        <Text variant="bodySmall" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
                            已完成 {Math.round(progress * 100)}%
                        </Text>
                        <ProgressBar progress={progress} style={{ width: 200, marginTop: 12, height: 6, borderRadius: 3 }} />
                    </Modal>
                </Portal>

                {error ? <HelperText type="error" visible={!!error} style={{ textAlign: 'center' }}>{error}</HelperText> : null}
            </View >
        </ScrollView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
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
    sectionTitle: { marginHorizontal: 12 },
    sectionDivider: { flex: 1, height: 1 },
    textInput: {
        fontSize: 13,
        paddingHorizontal: 0,
    },
    footer: { marginTop: 16, alignItems: 'center', paddingBottom: 40 },
    loadingModal: {
        padding: 32,
        margin: 40,
        borderRadius: 28,
        alignItems: 'center',
    }
});
