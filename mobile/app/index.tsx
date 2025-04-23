import { useAuth } from "@/context/AuthContext";
import { Redirect } from "expo-router";

const Page = () => {
	const { authState } = useAuth();

	if (authState) return <Redirect href="/(tabs)/dashboard" />;

	return <Redirect href="/(auth)/welcome" />;
};

export default Page;
