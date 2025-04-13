// src/index.js
import { server, app } from "./app.js";
import { startScheduler } from "./utils/scheduler.utils.js";
import { setupSocketIO, socketMiddleware } from "./utils/socket.utils.js";

const PORT = process.env.PORT || 8000;

// Setup Socket.IO
const io = setupSocketIO(server);

// Add socket middleware to the Express app
app.use(socketMiddleware(io));

server.listen(PORT, () => {
	console.log(`Server running on port http://localhost:${PORT}`);

	// Start the bill reminder scheduler
	startScheduler(io);
});
