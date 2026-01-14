import { createContext, useContext } from 'react';
import { ThemeMode } from './theme';

export const ThemeContext = createContext<{
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    seedColor: string;
    setSeedColor: (color: string) => void;
}>({
    themeMode: 'system',
    setThemeMode: () => { },
    seedColor: '#6750A4',
    setSeedColor: () => { },
});

export const useAppTheme = () => useContext(ThemeContext);
