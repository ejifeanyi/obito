// app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";

export default function RootLayout() {
	const { colorScheme } = useColorScheme();
	const isDark = colorScheme === "dark";

	return (
		<>
			<StatusBar style={isDark ? "light" : "dark"} />
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: {
						backgroundColor: isDark ? "hsl(222.2 84% 4.9%)" : "hsl(0 0% 100%)",
					},
					// Add smooth transition animations
					animation: "slide_from_right",
				}}
			>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				{/* Add other non-tab screens here */}
			</Stack>
		</>
	);
}
