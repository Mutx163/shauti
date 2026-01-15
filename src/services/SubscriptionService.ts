import { getDB } from '../db/database';
import Papa from 'papaparse';

interface RemoteQuestion {
    type: 'single' | 'multi' | 'true_false' | 'fill' | 'short';
    content: string;
    options: any; // Can be array or string in JSON
    correct_answer: string;
    explanation?: string;
}

interface RemoteBank {
    id?: string; // remote_id
    name: string;
    description?: string;
    questions: RemoteQuestion[];
}

// 备用镜像源（仅在直连失败时使用）
const FALLBACK_MIRRORS = [
    'https://ghproxy.net/',
];

// 记录失效的镜像（整个会话期间有效）
let failedMirrors = new Set<string>();

/**
 * 带超时的 fetch
 */
const fetchWithTimeout = async (url: string, timeout = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
};

/**
 * 从 URL 中提取可能的文件名作为默认题库名称
 */
const getNameFromUrl = (url: string): string => {
    try {
        const decoded = decodeURIComponent(url);
        const parts = decoded.split('/');
        const lastPart = parts[parts.length - 1];
        const cleanName = lastPart.split('?')[0].split('#')[0].replace(/\.(csv|json|txt)$/i, '');
        return cleanName || '未命名订阅';
    } catch (e) {
        return '未命名订阅';
    }
};

/**
 * 智能拉取：优先直连，失败时使用镜像
 */
const fetchWithRetry = async (url: string, verbose = false) => {
    // 1. 首先尝试直连（对于中国用户，GitHub Raw 可能可以访问）
    try {
        const response = await fetchWithTimeout(url, 6000);
        if (response.ok) return response;
    } catch (e) {
        // 直连失败，尝试镜像
    }

    // 2. 尝试镜像
    for (const mirror of FALLBACK_MIRRORS) {
        if (failedMirrors.has(mirror)) continue;

        const mirrorUrl = `${mirror}${url}`;
        try {
            const response = await fetchWithTimeout(mirrorUrl, 6000);
            if (response.ok) {
                if (verbose) console.log(`[Sync] 使用镜像成功`);
                return response;
            }
        } catch (e) {
            failedMirrors.add(mirror);
        }
    }

    // 3. 最后再尝试一次直连（可能是临时网络问题）
    const finalResponse = await fetchWithTimeout(url, 10000);
    if (finalResponse.ok) return finalResponse;

    throw new Error(`拉取失败: ${url}`);
};


const cleanOption = (text: string, label: string) => {
    if (!text) return '';
    // Matches "A.", "A ", "A、", "A．" at start (case insensitive)
    const regex = new RegExp(`^${label}[\\s\\.、．]*`, 'i');
    return text.replace(regex, '').trim();
};

// 题目类型映射表
const TYPE_MAPPING: Record<string, string> = {
    'single': 'single', '单选': 'single', '单选题': 'single',
    'multi': 'multi', '多选': 'multi', '多选题': 'multi',
    'true_false': 'true_false', '判断': 'true_false', '判断题': 'true_false',
    'fill': 'fill', '填空': 'fill', '填空题': 'fill',
    'short': 'short', '简答': 'short', '简答题': 'short'
};

// 从 CSV 行中查找指定列的值
const findRowValue = (row: any, keys: string[]) => {
    const foundKey = Object.keys(row).find(k => keys.includes(k.replace(/^\uFEFF/, '').trim()));
    return foundKey ? row[foundKey] : undefined;
};

// 解析选项 A/B/C/D
const parseOptions = (row: any) => ({
    A: cleanOption(findRowValue(row, ['A', 'OptionA']) || '', 'A'),
    B: cleanOption(findRowValue(row, ['B', 'OptionB']) || '', 'B'),
    C: cleanOption(findRowValue(row, ['C', 'OptionC']) || '', 'C'),
    D: cleanOption(findRowValue(row, ['D', 'OptionD']) || '', 'D'),
});

