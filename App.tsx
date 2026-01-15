import React, { useEffect, useState, useMemo } from 'react';
import { View, useColorScheme } from 'react-native';
import { PaperProvider, IconButton, useTheme } from 'react-native-paper';
import { NavigationContainer, getFocusedRouteNameFromRoute, DefaultTheme as NavigationDefaultTheme, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { StatusBar } from 'expo-status-bar';
import { lightTheme, darkTheme, eyeProtectionTheme, ThemeMode } from './src/theme/theme';
import { initDatabase } from './src/db/database';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SubscriptionService } from './src/services/SubscriptionService';
import { SettingsManager } from './src/utils/settings';

import { ThemeContext } from './src/theme/ThemeContext';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import AddBankScreen from './src/screens/AddBankScreen';
import QuizScreen from './src/screens/QuizScreen';
import QuizConfigScreen from './src/screens/QuizConfigScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MistakeScreen from './src/screens/MistakeScreen';
import MockConfigScreen from './src/screens/MockConfigScreen';
import MockExamScreen from './src/screens/MockExamScreen';
import MockResultScreen from './src/screens/MockResultScreen';
import SearchScreen from './src/screens/SearchScreen';
import StatsScreen from './src/screens/StatsScreen';
import ManualAddScreen from './src/screens/ManualAddScreen';
import SrsReviewScreen from './src/screens/SrsReviewScreen';
import MasteryListScreen from './src/screens/MasteryListScreen';

const Stack = createNativeStackNavigator();
const Tab = createMaterialTopTabNavigator();

function MainTabs() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    return (
        <Tab.Navigator
            id="MainTabs"
            tabBarPosition="bottom"
            initialLayout={{ width: 0 }}
            screenOptions={({ route }) => ({
                tabBarIcon: ({ color }) => {
                    let iconName: string = 'home';
                    if (route.name === 'PracticeTab') iconName = 'book-open-page-variant';
                    else if (route.name === 'StatsTab') iconName = 'chart-bar';
                    else if (route.name === 'SettingsTab') iconName = 'cog';
                    return <IconButton icon={iconName} size={22} iconColor={color} style={{ margin: 0, padding: 0, height: 24, width: 24 }} />;
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.onSurfaceVariant,
                tabBarIndicatorStyle: { height: 0 },
                tabBarLabelStyle: { fontSize: 11, fontWeight: '500', margin: 0, paddingBottom: 2 },
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    height: 60 + (insets.bottom > 0 ? insets.bottom - 10 : 0),
                    paddingBottom: insets.bottom > 0 ? insets.bottom - 10 : 0,
                    borderTopWidth: 0.5,
                    borderTopColor: colors.outlineVariant,
                    elevation: 0,
                    shadowOpacity: 0,
                },
                tabBarItemStyle: {
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: 60,
                },
                tabBarShowIcon: true,
                tabBarShowLabel: true,
                swipeEnabled: false,
            })}
        >
            <Tab.Screen
                name="HomeTab"
                component={HomeScreen}
                options={{ title: '首页' }}
            />
            <Tab.Screen name="PracticeTab" component={MistakeScreen} options={{ title: '练习' }} />
            <Tab.Screen name="StatsTab" component={StatsScreen} options={{ title: '统计' }} />
            <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: '设置' }} />
        </Tab.Navigator>
    );
}

function getHeaderTitle(route: any) {
    const routeName = getFocusedRouteNameFromRoute(route) ?? 'HomeTab';
    switch (routeName) {
        case 'HomeTab':
            return '刷题宝';
        case 'PracticeTab':
            return '练习中心';
        case 'StatsTab':
            return '数据统计';
        case 'SettingsTab':
            return '设置';
    }
}

