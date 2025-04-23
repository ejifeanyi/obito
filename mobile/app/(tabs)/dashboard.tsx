import React, { useEffect, useState } from "react";
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	RefreshControl,
	ActivityIndicator,
	SafeAreaView,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { classNames } from "@/utils/index";
import axios from "axios";
import { router } from "expo-router";
import {
	Ionicons,
	MaterialCommunityIcons,
	FontAwesome5,
} from "@expo/vector-icons";

// Types for dashboard data
type DashboardSummary = {
	totalOwed: number;
	totalOwes: number;
	netBalance: number;
};

type DashboardInsight = {
	message: string;
	type: "info" | "warning" | "success";
};

type DashboardActivity = {
	id: string;
	description: string;
	category: string;
	date: string;
	groupName: string;
	amount: number;
	userShare: number;
	paidBy: {
		id: string;
		firstName: string;
		lastName: string;
	};
	isPayer: boolean;
	impact: number;
};

type DashboardData = {
	summary: DashboardSummary;
	insights: DashboardInsight[];
	recentActivity: DashboardActivity[];
	groups: { id: string; name: string }[];
};

const Dashboard = () => {
	const { authState, signOut } = useAuth();
	const [dashboardData, setDashboardData] = useState<DashboardData | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchDashboardData = async (showRefreshing = false) => {
		try {
			if (showRefreshing) {
				setIsRefreshing(true);
			} else {
				setIsLoading(true);
			}
			setError(null);

			const response = await axios.get(
				"https://obito-ixea.onrender.com/api/dashboard/"
			);

			setDashboardData(response.data);
		} catch (error) {
			console.error("Dashboard data fetch error:", error);
			setError("Failed to load dashboard data");
		} finally {
			setIsLoading(false);
			setIsRefreshing(false);
		}
	};

	useEffect(() => {
		if (authState.accessToken) {
			fetchDashboardData();
		}
	}, [authState.accessToken]);

	const onRefresh = () => {
		fetchDashboardData(true);
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 2,
		}).format(amount);
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
		}).format(date);
	};

	if (isLoading) {
		return (
			<SafeAreaView className="flex-1 bg-secondary-100">
				<View className="flex-1 justify-center items-center">
					<ActivityIndicator size="large" color="#F6B32B" />
					<Text className="mt-4 text-secondary-700 font-JakartaMedium">
						Loading your dashboard...
					</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (error) {
		return (
			<SafeAreaView className="flex-1 bg-secondary-100">
				<View className="flex-1 justify-center items-center p-6">
					<MaterialCommunityIcons
						name="alert-circle-outline"
						size={56}
						color="#F56565"
					/>
					<Text className="mt-4 text-danger-500 font-JakartaSemiBold text-lg text-center">
						{error}
					</Text>
					<TouchableOpacity
						className="mt-6 bg-primary-500 py-3 px-6 rounded-full"
						onPress={() => fetchDashboardData()}
					>
						<Text className="text-white font-JakartaBold text-center">
							Try Again
						</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView className="flex-1 bg-secondary-100">
			<ScrollView
				className="flex-1"
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
				}
			>
				{/* Header */}
				<View className="px-5 pt-4 flex-row justify-between items-center">
					<View>
						<Text className="text-gray-700 font-JakartaMedium text-2xl">
							Hi, {authState.user?.firstName}
						</Text>
					</View>
					<TouchableOpacity
						className="h-10 w-10 rounded-full bg-yellow-100 justify-center items-center"
						onPress={() => signOut()}
					>
						<Ionicons name="log-out-outline" size={20} color="#4D4D4D" />
					</TouchableOpacity>
				</View>

				{/* Balance Card */}
				<View className="mx-5 mt-6 bg-yellow-300 rounded-3xl p-5">
					<Text className="text-gray-700 font-JakartaMedium text-xl">
						Your Balance
					</Text>
					<Text className="text-gray-900 text-3xl font-JakartaBold mt-1">
						{formatCurrency(dashboardData?.summary.netBalance || 0)}
					</Text>

					<View className="flex-row mt-4 justify-between">
						<View className="flex-1 pr-2">
							<View className="flex-row items-center">
								<Ionicons name="arrow-down" size={20} color="#38A169" />
								<Text className="ml-1 text-gray-700 font-JakartaMedium text-md">
									You're owed
								</Text>
							</View>
							<Text className="text-green-500 font-JakartaSemiBold mt-1 text-xl">
								{formatCurrency(dashboardData?.summary.totalOwed || 0)}
							</Text>
						</View>

						<View className="flex-1">
							<View className="flex-row items-center">
								<Ionicons name="arrow-up" size={20} color="#E53E3E" />
								<Text className="ml-1 text-gray-700 font-JakartaMedium text-md">
									You owe
								</Text>
							</View>
							<Text className="text-red-500 font-JakartaSemiBold mt-1 text-xl">
								{formatCurrency(dashboardData?.summary.totalOwes || 0)}
							</Text>
						</View>
					</View>
				</View>

				{/* Quick Actions */}
				<View className="mt-6 px-5">
					<View className="flex-row justify-between gap-4">
						<TouchableOpacity
							className="bg-white h-24 flex-1 rounded-3xl items-center justify-center"
							onPress={() => router.push("/new-expense")}
						>
							<View className="bg-yellow-100 p-2 rounded-full">
								<MaterialCommunityIcons name="currency-usd" size={24} />
							</View>
							<Text className="mt-2 text-gray-800 font-JakartaMedium text-sm">
								Add Expense
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							className="bg-white h-24 flex-1 rounded-3xl items-center justify-center"
							onPress={() => router.push("/create-group")}
						>
							<View className="bg-yellow-100 p-2 rounded-full">
								<Ionicons name="people" size={24} />
							</View>
							<Text className="mt-2 text-secondary-800 font-JakartaMedium text-sm">
								Create Group
							</Text>
						</TouchableOpacity>
					</View>
				</View>

				{/* Insights */}
				<View className="mt-6 px-5">
					<Text className="text-gray-700 text-lg font-JakartaSemiBold mb-3">
						Insights
					</Text>

					{dashboardData?.insights && dashboardData.insights.length > 0 ? (
						dashboardData.insights.map((insight, index) => (
							<View
								key={index}
								className={classNames(
									"p-4 rounded-lg mb-3",
									insight.type === "info"
										? "bg-general-600"
										: insight.type === "warning"
										? "bg-warning-100"
										: "bg-success-100"
								)}
							>
								<View className="flex-row items-center">
									<View
										className={classNames(
											"w-8 h-8 rounded-full justify-center items-center",
											insight.type === "info"
												? "bg-blue-100"
												: insight.type === "warning"
												? "bg-warning-200"
												: "bg-success-200"
										)}
									>
										<Ionicons
											name={
												insight.type === "info"
													? "information-circle"
													: insight.type === "warning"
													? "alert-circle"
													: "checkmark-circle"
											}
											size={20}
											color={
												insight.type === "info"
													? "#3182CE"
													: insight.type === "warning"
													? "#EAB308"
													: "#38A169"
											}
										/>
									</View>
									<Text className="ml-3 font-JakartaMedium text-secondary-800 flex-1">
										{insight.message}
									</Text>
								</View>
							</View>
						))
					) : (
						<View className="bg-general-600 p-4 rounded-lg">
							<Text className="text-secondary-700 font-JakartaMedium">
								No insights available at this time.
							</Text>
						</View>
					)}
				</View>

				{/* Groups */}
				<View className="mt-6 px-5">
					<View className="flex-row justify-between items-center mb-3">
						<Text className="text-gray-700 text-lg font-JakartaSemiBold">
							Your Groups
						</Text>
						<TouchableOpacity onPress={() => router.push("/groups")}>
							<Text className="text-yellow-500 font-JakartaMedium">
								See all
							</Text>
						</TouchableOpacity>
					</View>

					{/* Check if user has any groups */}
					{dashboardData?.groups && dashboardData.groups.length > 0 ? (
						<View>
							{dashboardData.groups.slice(0, 3).map((group) => (
								<TouchableOpacity
									key={group.id}
									className="bg-white p-4 rounded-lg mb-3 flex-row items-center shadow"
									onPress={() => router.push(`/groups/${group.id}`)}
								>
									<View className="h-10 w-10 rounded-full bg-primary-100 justify-center items-center">
										<Text className="font-JakartaSemiBold text-primary-500">
											{group.name.substring(0, 1).toUpperCase()}
										</Text>
									</View>
									<View className="ml-3 flex-1">
										<Text className="font-JakartaSemiBold text-secondary-800">
											{group.name}
										</Text>
									</View>
									<Ionicons name="chevron-forward" size={20} color="#AAAAAA" />
								</TouchableOpacity>
							))}
						</View>
					) : (
						<View className="bg-white p-6 rounded-lg items-center shadow">
							<MaterialCommunityIcons
								name="account-group"
								size={48}
								color="#D9D9D9"
							/>
							<Text className="mt-2 text-secondary-700 font-JakartaMedium text-center">
								You're not part of any groups yet
							</Text>
							<TouchableOpacity
								className="mt-4 bg-primary-500 py-2 px-6 rounded-full"
								onPress={() => router.push("/create-group")}
							>
								<Text className="text-white font-JakartaBold">
									Create a Group
								</Text>
							</TouchableOpacity>
						</View>
					)}
				</View>

				{/* Recent Activity */}
				<View className="mt-6 px-5 mb-8">
					<Text className="text-secondary-800 font-JakartaSemiBold mb-3">
						Recent Activity
					</Text>

					{dashboardData?.recentActivity &&
					dashboardData.recentActivity.length > 0 ? (
						dashboardData.recentActivity.map((activity) => (
							<View
								key={activity.id}
								className="bg-white p-4 rounded-lg mb-3 shadow"
							>
								<View className="flex-row justify-between">
									<View className="flex-row items-center flex-1">
										<View className="h-10 w-10 rounded-full bg-secondary-200 justify-center items-center">
											<FontAwesome5
												name={
													activity.category === "Food"
														? "utensils"
														: activity.category === "Transportation"
														? "car"
														: activity.category === "Housing"
														? "home"
														: activity.category === "Entertainment"
														? "film"
														: "receipt"
												}
												size={16}
												color="#666666"
											/>
										</View>
										<View className="ml-3 flex-1">
											<Text className="font-JakartaSemiBold text-secondary-800">
												{activity.description}
											</Text>
											<Text className="font-Jakarta text-xs text-secondary-500">
												{activity.groupName} • {formatDate(activity.date)}
											</Text>
										</View>
									</View>
									<View>
										<Text
											className={classNames(
												"font-JakartaSemiBold",
												activity.impact > 0
													? "text-success-600"
													: "text-danger-600"
											)}
										>
											{activity.impact > 0 ? "+" : ""}
											{formatCurrency(activity.impact)}
										</Text>
									</View>
								</View>
							</View>
						))
					) : (
						<View className="bg-white p-6 rounded-lg items-center shadow">
							<MaterialCommunityIcons
								name="history"
								size={48}
								color="#D9D9D9"
							/>
							<Text className="mt-2 text-secondary-700 font-JakartaMedium text-center">
								No recent activity to display
							</Text>
							<TouchableOpacity
								className="mt-4 bg-primary-500 py-2 px-6 rounded-full"
								onPress={() => router.push("/new-expense")}
							>
								<Text className="text-white font-JakartaBold">
									Add an Expense
								</Text>
							</TouchableOpacity>
						</View>
					)}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
};

export default Dashboard;
