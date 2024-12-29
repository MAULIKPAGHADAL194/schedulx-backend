const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth2").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const TwitterStrategy = require("passport-twitter").Strategy;
const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;

// Serialize and deserialize user
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Google Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLECLINTID,
            clientSecret: process.env.GOOGLECLINTSECRET,
            callbackURL: "http://localhost:5000/api/v1/auth/google/callback",
            passReqToCallback: true,
        },
        (request, accessToken, refreshToken, profile, done) => {
            return done(null, profile);
        }
    )
);

// Facebook Strategy
passport.use(
    new FacebookStrategy(
        {
            clientID: process.env.APP_ID,
            clientSecret: process.env.APP_SECRET,
            callbackURL: "http://localhost:5000/api/v1/facebook/callback",
            // scope: ["email", "user_posts", "user_photos", "user_videos", "user_likes", "publish_to_groups"],
        },
        (accessToken, refreshToken, profile, done) => {
            profile.accessToken = accessToken;

            return done(null, profile);
        }
    )
);

passport.use(new LinkedInStrategy({
    clientID: process.env.LINKEDINCLINTID,
    clientSecret: process.env.LINKEDINCLINTSECRET,
    callbackURL: "http://localhost:5000/api/v1/linkedin/callback",
    scope: ["openid", "profile", "email", "w_member_social"],
    state: true,
},
    (request, accessToken, refreshToken, profile, done) => {
        return done(null, profile);
    }
));

passport.use(
    new TwitterStrategy(
        {
            consumerKey: process.env.TWITTERAPIKEY,
            consumerSecret: process.env.TWITTERAPISECRET,
            callbackURL: "http://localhost:5000/api/v1/twitter/callback",
        },
        (accessToken, accessSecret, profile, done) => {
            console.log("accessToken", accessToken, "accessSecret", accessSecret);

            // Attach tokens to the profile for easy access later
            profile.accessToken = accessToken;
            profile.accessSecret = accessSecret;

            return done(null, profile);
        }
    )
);

module.exports = passport;
