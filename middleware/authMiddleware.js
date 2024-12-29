const jwt = require("jsonwebtoken");
const blacklist = new Set();

const authMiddleware = (req, res, next) => {
  const token = req.cookies.token; // Get token from cookies

  if (!token) {
    return res.status(400).json({
      ErrorCode: "INVALID_TOKEN",
      ErrorMessage: "Token not provided"
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

const logout = async (req, res) => {
  try {
    const token = req.cookies.token || req.cookies.userToken;

    if (!token) {
      return res.status(400).json({
        ErrorCode: "INVALID_TOKEN",
        ErrorMessage: "Token not provided",
      });
    }

    // Add the token to the blacklist
    blacklist.add(token);

    // Clear the cookies
    res.clearCookie('token');

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// const authMiddleware = (req, res, next) => {
//   const bearerHeader = req.headers["authorization"];

//   if (typeof bearerHeader !== "undefined") {
//     const token = bearerHeader.startsWith("Bearer ")
//       ? bearerHeader.split(" ")[1]
//       : bearerHeader;

//     if (blacklist.has(token)) {
//       return res.status(401).json({
//         ErrorCode: "TOKEN_BLACKLISTED",
//         ErrorMessage: "Token has been valid. Please log in again.",
//       });
//     }

//     jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
//       if (err) {
//         res.status(400).json({
//           ErrorCode: "INVALID TOKEN",
//           ErrorMessage: "Token is invalid",
//           Error: err,
//         });
//       } else {
//         req.user = decoded.user;
//         next();
//       }
//     });
//   } else {
//     res
//       .status(400)
//       .json({ ErrorCode: "INVALID TOKEN", ErrorMessage: "Token not provided" });
//   }
// };


// const logout = async (req, res) => {
//   try {
//     const bearerHeader = req.headers["authorization"];

//     if (!bearerHeader) {
//       return res.status(400).json({
//         ErrorCode: "INVALID_TOKEN",
//         ErrorMessage: "Token not provided",
//       });
//     }

//     const token = bearerHeader.startsWith("Bearer ")
//       ? bearerHeader.split(" ")[1]
//       : bearerHeader;

//     // Add the token to the blacklist
//     blacklist.add(token);

//     res.status(200).json({ message: "Logged out successfully" });
//   } catch (error) {
//     console.error("Error in logout controller:", error.message);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };


module.exports = { authMiddleware, logout };
