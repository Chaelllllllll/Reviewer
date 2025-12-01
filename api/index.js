const serverless = require('serverless-http');

console.log('Loading app module...');
const app = require('../server');
console.log('App module loaded successfully');

const handler = serverless(app);

module.exports = async (req, res) => {
  console.log('Request received:', req.method, req.url);
  try {
    return await handler(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).send('Internal Server Error');
  }
};
