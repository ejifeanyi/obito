// src/utils/api-client.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";

const API_URL = "https://obito-ixea.onrender.com/api";

// Create axios instance
const apiClient = axios.create({
	baseURL: API_URL,
	headers: {
		"Content-Type": "application/json",
	},
});

// Request interceptor to add authorization header
apiClient.interceptors.request.use(
	async (config) => {
		const token = await SecureStore.getItemAsync("accessToken");
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error)
);

export default apiClient;
