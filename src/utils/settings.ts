import AsyncStorage from '@react-native-async-storage/async-storage';

export type AutoSkipMode = 'off' | 'correct_only' | '1s' | '2s' | '3s';

const SETTINGS_KEYS = {
    AUTO_SKIP_MODE: 'auto_skip_mode',
    AUTO_REMOVE_MISTAKE: 'auto_remove_mistake',
};

export class SettingsManager {
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
