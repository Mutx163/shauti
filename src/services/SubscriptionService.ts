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

// Mirror helper
const getProxiedUrls = (url: string): string[] => {
    const urls: string[] = [];

    // 1. Handle Gist
    const gistMatch = url.match(/gist\.github\.com\/([^\/]+)\/([^\/]+)/);
    if (gistMatch) {
        const rawBase = `https://gist.githubusercontent.com/${gistMatch[1]}/${gistMatch[2]}/raw`;
        urls.push(`https://ghproxy.net/${rawBase}`);
        urls.push(`https://mirror.ghproxy.com/${rawBase}`);
        urls.push(`https://raw.gitmirror.com/${gistMatch[1]}/${gistMatch[2]}/raw`);
        urls.push(rawBase);
        return urls;
    }

    // 2. Handle GitHub Raw
    if (url.includes('raw.githubusercontent.com')) {
        urls.push(`https://ghproxy.net/${url}`);
        urls.push(`https://mirror.ghproxy.com/${url}`);
        urls.push(url.replace('raw.githubusercontent.com', 'raw.gitmirror.com'));
        urls.push(url);
        return urls;
    }

    // 3. Handle already proxied or other URLs
    if (url.startsWith('http')) {
        if (url.includes('ghproxy') || url.includes('gitmirror')) {
            urls.push(url);
        } else {
            urls.push(`https://ghproxy.net/${url}`);
            urls.push(url);
        }
    }

    return urls;
};

const fetchWithRetry = async (url: string) => {
    const urls = getProxiedUrls(url);
    let lastError;

    for (const tryUrl of urls) {
        try {
            console.log(`正在尝试获取: ${tryUrl}`);
            const response = await fetch(tryUrl);
            if (response.ok) return response;
            console.log(`获取失败 ${tryUrl}: ${response.status}`);
        } catch (e) {
            console.log(`网络连接错误 ${tryUrl}:`, e);
            lastError = e;
        }
    }
    throw lastError || new Error('All mirrors failed to fetch subscription');
};

const cleanOption = (text: string, label: string) => {
    if (!text) return '';
    // Matches "A.", "A ", "A、", "A．" at start (case insensitive)
    const regex = new RegExp(`^${label}[\\s\\.、．]*`, 'i');
    return text.replace(regex, '').trim();
};

const parseRow = (row: any): RemoteQuestion | null => {
    const content = row.question || row.content || row['题目'] || row['问题'] || '';
    if (!content || content === 'question' || content === '题目') return null;

    const optionsObj = {
        A: cleanOption(row.A || row.OptionA || '', 'A'),
        B: cleanOption(row.B || row.OptionB || '', 'B'),
        C: cleanOption(row.C || row.OptionC || '', 'C'),
        D: cleanOption(row.D || row.OptionD || '', 'D'),
    };

    const typeMapping: any = {
        '单选': 'single', '单选题': 'single', 'single': 'single',
        '多选': 'multi', '多选题': 'multi', 'multi': 'multi',
        '判断': 'true_false', '判断题': 'true_false', 'true_false': 'true_false',
        '填空': 'fill', '填空题': 'fill', 'fill': 'fill',
        '简答': 'short', '简答题': 'short', 'short': 'short'
    };

    return {
        type: typeMapping[row.type] || 'single',
        content: content,
        options: JSON.stringify(optionsObj),
        correct_answer: row.answer || row.correct_answer || '',
        explanation: row.explanation || row.analysis || ''
    };
};

const parseCsvToBanks = (csvContent: string, defaultName: string): Promise<RemoteBank[]> => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const banksMap = new Map<string, RemoteQuestion[]>();
                const orderedBanks: string[] = [];

                const firstRow: any = results.data[0] || {};
                const groupCol = Object.keys(firstRow).find(k => ['bank', 'Bank', '题库', 'category', 'Category', '分类'].includes(k));

                if (groupCol) {
                    results.data.forEach((row: any) => {
                        const bName = row[groupCol] || defaultName;
                        if (!banksMap.has(bName)) {
                            banksMap.set(bName, []);
                            orderedBanks.push(bName);
                        }
                        const q = parseRow(row);
                        if (q) banksMap.get(bName)?.push(q);
                    });
                } else {
                    let currentName = defaultName;
                    let part = 1;
                    let currentQs: RemoteQuestion[] = [];
                    banksMap.set(currentName, currentQs);
                    orderedBanks.push(currentName);

                    results.data.forEach((row: any) => {
                        // Header detection for concatenated files
                        if (row.id === 'id' || row.type === 'type' || row.question === 'question' || row.question === '题目') {
                            if (currentQs.length > 0) {
                                part++;
                                currentName = `${defaultName} (${part})`;
                                currentQs = [];
                                banksMap.set(currentName, currentQs);
                                orderedBanks.push(currentName);
                            }
                            return;
                        }
                        // ID Reset detection
                        if (row.id == '1' && currentQs.length >= 20) {
                            part++;
                            currentName = `${defaultName} ${part}`;
                            currentQs = [];
                            banksMap.set(currentName, currentQs);
                            orderedBanks.push(currentName);
                        }
                        const q = parseRow(row);
                        if (q) currentQs.push(q);
                    });
                }

                const banks: RemoteBank[] = [];
                let idx = 0;
                for (const bName of orderedBanks) {
                    const qs = banksMap.get(bName);
                    if (qs && qs.length > 0) {
                        idx++;
                        banks.push({
                            id: `csv_${idx}`, // temporary ID, will be prefixed or handled by _saveBanks logic
                            name: bName,
                            questions: qs
                        });
                    }
                }
                resolve(banks);
            },
            error: (err: any) => reject(err)
        });
    });
};

