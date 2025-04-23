// src/context/AuthContext.tsx
import {
	createContext,
	useState,
	useContext,
	useEffect,
	ReactNode,
	useRef,
} from "react";
import * as SecureStore from "expo-secure-store";
import axios, { AxiosRequestConfig } from "axios";
import { router } from "expo-router";

// Extend AxiosRequestConfig to include _retry
declare module 'axios' {
	interface AxiosRequestConfig {
		_retry?: boolean;
	}
}

const API_URL = "https://obito-ixea.onrender.com/api/auth";

export type User = {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	profileImage?: string;
};

type AuthState = {
	user: User | null;
	accessToken: string | null;
	refreshToken: string | null;
	isLoading: boolean;
	error: string | null;
};

type AuthContextType = {
	authState: AuthState;
	signUp: (userData: SignUpData) => Promise<void>;
	signIn: (email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
	refreshSession: () => Promise<boolean>;
	clearError: () => void;
};

export type SignUpData = {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
};

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

	// Use a ref to track if we're currently refreshing to prevent infinite refresh loops
	const isRefreshing = useRef(false);
	// Track whether we should redirect on auth failure
	const shouldRedirectOnAuthFailure = useRef(true);
	// Track interceptor ID to properly remove it
	const interceptorId = useRef<number | null>(null);

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

		// Clean up the interceptor when the component unmounts
		return () => {
			if (interceptorId.current !== null) {
				axios.interceptors.response.eject(interceptorId.current);
			}
		};
	}, []);

	// Setup axios interceptor for token refresh
	const setupAxiosInterceptor = (accessToken: string, refreshToken: string) => {
		// Set default authorization header
		axios.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

		// Remove any existing interceptors
		if (interceptorId.current !== null) {
			axios.interceptors.response.eject(interceptorId.current);
		}

		// Add response interceptor for token refresh
		interceptorId.current = axios.interceptors.response.use(
			(response) => response,
			async (error) => {
				const originalRequest = error.config;

				// If the error is 401 and we haven't retried yet
				if (
					error.response?.status === 401 &&
					!originalRequest._retry &&
					authState.refreshToken &&
					!isRefreshing.current
				) {
					originalRequest._retry = true;
					isRefreshing.current = true;

					try {
						// Attempt to refresh the token
						const success = await refreshSession();

						if (success && authState.accessToken) {
							// Update the authorization header
							originalRequest.headers[
								"Authorization"
							] = `Bearer ${authState.accessToken}`;
							isRefreshing.current = false;
							// Retry the original request
							return axios(originalRequest);
						}
					} catch (refreshError) {
						isRefreshing.current = false;
						// If refresh fails, redirect to login if we should
						if (shouldRedirectOnAuthFailure.current) {
							console.log("Token refresh failed, redirecting to login");
							await signOut(false); // Don't trigger another redirect
							router.replace("/sign-in");
						}
						return Promise.reject(refreshError);
					}
				}

				// If we have a 401 and can't refresh, redirect to login
				if (
					error.response?.status === 401 &&
					shouldRedirectOnAuthFailure.current
				) {
					console.log("Unauthorized access, redirecting to login");
					await signOut(false); // Don't trigger another redirect
					router.replace("/sign-in");
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

			// Reset redirect flag
			shouldRedirectOnAuthFailure.current = true;
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
	const signOut = async (redirect: boolean = true) => {
		try {
			setAuthState((prev) => ({ ...prev, isLoading: true }));

			// Update redirect flag based on parameter
			shouldRedirectOnAuthFailure.current = redirect;

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

			// Navigate to sign in if redirect is true
			if (redirect) {
				router.replace("/sign-in");
			}
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

			const response = await axios.post(
				`${API_URL}/refresh-token`,
				{
					refreshToken: authState.refreshToken,
				},
				{
					// Skip interceptors for this request to avoid infinite loops
					_retry: true,
				}
			);

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

			// Only sign out if we should redirect on auth failure
			if (shouldRedirectOnAuthFailure.current) {
				await signOut(true);
			}

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
