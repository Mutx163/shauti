/**
 * 将时间戳转换为相对时间描述
 * @param timestamp ISO 时间字符串或时间戳
 * @returns 相对时间描述，如"刚刚"、"3分钟前"、"2小时前"
 */
export function getRelativeTime(timestamp: string | number | Date): string {
    const now = new Date().getTime();
    const time = new Date(timestamp).getTime();

    if (isNaN(time)) {
        return '';
    }

    const diff = now - time;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 60) {
        return '刚刚';
    } else if (minutes < 60) {
        return `${minutes}分钟前`;
    } else if (hours < 24) {
        return `${hours}小时前`;
    } else if (days < 30) {
        return `${days}天前`;
    } else if (months < 12) {
        return `${months}个月前`;
    } else {
        return `${years}年前`;
    }
}

/**
 * 生成带相对时间的同步描述
 */
export function getSyncDescription(timestamp?: string | Date): string {
    if (!timestamp) {
        return '未同步';
    }

    const relativeTime = getRelativeTime(timestamp);
    return `题库最后更新为${relativeTime}`;
}
