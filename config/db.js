const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });
    console.log("MongoDB connected: " + conn.connection.host);
  } catch (error) {
    console.error("Error connecting to MONGODB : " + error);
    process.exit(1);
  }
};

// async function exportCollections() {
//   try {
//     // Check if MONGO_URI is defined
//     console.log(process.env.MONGO_URI);

//     if (!process.env.MONGO_URI) {
//       throw new Error("MONGO_URI environment variable is not defined.");
//     }

//     // Connect to the database
//     await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });


//     // Get all collections
//     const collections = await mongoose.connection.db.listCollections().toArray();

//     for (const collection of collections) {
//       const collectionName = collection.name;
//       console.log(`Exporting collection: ${collectionName}`);

//       const data = await mongoose.connection.db.collection(collectionName).find().toArray();

//       // Write to a JSON file
//       fs.writeFileSync(`${collectionName}.json`, JSON.stringify(data, null, 2));
//     }

//     console.log('All collections exported successfully.');
//   } catch (err) {
//     console.error('Error exporting collections:', err);
//   } finally {
//     await mongoose.disconnect();
//   }
// }

const fs = require('fs');
// const { User, SocialMedia, Post, Analytics } = require('../models/index');

// fs.readFile('analytics.json', 'utf8', (err, data) => {
//   if (err) {
//     console.error('Error reading file:', err);
//     return;
//   }

//   const users = JSON.parse(data); // Parse JSON data

//   // Insert data into MongoDB
//   Analytics.insertMany(users)
//     .then(() => {
//       console.log('Data imported successfully');
//       mongoose.connection.close(); // Close the connection
//     })
//     .catch(err => {
//       console.error('Error importing data:', err);
//       mongoose.connection.close(); // Close the connection
//     });
// });

module.exports = connectDB;
