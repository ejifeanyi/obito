// app/(tabs)/groups.tsx
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useColorScheme } from "nativewind";
import { Stack } from "expo-router";

export default function GroupsScreen() {
	const { colorScheme } = useColorScheme();
	const isDark = colorScheme === "dark";

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<ScrollView
				className={`flex-1 ${
					isDark ? "bg-dark-background" : "bg-light-background"
				}`}
			>
				<View className="pt-16 px-4">
					<Text
						className={`text-3xl font-bold ${
							isDark ? "text-light-foreground" : "text-dark-foreground"
						}`}
					>
						Groups
					</Text>
					<Text
						className={`mt-2 ${
							isDark
								? "text-light-mutedForeground"
								: "text-dark-mutedForeground"
						}`}
					>
						Manage your groups
					</Text>

					{/* Add your groups screen content here */}
					<View className="mt-8">{/* Content goes here */}</View>
				</View>
			</ScrollView>
		</>
	);
}
