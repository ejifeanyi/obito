// src/app/(app)/home.tsx
import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
	const { authState, signOut } = useAuth();

	return (
		<View className="flex-1 justify-center items-center bg-white p-4">
			<Text className="text-2xl font-bold mb-4">Welcome to the App!</Text>

			{authState.user && (
				<View className="bg-gray-100 p-4 rounded-lg w-full mb-8">
					<Text className="text-lg mb-2">User Profile:</Text>
					<Text>
						Name: {authState.user.firstName} {authState.user.lastName}
					</Text>
					<Text>Email: {authState.user.email}</Text>
				</View>
			)}

			<TouchableOpacity
				className="bg-red-500 py-3 px-6 rounded-lg"
				onPress={signOut}
			>
				<Text className="text-white font-medium">Sign Out</Text>
			</TouchableOpacity>
		</View>
	);
}
