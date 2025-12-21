const { io } = require("socket.io-client");

const socket = io("http://localhost:5000", {
    transports: ["websocket", "polling"]
});

console.log("Connecting to backend...");

socket.on("connect", () => {
    console.log("Connected! ID:", socket.id);

    console.log("Sending 'request_log_history'...");
    socket.emit("request_log_history");
});

socket.on("log_history", (logs) => {
    console.log(`[Event] log_history received. Count: ${logs ? logs.length : 'null'}`);
    if (logs && logs.length > 0) {
        console.log("First log:", logs[0]);
        console.log("Last log:", logs[logs.length - 1]);
    } else {
        console.log("WARNING: Log history is empty!");
    }
    socket.close();
});

socket.on("console_log", (msg) => {
    console.log("[Stream] New log:", msg);
});

socket.on("connect_error", (err) => {
    console.error("Connection error:", err.message);
});

setTimeout(() => {
    console.log("Timeout reached, closing...");
    socket.close();
}, 5000);
