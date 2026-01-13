import React, { useEffect } from 'react';
import { View } from 'react-native';
import { PaperProvider, IconButton } from 'react-native-paper';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { theme } from './src/theme/theme';
import { initDatabase } from './src/db/database';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import ImportScreen from './src/screens/ImportScreen';
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

const Stack = createNativeStackNavigator();
const Tab = createMaterialTopTabNavigator();

function MainTabs() {
    const insets = useSafeAreaInsets();
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
                    // Using Icon from paper instead of IconButton to avoid extra padding
                    return <IconButton icon={iconName} size={22} iconColor={color} style={{ margin: 0, padding: 0, height: 24, width: 24 }} />;
                },
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: 'gray',
                tabBarIndicatorStyle: { height: 0 }, // Hide top indicator for bottom tabs
                tabBarLabelStyle: { fontSize: 11, fontWeight: '500', margin: 0, paddingBottom: 2 },
                tabBarStyle: {
                    backgroundColor: theme.colors.surface,
                    height: 60 + (insets.bottom > 0 ? insets.bottom - 10 : 0),
                    paddingBottom: insets.bottom > 0 ? insets.bottom - 10 : 0,
                    borderTopWidth: 0.5,
                    borderTopColor: '#e0e0e0',
                },
                tabBarItemStyle: {
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: 60,
                },
                tabBarShowIcon: true,
                tabBarShowLabel: true,
                swipeEnabled: false, // Turn off swipe between tabs to favor vertical scrolling
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
    useEffect(() => {
        initDatabase();
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <PaperProvider theme={theme}>
                    <NavigationContainer>
                        <Stack.Navigator id="RootStack">
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
                                                        onPress={() => navigation.navigate('Import')}
                                                    />
                                                </View>
                                            );
                                        }
                                        return null;
                                    }
                                })}
                            />
                            <Stack.Screen name="Import" component={ImportScreen} options={{ title: '导入题库' }} />
                            <Stack.Screen name="QuizConfig" component={QuizConfigScreen} options={{ title: '刷题设置' }} />
                            <Stack.Screen name="Quiz" component={QuizScreen} options={{ title: '刷题' }} />
                            <Stack.Screen name="MockConfig" component={MockConfigScreen} options={{ title: '模拟考试设置' }} />
                            <Stack.Screen name="MockExam" component={MockExamScreen} options={{ title: '模拟考试', headerShown: false }} />
                            <Stack.Screen name="MockResult" component={MockResultScreen} options={{ title: '考试结果', headerShown: false }} />
                            <Stack.Screen name="Search" component={SearchScreen} options={{ title: '全局搜索' }} />
                            <Stack.Screen name="ManualAdd" component={ManualAddScreen} options={{ title: '手动添加题目' }} />
                            <Stack.Screen name="SrsReview" component={SrsReviewScreen} options={{ title: '今日复习' }} />
                        </Stack.Navigator>
                    </NavigationContainer>
                </PaperProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
