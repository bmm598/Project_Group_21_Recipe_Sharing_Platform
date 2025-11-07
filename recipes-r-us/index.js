import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import recipes from "./recipes.js";

// dirname, app, port
const app = express();
const port = 3000;

// db connect

//helper functions
function getRecipes(searchQuery) { 
    return null;
}

// middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// declare global current user
let user = [];

// logged in boolean
let loggedIn = false;

//requests

// get home page
app.get("/", (req, res) => { 
    // render home page with recipes, user, and loggedin boolean
    res.render("index.ejs", {
        recipes,
        user, 
        loggedIn,
    });
})

// starting server
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});