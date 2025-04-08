const mongoose = require('mongoose');
require('dotenv').config();
const { Schema } = mongoose;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const tokenKey = process.env.SECRET_KEY;

const userSchema = new Schema({
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    tokens: [
      {
        token: {
          type: String,
          required: true
        }
      }
    ]
});

const createCompanySchema = new mongoose.Schema({
    firstName:{
        type:String
    },
    lastName:{
        type:String
    },
    email:{
        type:String
    },
    countryCode:{
        type:String
    },
    dueDate:{
        type:String
    },
    relationship:{
        type:String
    },
    customerId:{
        type:String
    },
    companyId:{
        type:String
    },
    locationId:{
        type:String
    },
    companyRoleId:{
        type:String
    },
    companyContactId:{
        type:String
    },
    newsletter:{
        type:String
    },
    submittionDate:{
        type:String
    },
    comments: [{
        comment_text: { type: String },
        comment_date: { type: String }
    }]
})

userSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 12);
    } 
    next();
});

userSchema.methods.generateToken = async function () {
    try {
        let userToken = jwt.sign({ _id: this._id }, tokenKey, { expiresIn: "24h" });
        this.tokens = this.tokens.concat({ token: userToken });
        await this.save();
        return userToken;
    } catch (error) {
        return "error in token generation function";
    }
};

const User = mongoose.model('User', userSchema);
const createCompanyDb = mongoose.model('Membership Form',createCompanySchema);

module.exports = {User,createCompanyDb};