// src/index.js
import { server } from "./app.js";

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