// 修正判断题列错位：如果 D 列是 T/F 且 answer 列是解析内容
const fixTrueFalseColumnShift = (options: any, rawAnswer: string, rawExpl: string) => {
    const dValue = (options.D || '').toString().trim().toUpperCase();
    const isTF = ['T', 'F', 'TRUE', 'FALSE', '正确', '错误', '对', '错'].includes(dValue);

    if (isTF && rawAnswer && rawAnswer.length > 10) {
        return { answer: dValue, explanation: rawAnswer, options: { ...options, D: '' } };
    }
    return { answer: rawAnswer, explanation: rawExpl, options };
};

// 解析 CSV 行为远程题目对象
const parseRow = (row: any): RemoteQuestion | null => {
    const content = findRowValue(row, ['content', 'question', '题目']) || '';
    if (!content || ['content', 'question', '题目'].includes(content)) return null;

    let options = parseOptions(row);
    const rawType = findRowValue(row, ['type', '类型']) || 'single';
    const questionType = TYPE_MAPPING[rawType] || 'single';

    let rawAnswer = findRowValue(row, ['answer', 'correct_answer', '答案']) || '';
    let rawExplanation = findRowValue(row, ['explanation', 'analysis', '解析']) || '';

    // 判断题特殊处理
    if (questionType === 'true_false') {
        const fixed = fixTrueFalseColumnShift(options, rawAnswer, rawExplanation);
        rawAnswer = fixed.answer;
        rawExplanation = fixed.explanation;
        options = fixed.options;
    }

    return {
        type: questionType as RemoteQuestion['type'],
        content,
        options: JSON.stringify(options),
        correct_answer: rawAnswer.toString().trim(),
        explanation: (rawExplanation || '').toString().trim()
    };
};


const parseCsvToBanks = (csvContent: string, defaultName: string): Promise<RemoteBank[]> => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.replace(/^\uFEFF/, '').trim(),
            transform: (value: any) => typeof value === 'string' ? value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim() : value,
            complete: (results) => {
                const banksMap = new Map<string, { name: string; questions: RemoteQuestion[] }>();
                const orderedBanks: string[] = [];

                const firstRow: any = results.data[0] || {};
                const groupCol = Object.keys(firstRow).find(k => ['bank', 'Bank', '题库', 'category', 'Category', '分类'].includes(k));
                const idCol = Object.keys(firstRow).find(k => ['bank_id', 'BankId', '题库ID'].includes(k));

                if (groupCol || idCol) {
                    // 有分组列或ID列的情况
                    results.data.forEach((row: any) => {
                        // 优先使用 bank_id，否则使用 bank 列
                        const bankId = idCol ? (row[idCol] || `bank_${Date.now()}`) : (row[groupCol] || defaultName);
                        const bankName = groupCol ? (row[groupCol] || defaultName) : defaultName;

                        if (!banksMap.has(bankId)) {
                            banksMap.set(bankId, { name: bankName, questions: [] });
                            orderedBanks.push(bankId);
                        }
                        const q = parseRow(row);
                        if (q) banksMap.get(bankId)?.questions.push(q);
                    });
                } else {
                    let currentName = defaultName;
                    let part = 1;
                    let currentBankId = `csv_1`;
                    let currentQs: RemoteQuestion[] = [];

                    banksMap.set(currentBankId, { name: currentName, questions: currentQs });
                    orderedBanks.push(currentBankId);

                    results.data.forEach((row: any) => {
                        // Header detection for concatenated files
                        if (row.id === 'id' || row.type === 'type' || row.question === 'question' || row.question === '题目') {
                            if (currentQs.length > 0) {
                                part++;
                                currentName = `${defaultName} (${part})`;
                                currentBankId = `csv_${part}`;
                                currentQs = [];
                                banksMap.set(currentBankId, { name: currentName, questions: currentQs });
                                orderedBanks.push(currentBankId);
                            }
                            return;
                        }
                        const q = parseRow(row);
                        if (q) currentQs.push(q);
                    });
                }

                const banks: RemoteBank[] = [];
                for (const bankId of orderedBanks) {
                    const bankData = banksMap.get(bankId);
                    if (bankData && bankData.questions.length > 0) {
                        banks.push({
                            id: bankId,
                            name: bankData.name,
                            questions: bankData.questions
                        });
                    }
                }
                resolve(banks);
            },
            error: (err: any) => reject(err)
        });
    });
};

