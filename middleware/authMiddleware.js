// const jwt = require("jsonwebtoken");
// const blacklist = new Set();

// const authMiddleware = (req, res, next) => {
//   const token = req.cookies.token || req.cookies.userToken; // Get token from cookies

//   if (!token) {
//     return res.status(400).json({
//       ErrorCode: "INVALID_TOKEN",
//       ErrorMessage: "Token not provided"
//     });
//   }

//   if (blacklist.has(token)) {
//     return res.status(401).json({
//       ErrorCode: "TOKEN_BLACKLISTED",
//       ErrorMessage: "Token has been invalidated. Please log in again.",
//     });
//   }

//   jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
//     if (err) {
//       return res.status(400).json({
//         ErrorCode: "INVALID_TOKEN",
//         ErrorMessage: "Token is invalid",
//         Error: err,
//       });
//     }
//     req.user = decoded.user;
//     next();
//   });
// };

// const logout = async (req, res) => {
//   try {
//     const token = req.cookies.token || req.cookies.userToken;

//     if (!token) {
//       return res.status(400).json({
//         ErrorCode: "INVALID_TOKEN",
//         ErrorMessage: "Token not provided",
//       });
//     }

//     // Add the token to the blacklist
//     blacklist.add(token);

//     // Clear the cookies
//     res.clearCookie('token');

//     res.status(200).json({ message: "Logged out successfully" });
//   } catch (error) {
//     console.error("Error in logout controller:", error.message);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// module.exports = { authMiddleware, logout };

const jwt = require("jsonwebtoken");
const blacklist = new Set(); // Replace with Redis for scalability

// Function to extract token from cookies or Authorization header
const getToken = (req) => {
  const tokenFromCookies = req.cookies.token || req.cookies.userToken;
  const authHeader = req.headers["authorization"];
  const tokenFromHeader = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  return tokenFromCookies || tokenFromHeader;
};

// Middleware to validate JWT
const authMiddleware = (req, res, next) => {
  const token = getToken(req);

  if (!token) {
    return res.status(400).json({
      ErrorCode: "INVALID_TOKEN",
      ErrorMessage: "Token not provided",
    });
  }

  if (blacklist.has(token)) {
    return res.status(401).json({
      ErrorCode: "TOKEN_BLACKLISTED",
      ErrorMessage: "Token has been invalidated. Please log in again.",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(400).json({
        ErrorCode: "INVALID_TOKEN",
        ErrorMessage: "Token is invalid",
        Error: err,
      });
    }
    req.user = decoded.user;
    next();
  });
};

// Logout function to invalidate tokens
const logout = async (req, res) => {
  try {
    const token = getToken(req);

    if (!token) {
      return res.status(400).json({
        ErrorCode: "INVALID_TOKEN",
        ErrorMessage: "Token not provided",
      });
    }

    // Add the token to the blacklist
    blacklist.add(token);

    // Clear cookies
    res.clearCookie("token");
    res.clearCookie("userToken");

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { authMiddleware, logout };
