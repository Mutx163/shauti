import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useTheme } from 'react-native-paper';
import LocalImportTab from './LocalImportTab';
import OnlineSubscriptionTab from './OnlineSubscriptionTab';

const Tab = createMaterialTopTabNavigator();

export default function AddBankScreen() {
    const theme = useTheme();

    return (
        <Tab.Navigator
            id="AddBankTabs"
            screenOptions={{
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
                tabBarIndicatorStyle: { backgroundColor: theme.colors.primary, height: 3 },
                tabBarLabelStyle: { fontSize: 14, fontWeight: 'bold' },
                tabBarStyle: { backgroundColor: theme.colors.surface },
            }}
        >
            <Tab.Screen
                name="OnlineSubscription"
                component={OnlineSubscriptionTab}
                options={{ title: '在线订阅' }}
            />
            <Tab.Screen
                name="LocalImport"
                component={LocalImportTab}
                options={{ title: '本地导入' }}
            />
        </Tab.Navigator>
    );
}