const fetchGistFiles = async (url: string, defaultName: string): Promise<RemoteBank[]> => {
    const gistMatch = url.match(/gist\.github\.com\/([^\/]+)\/([^\/]+)/);
    if (!gistMatch) return [];

    const gistId = gistMatch[2];
    const apiUrl = `https://api.github.com/gists/${gistId}`;

    console.log(`正在尝试通过 Gist API 获取列表: ${apiUrl}`);

    let response: any;
    let lastErr: any;
    // Simple retry for API
    for (let i = 0; i < 2; i++) {
        try {
            response = await fetch(apiUrl);
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
        const contentResponse = await fetchWithRetry(rawUrl);
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

export const SubscriptionService = {
    async addSubscription(url: string, name?: string) {
        const db = getDB();
        try {
            let banks: RemoteBank[] = [];

            // 1. Try Gist API multi-file discovery
            try {
                banks = await fetchGistFiles(url, name || '新订阅');
                if (banks.length > 0) console.log(`通过 Gist API 自动发现了 ${banks.length} 个题库`);
            } catch (e) {
                console.log('Gist API 自动发现失败（可能是网络原因），回退至原始链接模式', e);
            }

            // 2. Fallback to Single Raw Link
            if (banks.length === 0) {
                const response = await fetchWithRetry(url);
                const text = await response.text();
                try {
                    const json = JSON.parse(text);
                    banks = Array.isArray(json) ? json : (json.banks || []);
                } catch (e) {
                    try {
                        banks = await parseCsvToBanks(text, name || 'New Subscription');
                    } catch (csvErr) {
                        throw new Error('Invalid format: Not Valid JSON or CSV');
                    }
                }
            }

            if (!banks || banks.length === 0) throw new Error('未发现有效题目数据');

            const finalName = name || (banks.length === 1 ? banks[0].name : '新订阅');


            const result = await db.runAsync(
                'INSERT INTO subscriptions (url, name, last_updated, format) VALUES (?, ?, ?, ?)',
                url, finalName, new Date().toISOString(), banks[0].id?.startsWith('file') || banks[0].id?.startsWith('csv') ? 'csv' : 'json'
            );

            await this._saveBanks(result.lastInsertRowId, banks);

            return result.lastInsertRowId;
        } catch (e) {
            console.error('Failed to add subscription:', e);
            throw e;
        }
    },

    async getSubscriptions() {
        const db = getDB();
        return await db.getAllAsync('SELECT * FROM subscriptions ORDER BY id DESC');
    },

    async deleteSubscription(id: number) {
        const db = getDB();
        await db.runAsync('DELETE FROM question_banks WHERE subscription_id = ?', id);
        await db.runAsync('DELETE FROM subscriptions WHERE id = ?', id);
    },

    async syncSubscription(id: number) {
        const db = getDB();
        const sub: any = await db.getFirstAsync('SELECT * FROM subscriptions WHERE id = ?', id);
        if (!sub) throw new Error('找不到该订阅项');

        try {
            console.log(`正在同步订阅 ID: ${id}`);

            let banks: RemoteBank[] = [];
            let isFallback = false;

            // 1. Try Gist API
            try {
                banks = await fetchGistFiles(sub.url, sub.name);
            } catch (e) {
                console.log('Gist API 同步失败，尝试使用 Raw 模式同步', e);
            }

            // 2. Fallback
            if (banks.length === 0) {
                isFallback = true;
                const response = await fetchWithRetry(sub.url);
                const text = await response.text();
                try {
                    const json = JSON.parse(text);
                    banks = Array.isArray(json) ? json : (json.banks || []);
                } catch (e) {
                    banks = await parseCsvToBanks(text, sub.name || '订阅题库');
                }
            }

            await this._saveBanks(id, banks, isFallback);

            await db.runAsync(
                'UPDATE subscriptions SET last_updated = ? WHERE id = ?',
                new Date().toISOString(), id
            );
            return true;
        } catch (e) {
            console.error(`同步订阅 ${id} 失败:`, e);
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

    async autoSyncAll() {
        const db = getDB();
        try {
            const subs: any[] = await db.getAllAsync('SELECT id FROM subscriptions WHERE auto_update = 1');
            console.log(`正在启动增量同步 (共 ${subs.length} 个订阅)...`);
            let count = 0;
            for (const sub of subs) {
                try {
                    await this.syncSubscription(sub.id);
                    count++;
                } catch (e) {
                    console.log(`订阅 ${sub.id} 自动更新失败`, e);
                }
            }
            return count;
        } catch (e) {
            console.error('全局自动同步失败:', e);
            return 0;
        }
    },

    async _saveBanks(subscriptionId: number, banks: RemoteBank[], isFallback: boolean = false) {
        const db = getDB();

        // Safety: If banks list is totally empty, we shouldn't be here (caught earlier), 
        // but if it's suspicious, we log it.
        if (banks.length === 0) return;

        console.log(`正在为订阅 ${subscriptionId} 保存 ${banks.length} 个题库... ${isFallback ? '(回退模式)' : ''}`);

        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const syncDesc = `最后同步时间: ${timeStr}`;

        // Get current bank count to prevent accidental "shrinking"
        const existingBankCount: any = await db.getFirstAsync(
            'SELECT COUNT(*) as count FROM question_banks WHERE subscription_id = ?',
            subscriptionId
        );
        const currentCount = existingBankCount?.count || 0;

        // Cleanup stale banks for this subscription
        // Protection: 
        // 1. Never delete in fallback mode (prevents Gist single-file-only issue)
        // 2. If new list is shorter than old list, and we are NOT 100% sure (e.g. timeout happened), keep them.
        let shouldCleanBanks = !isFallback;
        if (shouldCleanBanks && banks.length < currentCount) {
            console.log(`检测到题库数量从 ${currentCount} 减少到 ${banks.length}，执行保守更新，跳过物理删除。`);
            shouldCleanBanks = false;
        }

        if (shouldCleanBanks) {
            const newRemoteIds = banks.map(b => b.id || b.name);
            const placeholders = newRemoteIds.map(() => '?').join(',');

            if (newRemoteIds.length > 0) {
                await db.runAsync(
                    `DELETE FROM question_banks WHERE subscription_id = ? AND remote_id NOT IN (${placeholders})`,
                    subscriptionId, ...newRemoteIds
                );
            }
        }

        for (const bank of banks) {
            const remoteId = bank.id || bank.name;
            const existing: any = await db.getFirstAsync(
                'SELECT id FROM question_banks WHERE subscription_id = ? AND remote_id = ?',
                subscriptionId, remoteId
            );

            let bankId = existing?.id;
            const bankDesc = syncDesc; // Always use sync time for subscription banks

            if (bankId) {
                await db.runAsync(
                    'UPDATE question_banks SET name = ?, description = ? WHERE id = ?',
                    bank.name, bankDesc, bankId
                );
            } else {
                const result = await db.runAsync(
                    'INSERT INTO question_banks (name, description, subscription_id, remote_id) VALUES (?, ?, ?, ?)',
                    bank.name, bankDesc, subscriptionId, remoteId
                );
                bankId = result.lastInsertRowId;
            }

            // Incremental Update for questions to preserve IDs (and thus progress/mastery)
            const existingQs: any[] = await db.getAllAsync('SELECT id, content FROM questions WHERE bank_id = ?', bankId);
            const contentToIdMap = new Map<string, number[]>();
            existingQs.forEach(q => {
                if (!contentToIdMap.has(q.content)) {
                    contentToIdMap.set(q.content, []);
                }
                contentToIdMap.get(q.content)?.push(q.id);
            });

            const keptIds = new Set<number>();
            for (const q of bank.questions) {
                let optionsStr = q.options;
                if (typeof q.options !== 'string') {
                    optionsStr = JSON.stringify(q.options);
                }

                const ids = contentToIdMap.get(q.content);
                const existingId = ids && ids.length > 0 ? ids.shift() : null;

                if (existingId) {
                    await db.runAsync(
                        `UPDATE questions SET type = ?, options = ?, correct_answer = ?, explanation = ? 
                         WHERE id = ?`,
                        q.type, optionsStr, q.correct_answer, q.explanation || '', existingId
                    );
                    keptIds.add(existingId);
                } else {
                    await db.runAsync(
                        `INSERT INTO questions (bank_id, type, content, options, correct_answer, explanation)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        bankId, q.type, q.content, optionsStr, q.correct_answer, q.explanation || ''
                    );
                }
            }

            // Delete questions that no longer exist in the remote bank
            const staleIds = existingQs.map(q => q.id).filter(id => !keptIds.has(id));
            if (staleIds.length > 0) {
                const placeholders = staleIds.map(() => '?').join(',');
                await db.runAsync(
                    `DELETE FROM questions WHERE id IN (${placeholders})`,
                    ...staleIds
                );
            }
        }
    }
};