const fetchGistFiles = async (url: string, defaultName: string, verbose = false): Promise<RemoteBank[]> => {
    const gistMatch = url.match(/gist\.github\.com\/([^\/]+)\/([^\/]+)/);
    if (!gistMatch) return [];

    const gistId = gistMatch[2];
    const apiUrl = `https://api.github.com/gists/${gistId}`;

    if (verbose) console.log(`正在通过 Gist API 获取列表: ${apiUrl}`);

    let response: any;
    let lastErr: any;
    // Simple retry for API
    for (let i = 0; i < 2; i++) {
        try {
            response = await fetchWithTimeout(apiUrl, 5000);
            if (response.ok) break;
        } catch (e) {
            lastErr = e;
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    if (!response || !response.ok) {
        throw new Error(`Gist API 获取失败: ${response?.status || '网络超时'}`);
    }

    const json = await response.json();
    if (!json.files) return [];

    const allBanks: RemoteBank[] = [];
    let fileIdx = 0;

    for (const filename of Object.keys(json.files)) {
        fileIdx++;
        const fileData = json.files[filename];
        const rawUrl = fileData.raw_url;

        // Use proxy for raw content
        const contentResponse = await fetchWithRetry(rawUrl, verbose);
        const text = await contentResponse.text();

        let fileBanks: RemoteBank[] = [];

        // Naive type check
        if (filename.endsWith('.json')) {
            try {
                const parsed = JSON.parse(text);
                fileBanks = Array.isArray(parsed) ? parsed : (parsed.banks || []);
            } catch (e) { console.warn(`Failed to parse JSON ${filename}`); }
        } else {
            // CSV (or other text)
            // Remove extension for bank name usually, but we use filename
            const bankName = filename.replace(/\.(csv|txt)$/i, '');
            fileBanks = await parseCsvToBanks(text, bankName);
        }

        // Add to result, ensuring IDs are unique if we combine multiple files
        fileBanks.forEach(b => {
            // Prefix ID with file index to avoid collisions e.g. csv_1 in both files
            if (b.id?.startsWith('csv_')) {
                b.id = `file${fileIdx}_${b.id}`;
            } else {
                b.id = `file${fileIdx}_${b.name}`; // Ensure unique remote_id
            }
            allBanks.push(b);
        });
    }

    return allBanks;
};

// 容错型 JSON 解析
const safeJsonParse = (str: string) => {
    try {
        // 1. 清除 Unicode BOM 和首尾空白
        let clean = str.trim().replace(/^\uFEFF/, '');
        // 2. 移除数组或对象末尾的非法逗号 (Trailing Commas)
        clean = clean.replace(/,\s*([\]}])/g, '$1');
        return JSON.parse(clean);
    } catch (e) {
        throw e;
    }
};

// --- 全局默认题库配置 (Gist GitHub) ---
// 用户自定义官方清单地址。程序会自动寻找 Gist 中的第一个 JSON 文件作为清单。
const OFFICIAL_GIST_URL = 'https://gist.github.com/Mutx163/08251a9e7a4e9942b4e0a89c972f3641';

// 模块级同步锁与时间戳
let isSyncInProgress = false;
let lastGlobalSyncTime = 0;
const GLOBAL_SYNC_COOLDOWN = 60 * 60 * 1000; // 1 小时冷却期

// 状态监听
type SyncListener = (isSyncing: boolean) => void;
const syncListeners = new Set<SyncListener>();

const notifySyncStatus = (status: boolean) => {
    isSyncInProgress = status;
    syncListeners.forEach(l => l(status));
};

