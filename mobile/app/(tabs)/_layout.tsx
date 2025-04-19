// app/(tabs)/_layout.tsx
import React from "react";
import { View, Platform } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Home, UsersRound, UserCircle } from "lucide-react-native";
import { useColorScheme } from "nativewind";

export default function TabsLayout() {
	const { colorScheme } = useColorScheme();
	const isDark = colorScheme === "dark";

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarStyle: {
					position: "absolute",
					bottom: Platform.OS === "ios" ? 24 : 16,
					left: 20,
					right: 20,
					elevation: 0,
					borderRadius: 24,
					height: 64,
					backgroundColor: "transparent",
					borderTopWidth: 0,
				},
				tabBarBackground: () => (
					<BlurView
						tint={isDark ? "dark" : "light"}
						intensity={80}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							borderRadius: 24,
							overflow: "hidden",
						}}
					>
						<View
							className={`absolute inset-0 ${
								isDark ? "bg-dark-background/50" : "bg-light-background/50"
							} rounded-3xl`}
						/>
					</BlurView>
				),
				tabBarActiveTintColor: isDark
					? "hsl(217.2 91.2% 59.8%)"
					: "hsl(221.2 83.2% 53.3%)",
				tabBarInactiveTintColor: isDark
					? "hsl(215 20.2% 65.1%)"
					: "hsl(215.4 16.3% 46.9%)",
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Home",
					tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
					tabBarLabelStyle: { fontWeight: "500" },
				}}
			/>
			<Tabs.Screen
				name="groups"
				options={{
					title: "Groups",
					tabBarIcon: ({ color, size }) => (
						<UsersRound size={size} color={color} />
					),
					tabBarLabelStyle: { fontWeight: "500" },
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: "Profile",
					tabBarIcon: ({ color, size }) => (
						<UserCircle size={size} color={color} />
					),
					tabBarLabelStyle: { fontWeight: "500" },
				}}
			/>
		</Tabs>
	);
}
