import AsyncStorage from '@react-native-async-storage/async-storage';

export type AutoSkipMode = 'off' | 'correct_only' | '1s' | '2s' | '3s';

const SETTINGS_KEYS = {
    AUTO_SKIP_MODE: 'auto_skip_mode',
    AUTO_REMOVE_MISTAKE: 'auto_remove_mistake',
    THEME_MODE: 'theme_mode',
    SEED_COLOR: 'seed_color',
};

export type ThemeMode = 'light' | 'dark' | 'eye' | 'system';

export class SettingsManager {
    static async getSeedColor(): Promise<string> {
        try {
            const value = await AsyncStorage.getItem(SETTINGS_KEYS.SEED_COLOR);
            return value || '#6750A4'; // Default M3 Purple
        } catch (error) {
            console.error('Failed to load seed color:', error);
            return '#6750A4';
        }
    }

    static async setSeedColor(color: string): Promise<void> {
        try {
            await AsyncStorage.setItem(SETTINGS_KEYS.SEED_COLOR, color);
        } catch (error) {
            console.error('Failed to save seed color:', error);
        }
    }
    static async getThemeMode(): Promise<ThemeMode> {
        try {
            const value = await AsyncStorage.getItem(SETTINGS_KEYS.THEME_MODE);
            return (value as ThemeMode) || 'system';
        } catch (error) {
            console.error('Failed to load theme mode:', error);
            return 'system';
        }
    }

    static async setThemeMode(mode: ThemeMode): Promise<void> {
        try {
            await AsyncStorage.setItem(SETTINGS_KEYS.THEME_MODE, mode);
        } catch (error) {
            console.error('Failed to save theme mode:', error);
        }
    }
    static async getAutoSkipMode(): Promise<AutoSkipMode> {
        try {
            const value = await AsyncStorage.getItem(SETTINGS_KEYS.AUTO_SKIP_MODE);
            return (value as AutoSkipMode) || 'off';
        } catch (error) {
            console.error('Failed to load auto skip mode:', error);
            return 'off';
        }
    }

    static async setAutoSkipMode(mode: AutoSkipMode): Promise<void> {
        try {
            await AsyncStorage.setItem(SETTINGS_KEYS.AUTO_SKIP_MODE, mode);
        } catch (error) {
            console.error('Failed to save auto skip mode:', error);
        }
    }

    static async getAutoRemoveMistake(): Promise<boolean> {
        try {
            const value = await AsyncStorage.getItem(SETTINGS_KEYS.AUTO_REMOVE_MISTAKE);
            return value !== 'false'; // Default to true if not set, or user preference
        } catch (error) {
            console.error('Failed to load auto remove mistake setting:', error);
            return true; // Default true
        }
    }

    static async setAutoRemoveMistake(enabled: boolean): Promise<void> {
        try {
            await AsyncStorage.setItem(SETTINGS_KEYS.AUTO_REMOVE_MISTAKE, String(enabled));
        } catch (error) {
            console.error('Failed to save auto remove mistake setting:', error);
        }
    }
}
