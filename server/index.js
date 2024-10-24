const express = require('express');
const connectDb = require('./utils/db');
const cors = require('cors');
const app = express();
const router = require('./router/auth-routes');
const cookieParser = require('cookie-parser');

app.use(express.json());
app.use(cookieParser());

app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = ['https://dashboard.icklebubba.com','https://icklebubba.com','https://icklebubba-test.myshopify.com'];
        if (allowedOrigins.includes(origin) || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

app.use("/api/", router);

connectDb().then(() => {
    const port = 5000;
    app.listen(port, () => {
        console.log(`server started at port: ${port}.`)
    })
}).catch((err) => console.log(err, "ERROR in Connection"))
