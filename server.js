const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db.js");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const session = require("express-session");
const errorHandler = require("./middleware/errorHandler.js");
// const morgan = require("morgan");
const passport = require("passport");
const cookieParser = require('cookie-parser');

//? Cronjob
const cronjob = require("./middleware/cronjob.js");

dotenv.config(); //? Load environment variables from .env file
connectDB(); //? Connect to the database

const app = express();

//! Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(cookieParser());
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
// Initialize Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

//! Security: Configure Helmet with custom Content Security Policy (CSP)
// app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"], //? Allow resources from the same origin
      imgSrc: ["'self'", "http://localhost:5000", "http://localhost:5173"],  // Allow images from backend
    },
  })
);

// app.use(morgan("dev")); //? For Api hit to send Log 

//! Enable CORS (Cross-Origin Resource Sharing)
app.use(cors({
  origin: [process.env.FRONTEND_URL],
  credentials: true,
}));

//! Rate limiting: Limit each IP to 100 requests per 15 minutes
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, //? Time window in milliseconds (15 minutes)
    max: 100, //? Maximum requests per IP
  })
);

//! Routes
app.use("/", require("./routes/index.js"));

//! Welcome Route
app.get("/", (req, res) => {
  res.send(`
    <center>
        <h1>Welcome to Test Project!</h1>
        <br>
        <a href="https://github.com/swiftrut/SchedulX-backend.git" target="_blank" > SchedulX-backend </a>
    </center>
  `);
});

//! Error Handler Middleware
app.use(errorHandler);

// Server listening
const PORT = process.env.PORT || 5000;

//? for notification
const http = require('http')
const { Server } = require('socket.io')

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
})

// Make io available globally
global.io = io;

// Middleware for socket.io (Optional - if you want to access io in routes through req.io)
app.use((req, res, next) => {
  req.io = io;
  next();
})

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
})

app.set('io', io)

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
