import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';

// 基础浅色模式 (Material 3 Purple)
export const lightTheme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        primary: '#6750A4',
        onPrimary: '#FFFFFF',
        primaryContainer: '#EADDFF',
        onPrimaryContainer: '#21005D',
        secondary: '#625B71',
        onSecondary: '#FFFFFF',
        secondaryContainer: '#E8DEF8',
        onSecondaryContainer: '#1D192B',
        tertiary: '#7D5260',
        onTertiary: '#FFFFFF',
        tertiaryContainer: '#FFD8E4',
        onTertiaryContainer: '#31111D',
        background: '#FEF7FF',
        onBackground: '#1D1B20',
        surface: '#FEF7FF',
        onSurface: '#1D1B20',
        surfaceVariant: '#E7E0EB',
        onSurfaceVariant: '#49454F',
        outline: '#79747E',
    },
};

// 基础深色模式 (Material 3 Dark Purple)
export const darkTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        primary: '#D0BCFF',
        onPrimary: '#381E72',
        primaryContainer: '#4F378B',
        onPrimaryContainer: '#EADDFF',
        secondary: '#CCC2DC',
        onSecondary: '#332D41',
        secondaryContainer: '#4A4458',
        onSecondaryContainer: '#E8DEF8',
        tertiary: '#EFB8C8',
        onTertiary: '#492532',
        tertiaryContainer: '#633B48',
        onTertiaryContainer: '#FFD8E4',
        background: '#141218',
        onBackground: '#E6E1E5',
        surface: '#141218',
        onSurface: '#E6E1E5',
        surfaceVariant: '#49454F',
        onSurfaceVariant: '#CAC4D0',
        outline: '#938F99',
    },
};

// 护眼模式 (Soft Green/Sepia)
export const eyeProtectionTheme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        primary: '#006D3A',
        onPrimary: '#FFFFFF',
        primaryContainer: '#98F7B5',
        onPrimaryContainer: '#00210E',
        secondary: '#4F6354',
        onSecondary: '#FFFFFF',
        secondaryContainer: '#D2E8D5',
        onSecondaryContainer: '#0C1F13',
        background: '#F1F8E9', // 柔和的背景
        onBackground: '#191C19',
        surface: '#F1F8E9',
        onSurface: '#191C19',
        surfaceVariant: '#DDE5DA',
        onSurfaceVariant: '#414941',
        outline: '#717971',
    },
};

export type ThemeMode = 'light' | 'dark' | 'eye' | 'system';
