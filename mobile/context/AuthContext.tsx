// src/context/AuthContext.tsx
import {
	createContext,
	useState,
	useContext,
	useEffect,
	ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { router } from "expo-router";

// Define the API URL
const API_URL = "https://obito-ixea.onrender.com/api/auth";

// Define the User type
export type User = {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	profileImage?: string;
};

// Define the Auth State type
type AuthState = {
	user: User | null;
	accessToken: string | null;
	refreshToken: string | null;
	isLoading: boolean;
	error: string | null;
};

// Define the Auth Context type
type AuthContextType = {
	authState: AuthState;
	signUp: (userData: SignUpData) => Promise<void>;
	signIn: (email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
	refreshSession: () => Promise<boolean>;
	clearError: () => void;
};

// Define the Sign Up Data type
export type SignUpData = {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
};

// Create the Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider Props
type AuthProviderProps = {
	children: ReactNode;
};

// Create the Auth Provider
export const AuthProvider = ({ children }: AuthProviderProps) => {
	const [authState, setAuthState] = useState<AuthState>({
		user: null,
		accessToken: null,
		refreshToken: null,
		isLoading: true,
		error: null,
	});

	// Initialize auth state from storage
	useEffect(() => {
		const loadAuthState = async () => {
			try {
				const [accessToken, refreshToken, userJson] = await Promise.all([
					SecureStore.getItemAsync("accessToken"),
					SecureStore.getItemAsync("refreshToken"),
					SecureStore.getItemAsync("user"),
				]);

				if (accessToken && refreshToken && userJson) {
					const user = JSON.parse(userJson);
					setAuthState({
						user,
						accessToken,
						refreshToken,
						isLoading: false,
						error: null,
					});

					// Setup axios interceptor with the loaded token
					setupAxiosInterceptor(accessToken, refreshToken);
				} else {
					setAuthState((prev) => ({ ...prev, isLoading: false }));
				}
			} catch (error) {
				console.error("Error loading auth state:", error);
				setAuthState((prev) => ({
					...prev,
					isLoading: false,
					error: "Failed to load authentication state",
				}));
			}
		};

		loadAuthState();
	}, []);

	// Setup axios interceptor for token refresh
	const setupAxiosInterceptor = (accessToken: string, refreshToken: string) => {
		// Set default authorization header
		axios.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

		// Remove any existing interceptors
		axios.interceptors.response.eject(0);

		// Add response interceptor for token refresh
		axios.interceptors.response.use(
			(response) => response,
			async (error) => {
				const originalRequest = error.config;

				// If the error is 401 and we haven't retried yet
				if (error.response?.status === 401 && !originalRequest._retry) {
					originalRequest._retry = true;

					try {
						// Attempt to refresh the token
						const success = await refreshSession();

						if (success && authState.accessToken) {
							// Update the authorization header
							originalRequest.headers[
								"Authorization"
							] = `Bearer ${authState.accessToken}`;
							// Retry the original request
							return axios(originalRequest);
						}
					} catch (refreshError) {
						// If refresh fails, redirect to login
						await signOut();
						return Promise.reject(refreshError);
					}
				}

				return Promise.reject(error);
			}
		);
	};

	// Sign Up function
	const signUp = async (userData: SignUpData) => {
		try {
			setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

			const response = await axios.post(`${API_URL}/signup`, userData);

			const { user, tokens } = response.data;

			// Store tokens and user data in secure storage
			await SecureStore.setItemAsync("accessToken", tokens.accessToken);
			await SecureStore.setItemAsync("refreshToken", tokens.refreshToken);
			await SecureStore.setItemAsync("user", JSON.stringify(user));

			// Update auth state
			setAuthState({
				user,
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken,
				isLoading: false,
				error: null,
			});

			// Setup axios interceptor
			setupAxiosInterceptor(tokens.accessToken, tokens.refreshToken);
		} catch (error: any) {
			setAuthState((prev) => ({
				...prev,
				isLoading: false,
				error:
					error.response?.data?.error ||
					"An error occurred during registration",
			}));
			throw error;
		}
	};

	// Sign In function
	const signIn = async (email: string, password: string) => {
		try {
			setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

			const response = await axios.post(`${API_URL}/login`, {
				email,
				password,
			});

			const { user, tokens } = response.data;

			// Store tokens and user data in secure storage
			await SecureStore.setItemAsync("accessToken", tokens.accessToken);
			await SecureStore.setItemAsync("refreshToken", tokens.refreshToken);
			await SecureStore.setItemAsync("user", JSON.stringify(user));

			// Update auth state
			setAuthState({
				user,
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken,
				isLoading: false,
				error: null,
			});

			// Setup axios interceptor
			setupAxiosInterceptor(tokens.accessToken, tokens.refreshToken);
		} catch (error: any) {
			setAuthState((prev) => ({
				...prev,
				isLoading: false,
				error: error.response?.data?.error || "Invalid credentials",
			}));
			throw error;
		}
	};

	// Sign Out function
	const signOut = async () => {
		try {
			setAuthState((prev) => ({ ...prev, isLoading: true }));

			// Call logout endpoint if refresh token exists
			if (authState.refreshToken) {
				try {
					await axios.post(`${API_URL}/logout`, {
						refreshToken: authState.refreshToken,
					});
				} catch (error) {
					console.error("Error during logout:", error);
					// Continue with local logout even if API call fails
				}
			}

			// Clear secure storage
			await Promise.all([
				SecureStore.deleteItemAsync("accessToken"),
				SecureStore.deleteItemAsync("refreshToken"),
				SecureStore.deleteItemAsync("user"),
			]);

			// Reset auth state
			setAuthState({
				user: null,
				accessToken: null,
				refreshToken: null,
				isLoading: false,
				error: null,
			});

			// Clear authorization header
			delete axios.defaults.headers.common["Authorization"];

			// Navigate to sign in
			router.replace("/sign-in");
		} catch (error) {
			console.error("Error signing out:", error);
			setAuthState((prev) => ({
				...prev,
				isLoading: false,
				error: "Failed to sign out",
			}));
		}
	};

	// Refresh Session function
	const refreshSession = async (): Promise<boolean> => {
		try {
			if (!authState.refreshToken) {
				return false;
			}

			const response = await axios.post(`${API_URL}/refresh-token`, {
				refreshToken: authState.refreshToken,
			});

			const { user, tokens } = response.data;

			// Store new tokens
			await SecureStore.setItemAsync("accessToken", tokens.accessToken);
			await SecureStore.setItemAsync("refreshToken", tokens.refreshToken);
			await SecureStore.setItemAsync("user", JSON.stringify(user));

			// Update auth state
			setAuthState({
				user,
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken,
				isLoading: false,
				error: null,
			});

			// Update axios default header
			axios.defaults.headers.common[
				"Authorization"
			] = `Bearer ${tokens.accessToken}`;

			return true;
		} catch (error) {
			console.error("Error refreshing session:", error);
			await signOut();
			return false;
		}
	};

	// Clear error
	const clearError = () => {
		setAuthState((prev) => ({ ...prev, error: null }));
	};

	return (
		<AuthContext.Provider
			value={{
				authState,
				signUp,
				signIn,
				signOut,
				refreshSession,
				clearError,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
};

// Create a hook to use the auth context
export const useAuth = () => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};
