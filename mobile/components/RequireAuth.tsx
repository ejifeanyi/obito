// src/components/RequireAuth.tsx
import { useEffect } from "react";
import { View, Text } from "react-native";
import { router, usePathname } from "expo-router";
import { useAuth } from "@/context/AuthContext";

type RequireAuthProps = {
	children: React.ReactNode;
};

const RequireAuth = ({ children }: RequireAuthProps) => {
	const { authState } = useAuth();
	const pathname = usePathname();

	useEffect(() => {
		if (!authState.isLoading && !authState.user) {
			// Store the current path to redirect back after authentication
			router.replace({
				pathname: "/sign-in",
				params: { redirect: pathname },
			});
		}
	}, [authState.user, authState.isLoading, pathname]);

	if (authState.isLoading) {
		return (
			<View className="flex-1 bg-white justify-center items-center">
				<Text>Loading...</Text>
			</View>
		);
	}

	if (!authState.user) {
		return null;
	}

	return <>{children}</>;
};

export default RequireAuth;
