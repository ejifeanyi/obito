import RequireAuth from "@/components/RequireAuth";
import { Stack } from "expo-router";

export default function RootLayout() {
	return (
		<RequireAuth>
			<Stack>
				<Stack.Screen name="home" options={{ headerShown: false }} />
				{/* <Stack.Screen name="(auth)" options={{ headerShown: false }} />
				<Stack.Screen name="(root)" options={{ headerShown: false }} />
				<Stack.Screen name="+not-found" /> */}
			</Stack>
		</RequireAuth>
	);
}