export default function App() {
    const [dbReady, setDbReady] = useState(false);
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
    const [seedColor, setSeedColorState] = useState('#6750A4');
    const colorScheme = useColorScheme();

    useEffect(() => {
        const init = async () => {
            try {
                await initDatabase();
                const savedTheme = await SettingsManager.getThemeMode();
                const savedColor = await SettingsManager.getSeedColor();
                setThemeModeState(savedTheme);
                setSeedColorState(savedColor);
                setDbReady(true);
            } catch (e) {
                console.error('Database initialization failed:', e);
            }
        };
        init();
    }, []);

    const setThemeMode = async (mode: ThemeMode) => {
        setThemeModeState(mode);
        await SettingsManager.setThemeMode(mode);
    };

    const setSeedColor = async (color: string) => {
        setSeedColorState(color);
        await SettingsManager.setSeedColor(color);
    };

    const currentTheme = useMemo(() => {
        let baseTheme;
        if (themeMode === 'eye') {
            baseTheme = eyeProtectionTheme;
        } else if (themeMode === 'dark' || (themeMode === 'system' && colorScheme === 'dark')) {
            baseTheme = darkTheme;
        } else {
            baseTheme = lightTheme;
        }

        // Apply custom seed color if not in eye protection mode
        if (themeMode !== 'eye') {
            return {
                ...baseTheme,
                colors: {
                    ...baseTheme.colors,
                    primary: seedColor,
                }
            };
        }
        return baseTheme;
    }, [themeMode, colorScheme, seedColor]);

    const navigationTheme = useMemo(() => {
        const isDark = themeMode === 'dark' || (themeMode === 'system' && colorScheme === 'dark');
        const base = isDark ? NavigationDarkTheme : NavigationDefaultTheme;
        return {
            ...base,
            colors: {
                ...base.colors,
                primary: currentTheme.colors.primary,
                background: currentTheme.colors.background,
                card: currentTheme.colors.surface,
                text: currentTheme.colors.onSurface,
                border: currentTheme.colors.outlineVariant,
                notification: currentTheme.colors.error,
            },
        };
    }, [currentTheme, themeMode, colorScheme]);

    if (!dbReady) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <ThemeContext.Provider value={{ themeMode, setThemeMode, seedColor, setSeedColor }}>
                    <PaperProvider theme={currentTheme}>
                        <StatusBar style={themeMode === 'dark' || (themeMode === 'system' && colorScheme === 'dark') ? 'light' : 'dark'} />
                        <NavigationContainer theme={navigationTheme}>
                            <Stack.Navigator
                                id="RootStack"
                                screenOptions={{
                                    headerShadowVisible: false,
                                }}
                            >
                                <Stack.Screen
                                    name="Main"
                                    component={MainTabs}
                                    options={({ navigation, route }) => ({
                                        headerTitle: getHeaderTitle(route),
                                        headerRight: () => {
                                            const routeName = getFocusedRouteNameFromRoute(route) ?? 'HomeTab';
                                            if (routeName === 'HomeTab') {
                                                return (
                                                    <View style={{ flexDirection: 'row' }}>
                                                        <IconButton
                                                            icon="magnify"
                                                            onPress={() => navigation.navigate('Search')}
                                                        />
                                                        <IconButton
                                                            icon="plus-circle-outline"
                                                            onPress={() => navigation.navigate('AddBank')}
                                                        />
                                                    </View>
                                                );
                                            }
                                            return null;
                                        }
                                    })}
                                />
                                <Stack.Screen name="AddBank" component={AddBankScreen} options={{ title: '题库添加中心' }} />
                                <Stack.Screen name="QuizConfig" component={QuizConfigScreen} options={{ title: '刷题设置' }} />
                                <Stack.Screen name="Quiz" component={QuizScreen} options={{ title: '刷题' }} />
                                <Stack.Screen name="MockConfig" component={MockConfigScreen} options={{ title: '模拟考试设置' }} />
                                <Stack.Screen name="MockExam" component={MockExamScreen} options={{ title: '模拟考试', headerShown: false }} />
                                <Stack.Screen name="MockResult" component={MockResultScreen} options={{ title: '考试结果', headerShown: false }} />
                                <Stack.Screen name="Search" component={SearchScreen} options={{ title: '全局搜索' }} />
                                <Stack.Screen name="ManualAdd" component={ManualAddScreen} options={{ title: '手动添加题目' }} />
                                <Stack.Screen name="SrsReview" component={SrsReviewScreen} options={{ title: '今日复习' }} />
                                <Stack.Screen name="MasteryList" component={MasteryListScreen} options={({ route }: any) => ({ title: route.params?.bankName || '掌握清单' })} />
                            </Stack.Navigator>
                        </NavigationContainer>
                    </PaperProvider>
                </ThemeContext.Provider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
