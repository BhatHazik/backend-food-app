const allowedOrigins = [
    'http://localhost:5173', // React web app
    'http://localhost:8081',  // React Native app
    'http://localhost:5500'
  ];
  
  const corsConfig = {
    origin: allowedOrigins,
    credentials: true,
    optionsSuccessStatus: 200
  };
  
  module.exports = { corsConfig };
  