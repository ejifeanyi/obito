import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";

import "./globals.css";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const [loaded] = useFonts({
		Jakarta: require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
		"Jakarta-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
		"Jakarta-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
		"Jakarta-ExtraLight": require("../assets/fonts/PlusJakartaSans-ExtraLight.ttf"),
		"Jakarta-Light": require("../assets/fonts/PlusJakartaSans-Light.ttf"),
		"Jakarta-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
		"Jakarta-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
	});

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: 2,
				staleTime: 5 * 60 * 1000, // 5 minutes
			},
		},
	});

	useEffect(() => {
		if (loaded) {
			SplashScreen.hideAsync();
		}
	}, [loaded]);

	if (!loaded) {
		return null;
	}

	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<Stack>
					<Stack.Screen name="index" options={{ headerShown: false }} />
					<Stack.Screen name="(auth)" options={{ headerShown: false }} />
					<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
					<Stack.Screen name="+not-found" />
				</Stack>
			</AuthProvider>
		</QueryClientProvider>
	);
}
