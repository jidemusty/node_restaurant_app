const mongoose = require('mongoose');

// import environmental variables from our variables.env file
require('dotenv').config({ path: 'variables.env' });

// connect to our database and handle any bad connections
mongoose.connect(process.env.DATABASE);
mongoose.Promise = global.Promise // tell mongoose to use ES6 promises
mongoose.connection.on('error', (err) => {
    console.error(`${err.message}`);
});

// ready?! let's go!

// import all of our models
require('./models/Store');
require('./models/User');
require('./models/Review');

// start our app!
const app = require('./app');
app.set('port', process.env.PORT || 7777);
const server = app.listen(app.get('port'), () => {
    console.log(`Express running -> PORT ${server.address().port}`);
});

// require('./handlers/mail');