export const SubscriptionService = {
    subscribe(listener: SyncListener) {
        syncListeners.add(listener);
        listener(isSyncInProgress);
        return () => syncListeners.delete(listener);
    },

    isSyncing() {
        return isSyncInProgress;
    },
    /**
     * 同步全球官方/默认题库清单
     * @param force 是否强制跳过冷却期与缓存 (通常用于下拉刷新)
     */
    async syncGlobalSubscriptions(force: boolean = false) {
        if (!OFFICIAL_GIST_URL || OFFICIAL_GIST_URL.includes('username')) return;

        // 1. 排他锁检查
        if (isSyncInProgress) {
            return;
        }

        // 2. 冷却期检查 (静默模式下)
        const now = Date.now();
        if (!force && (now - lastGlobalSyncTime < GLOBAL_SYNC_COOLDOWN)) {
            // 静默跳过，无日志干扰
            return;
        }

        notifySyncStatus(true);
        // 开启新任务前，清空失效黑名单
        if (force) failedMirrors.clear();

        try {

            let config: any = null;
            let sourceFile = 'unknown';

            // 构造带随机参数的缓存击穿 URL
            const getBustedUrl = (url: string) => force ? `${url}${url.includes('?') ? '&' : '?'}t=${now}` : url;

            // 1. 尝试 Gist API 智能识别 (带局部保护)
            const gistMatch = OFFICIAL_GIST_URL.match(/gist\.github\.com\/([^\/]+)\/([^\/]+)/);
            if (gistMatch) {
                const gistUser = gistMatch[1];
                const gistId = gistMatch[2];
                let apiSuccess = false;

                try {
                    const apiUrl = getBustedUrl(`https://api.github.com/gists/${gistId}`);
                    const apiRes = await fetchWithTimeout(apiUrl, 5000);

                    if (apiRes.ok) {
                        const gistData = await apiRes.json();
                        const files: any[] = Object.values(gistData.files);
                        const configFile: any = gistData.files['manifest.json'] ||
                            files.find((f: any) => f.filename.endsWith('.json')) ||
                            files[0];

                        if (configFile) {
                            sourceFile = configFile.filename;
                            const contentRes = await fetchWithRetry(getBustedUrl(configFile.raw_url), force);
                            const rawText = await contentRes.text();
                            config = safeJsonParse(rawText);
                            apiSuccess = true;
                        }
                    } else if (apiRes.status === 403) {
                        console.warn('[GlobalSync] Gist API 限流 (403)，切换至 Raw URL 模式');
                    }
                } catch (apiErr: any) {
                    console.warn('[GlobalSync] Gist API 请求失败:', apiErr);
                }

                // 2. API 失败后的 Raw URL 降级策略
                if (!apiSuccess && !config) {
                    // 尝试构建直链: gist.githubusercontent.com/user/id/raw/manifest.json
                    // 注意：如果不指定文件名，raw 可能会重定向到第一个文件，通常也是可行的
                    const rawBase = `https://gist.githubusercontent.com/${gistUser}/${gistId}/raw`;
                    const tryUrls = [
                        `${rawBase}/manifest.json`, // 优先尝试标准命名
                        rawBase                     // 兜底尝试默认文件
                    ];

                    for (const rawUrl of tryUrls) {
                        try {
                            const targetUrl = getBustedUrl(rawUrl);
                            if (force) console.log(`[GlobalSync] 尝试 Raw URL 降级: ${targetUrl}`);

                            const response = await fetchWithRetry(targetUrl, force);
                            if (response.ok) {
                                const text = await response.text();
                                // 验证是否为 HTML (Gist 404 页或其他错误页)
                                if (text.trim().startsWith('<')) continue;

                                config = safeJsonParse(text);
                                if (config) {
                                    sourceFile = rawUrl.split('/').pop() || 'raw';
                                    break;
                                }
                            }
                        } catch (e) { /* continue */ }
                    }
                }
            }

            if (!config) throw new Error('未能加载配置');

            const subs: { url: string; name: string }[] = config.official_subscriptions || [];
            if (subs.length === 0) return;

            const db = getDB();
            const existingSubs: any[] = await db.getAllAsync('SELECT url FROM subscriptions');
            const existingUrlSet = new Set(existingSubs.map(s => s.url));

            for (const subItem of subs) {
                try {
                    if (!existingUrlSet.has(subItem.url)) {
                        await this.addSubscription(subItem.url, subItem.name, 1);
                    } else {
                        await db.runAsync('UPDATE subscriptions SET is_official = 1 WHERE url = ?', subItem.url);
                        // 无需在这里强制 syncSubscription，由 autoSyncAll 统一处理以复用锁
                    }
                } catch (subErr) { }
            }

            lastGlobalSyncTime = now;
            if (force) console.log(`[GlobalSync] 清单同步完成`);
        } catch (e) {
            if (force) console.error('[GlobalSync] 强制同步失败:', e);
        } finally {
            notifySyncStatus(false);
        }
    },

    async addSubscription(url: string, name: string, isOfficial: number = 0) {
        const db = getDB();
        try {
            // 首先检查是否已存在
            const existing: any = await db.getFirstAsync('SELECT id FROM subscriptions WHERE url = ?', url);
            if (existing) {
                // 如果已存在，更新其名称（如果有提供）和官方标识
                await db.runAsync(
                    'UPDATE subscriptions SET name = COALESCE(?, name), is_official = MAX(is_official, ?), last_updated = CURRENT_TIMESTAMP WHERE id = ?',
                    name, isOfficial, existing.id
                );
                // 移除此处的 syncSubscription。由调用者或 autoSyncAll 统一触发同步任务。
                return existing.id;
            }

            // 新增订阅
            const result = await db.runAsync(
                'INSERT INTO subscriptions (url, name, last_updated, is_official) VALUES (?, ?, CURRENT_TIMESTAMP, ?)',
                url, name || getNameFromUrl(url), isOfficial
            );
            return result.lastInsertRowId;
        } catch (e) {
            console.error('[Sync] 订阅添加失败:', e);
            throw e;
        }
    },

    async getSubscriptions(includeOfficial: boolean = false) {
        const db = getDB();
        try {
            const sql = includeOfficial
                ? 'SELECT * FROM subscriptions ORDER BY last_updated DESC'
                : 'SELECT * FROM subscriptions WHERE is_official = 0 ORDER BY last_updated DESC';
            return await db.getAllAsync(sql);
        } catch (e) {
            console.error('Failed to get subscriptions:', e);
            return [];
        }
    },

    async deleteSubscription(id: number) {
        const db = getDB();
        await db.runAsync('DELETE FROM question_banks WHERE subscription_id = ?', id);
        await db.runAsync('DELETE FROM subscriptions WHERE id = ?', id);
    },

    async syncSubscription(id: number, force: boolean = false) {
        const db = getDB();
        const sub: any = await db.getFirstAsync('SELECT * FROM subscriptions WHERE id = ?', id);
        if (!sub) return;

        try {
            if (force) console.log(`[Sync] 正在刷新: ${sub.name || sub.url}`);

            let banks: RemoteBank[] = [];
            let isFallback = false;

            // 1. Try Gist API
            try {
                banks = await fetchGistFiles(sub.url, sub.name, force);
            } catch (e: any) {
                if (force) console.log(`[Sync] Gist API 失败(${id}):`, e.message);
            }

            // 2. Fallback to Raw URL
            if (banks.length === 0) {
                isFallback = true;

                // 从 Gist URL 构建 Raw URL
                let rawUrl = sub.url;
                const gistMatch = sub.url.match(/gist\.github\.com\/([^\/]+)\/([a-f0-9]+)/i);
                if (gistMatch) {
                    rawUrl = `https://gist.githubusercontent.com/${gistMatch[1]}/${gistMatch[2]}/raw`;
                }

                const response = await fetchWithRetry(rawUrl, force);
                const text = await response.text();
                try {
                    const json = JSON.parse(text);
                    banks = Array.isArray(json) ? json : (json.banks || []);
                } catch (e) {
                    banks = await parseCsvToBanks(text, sub.name || getNameFromUrl(sub.url));
                }
            }

            await this._saveBanks(id, banks, isFallback, force);

            await db.runAsync(
                'UPDATE subscriptions SET last_updated = ? WHERE id = ?',
                new Date().toISOString(), id
            );
            return true;
        } catch (e) {
            if (force) console.error(`[Sync] 订阅重试失败(${id}):`, e);
            throw e;
        }
    },

    async toggleAutoUpdate(id: number, enabled: boolean) {
        const db = getDB();
        await db.runAsync(
            'UPDATE subscriptions SET auto_update = ? WHERE id = ?',
            enabled ? 1 : 0, id
        );
    },

    async autoSyncAll(force: boolean = false) {
        if (isSyncInProgress) {
            return 0;
        }

        notifySyncStatus(true);
        const db = getDB();
        try {
            const subs: any[] = await db.getAllAsync('SELECT id FROM subscriptions WHERE auto_update = 1');
            if (force) console.log(`[Sync] 准备刷新自选订阅 (共 ${subs.length} 项)...`);

            let count = 0;
            for (const sub of subs) {
                try {
                    await this.syncSubscription(sub.id, force);
                    count++;
                } catch (e) {
                    // Fail silently for background, log for manual
                }
            }
            return count;
        } finally {
            notifySyncStatus(false);
        }
    },

    /**
     * 同步单个题库的题目（增量更新以保留 ID 和进度）
     * @returns 是否有变化
     */
    async _syncQuestionsForBank(db: any, bankId: number, questions: RemoteQuestion[]): Promise<boolean> {
        const existingQs: any[] = await db.getAllAsync(
            'SELECT id, content, type, options, correct_answer, explanation FROM questions WHERE bank_id = ?',
            bankId
        );

        // 建立 content -> questions 映射
        const contentToIdMap = new Map<string, any[]>();
        existingQs.forEach(q => {
            if (!contentToIdMap.has(q.content)) contentToIdMap.set(q.content, []);
            contentToIdMap.get(q.content)?.push(q);
        });

        const keptIds = new Set<number>();
        let hasChanges = false;

        for (const q of questions) {
            if (!q || !q.content) continue;

            const optionsStr = typeof q.options === 'string' ? q.options : JSON.stringify(q.options || {});
            const match = contentToIdMap.get(q.content);
            const existingQ = match && match.length > 0 ? match.shift() : null;

            if (existingQ) {
                // 检查是否有变化
                if (existingQ.type !== q.type || existingQ.options !== optionsStr ||
                    existingQ.correct_answer !== q.correct_answer ||
                    existingQ.explanation !== (q.explanation || '')) {
                    hasChanges = true;
                }
                await db.runAsync(
                    `UPDATE questions SET type = ?, options = ?, correct_answer = ?, explanation = ? WHERE id = ?`,
                    q.type, optionsStr, q.correct_answer || '', q.explanation || '', existingQ.id
                );
                keptIds.add(existingQ.id);
            } else {
                hasChanges = true;
                await db.runAsync(
                    `INSERT INTO questions (bank_id, type, content, options, correct_answer, explanation) VALUES (?, ?, ?, ?, ?, ?)`,
                    bankId, q.type, q.content, optionsStr, q.correct_answer, q.explanation || ''
                );
            }
        }

        // 删除已移除的题目
        const orphanIds = existingQs.map(q => q.id).filter(id => !keptIds.has(id));
        if (orphanIds.length > 0) {
            hasChanges = true;
            await db.runAsync(`DELETE FROM questions WHERE id IN (${orphanIds.map(() => '?').join(',')})`, ...orphanIds);
        }

        return hasChanges;
    },

    async _saveBanks(subscriptionId: number, banks: RemoteBank[], isFallback: boolean = false, verbose: boolean = false) {
        const db = getDB();
        if (banks.length === 0) return;

        if (verbose) console.log(`[Sync] 保存订阅 ${subscriptionId}: ${banks.length} 个题库 ${isFallback ? '(回退模式)' : ''}`);

        // 存储 ISO 时间戳，以便显示时动态计算相对时间
        const syncDesc = new Date().toISOString();


        // Get current bank count to prevent accidental "shrinking"
        const existingBankCount: any = await db.getFirstAsync(
            'SELECT COUNT(*) as count FROM question_banks WHERE subscription_id = ?',
            subscriptionId
        );
        const currentCount = existingBankCount?.count || 0;

        // Cleanup stale banks for this subscription
        // 严格同步策略：订阅源有什么，本地就有什么
        // 只在回退模式下跳过删除（防止 Gist 单文件模式误删）
        let shouldCleanBanks = !isFallback;

        if (shouldCleanBanks) {
            const newRemoteIds = banks.map(b => b.id || b.name);
            const placeholders = newRemoteIds.map(() => '?').join(',');

            if (newRemoteIds.length > 0) {
                // 删除订阅源中不存在的题库
                await db.runAsync(
                    `DELETE FROM question_banks WHERE subscription_id = ? AND remote_id NOT IN (${placeholders})`,
                    subscriptionId, ...newRemoteIds
                );
                if (verbose) console.log(`[Sync] 清理过期题库...`);
            } else {
                // 订阅源没有任何题库，删除所有本地关联题库
                await db.runAsync(
                    'DELETE FROM question_banks WHERE subscription_id = ?',
                    subscriptionId
                );
                if (verbose) console.log(`[Sync] 订阅源为空，已清空本地关联`);
            }

            for (const bank of banks) {
                const remoteId = bank.id || bank.name;

                const existing: any = await db.getFirstAsync(
                    'SELECT id, name, description FROM question_banks WHERE subscription_id = ? AND remote_id = ?',
                    subscriptionId, remoteId
                );

                let bankId: number;
                let hasChanges = false;

                if (existing) {
                    bankId = existing.id;

                    // 检测题库名称是否变化
                    if (existing.name !== bank.name) {
                        hasChanges = true;
                    }

                    // 检测题目数量和内容是否变化
                    const existingQuestionCount: any = await db.getFirstAsync(
                        'SELECT COUNT(*) as count FROM questions WHERE bank_id = ?',
                        bankId
                    );

                    if (existingQuestionCount.count !== bank.questions.length) {
                        hasChanges = true;
                    }

                    // 只有发生变化时才更新，并更新时间戳
                    if (hasChanges) {
                        const syncDesc = new Date().toISOString();
                        await db.runAsync(
                            'UPDATE question_banks SET name = ?, description = ? WHERE id = ?',
                            bank.name, syncDesc, bankId
                        );
                    } else {
                        // 没有变化，只更新名称（以防名称更新），保持原时间戳
                        await db.runAsync(
                            'UPDATE question_banks SET name = ? WHERE id = ?',
                            bank.name, bankId
                        );
                    }
                } else {
                    // 新题库，设置初始时间戳
                    hasChanges = true;
                    const syncDesc = new Date().toISOString();
                    const result: any = await db.runAsync(
                        'INSERT INTO question_banks (name, description, subscription_id, remote_id) VALUES (?, ?, ?, ?)',
                        bank.name, syncDesc, subscriptionId, remoteId
                    );
                    bankId = result.lastInsertRowId;
                }

                // 使用辅助函数处理题目同步
                const questionsChanged = await this._syncQuestionsForBank(db, bankId, bank.questions);

                // 如果题目层发生了变化，更新题库的时间戳
                if (questionsChanged && !hasChanges) {
                    await db.runAsync(
                        'UPDATE question_banks SET description = ? WHERE id = ?',
                        new Date().toISOString(), bankId
                    );
                }
            } // end for bank of banks
        } // end if shouldCleanBanks
    }, // end _saveBanks
}; // end SubscriptionService
