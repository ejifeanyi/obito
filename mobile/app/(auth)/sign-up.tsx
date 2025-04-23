// src/app/sign-up.tsx
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, ScrollView, Text, View } from "react-native";
import Modal from "react-native-modal";
import { useMutation } from "@tanstack/react-query";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
// import OAuth from "@/components/OAuth";
import { icons, images } from "@/constants";
import { useAuth, SignUpData } from "@/context/AuthContext";

const SignUp = () => {
	const { signUp, authState } = useAuth();
	const [showSuccessModal, setShowSuccessModal] = useState(false);

	const [form, setForm] = useState<SignUpData>({
		firstName: "",
		lastName: "",
		email: "",
		password: "",
	});

	// Use TanStack Query for sign up mutation
	const signUpMutation = useMutation({
		mutationFn: (userData: SignUpData) => signUp(userData),
		onSuccess: () => {
			setShowSuccessModal(true);
		},
		onError: (error: any) => {
			Alert.alert(
				"Signup Failed",
				error.response?.data?.error || "An error occurred during registration"
			);
		},
	});

	// Redirect to home if already authenticated
	useEffect(() => {
		if (authState.user && !authState.isLoading && !signUpMutation.isPending) {
			router.replace("/(tabs)/dashboard");
		}
	}, [authState.user, authState.isLoading]);

	const onSignUpPress = () => {
		// Basic validation
		if (!form.firstName || !form.lastName || !form.email || !form.password) {
			Alert.alert("Error", "Please fill in all fields");
			return;
		}

		// Execute the mutation
		signUpMutation.mutate(form);
	};

	const navigateToHome = () => {
		setShowSuccessModal(false);
		router.replace("/(tabs)/dashboard");
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
						Create Your Account
					</Text>
				</View>
				<View className="p-5">
					<InputField
						label="First Name"
						placeholder="Enter first name"
						icon={icons.person}
						value={form.firstName}
						onChangeText={(value) => setForm({ ...form, firstName: value })}
					/>
					<InputField
						label="Last Name"
						placeholder="Enter last name"
						icon={icons.person}
						value={form.lastName}
						onChangeText={(value) => setForm({ ...form, lastName: value })}
					/>
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
						title={signUpMutation.isPending ? "Signing Up..." : "Sign Up"}
						onPress={onSignUpPress}
						className="mt-6"
						disabled={signUpMutation.isPending}
					/>
					{/* <OAuth /> */}
					<Link
						href="/sign-in"
						className="text-lg text-center text-general-200 mt-10"
					>
						Already have an account?{" "}
						<Text className="text-primary-500">Log In</Text>
					</Link>
				</View>

				<Modal
					isVisible={showSuccessModal}
					onBackdropPress={() => setShowSuccessModal(false)}
				>
					<View className="bg-white px-7 py-9 rounded-2xl min-h-[300px]">
						<Image
							source={images.check}
							className="w-[110px] h-[110px] mx-auto my-5"
						/>
						<Text className="text-3xl font-JakartaBold text-center">
							Success!
						</Text>
						<Text className="text-base text-gray-400 font-Jakarta text-center mt-2">
							You have successfully created your account.
						</Text>
						<CustomButton
							title="Go to Home"
							onPress={navigateToHome}
							className="mt-5"
						/>
					</View>
				</Modal>
			</View>
		</ScrollView>
	);
};

export default SignUp;
