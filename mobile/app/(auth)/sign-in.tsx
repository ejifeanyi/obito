// src/app/sign-in.tsx
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useMutation } from "@tanstack/react-query";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
// import OAuth from "@/components/OAuth";
import { icons } from "@/constants";
import { useAuth } from "@/context/AuthContext";

const SignIn = () => {
	const { signIn, authState } = useAuth();

	const [form, setForm] = useState({
		email: "",
		password: "",
	});

	// Use TanStack Query for sign in mutation
	const signInMutation = useMutation({
		mutationFn: (credentials: { email: string; password: string }) =>
			signIn(credentials.email, credentials.password),
		onSuccess: () => {
			router.replace("/(tabs)/dashboard");
		},
		onError: (error: any) => {
			Alert.alert(
				"Login Failed",
				error.response?.data?.error || "Invalid credentials"
			);
		},
	});

	// Redirect to home if already authenticated
	useEffect(() => {
		if (authState.user && !authState.isLoading && !signInMutation.isPending) {
			router.replace("/(tabs)/dashboard");
		}
	}, [authState.user, authState.isLoading]);

	const onSignInPress = () => {
		// Basic validation
		if (!form.email || !form.password) {
			Alert.alert("Error", "Please enter email and password");
			return;
		}

		// Execute the mutation
		signInMutation.mutate(form);
	};

	if (authState.isLoading) {
		return (
			<View className="flex-1 bg-white justify-center items-center">
				<Text>Loading...</Text>
			</View>
		);
	}

	return (
		<ScrollView className="flex-1 bg-white">
			<View className="flex-1 bg-white">
				<View className="relative w-full h-[250px]">
					<Text className="text-2xl text-black font-JakartaSemiBold absolute bottom-5 left-5">
						Welcome Back
					</Text>
				</View>
				<View className="p-5">
					<InputField
						label="Email"
						placeholder="Enter email"
						icon={icons.email}
						textContentType="emailAddress"
						value={form.email}
						onChangeText={(value) => setForm({ ...form, email: value })}
						keyboardType="email-address"
						autoCapitalize="none"
					/>
					<InputField
						label="Password"
						placeholder="Enter password"
						icon={icons.lock}
						secureTextEntry={true}
						textContentType="password"
						value={form.password}
						onChangeText={(value) => setForm({ ...form, password: value })}
					/>
					<CustomButton
						title={signInMutation.isPending ? "Signing In..." : "Sign In"}
						onPress={onSignInPress}
						className="mt-6"
						disabled={signInMutation.isPending}
					/>
					{/* <OAuth /> */}
					<Link
						href="/sign-up"
						className="text-lg text-center text-general-200 mt-10"
					>
						Don't have an account?{" "}
						<Text className="text-primary-500">Sign Up</Text>
					</Link>
				</View>
			</View>
		</ScrollView>
	);
};

export default SignIn;
