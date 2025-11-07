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

// helper function to convert names to uppercase for first letters
function toTitleCase(str) {
    return str
        // split string by spaces
        .split(' ')
        // for each word in array from split, uppercase the first letter and lowercase the rest.
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        // join each word with a space in between
        .join(' ');
}

// helper function to convert ' in body to '' so it is read correctly in postgres
function readApostraphe(str) {
    return str
        // split string by apostrophe
        .split("\'")
        // join each word with a double apostrophe in between
        .join("\'\'");
}

// get initial recipes repo
//let recipes = [];
//updateRecipes();

// middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// declare global current user
let user = [{
    name: "example name",
    creator_id: 1,
}];

// logged in boolean
let loggedIn = true;

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

app.get("/accountcenter", (req, res) => {
    // render the account center page
    res.render("accountcenter.ejs", {
        user,
        loggedIn,
    })
})

// get new user sign up page
app.get("/signup", (req, res) => {
    res.render("signup.ejs", {user, loggedIn});
});

// post new user sign up
app.post("/signup", async (req, res) => {
    // get username and password from form
    let username = req.body.user_id;
    let password = req.body.password;

    // get name and convert to capitals for first letters
    let name = toTitleCase(req.body.name);

    //try to find a user with given username
    let selectedUser = [];
    try {
        const response = await db.query(`SELECT * FROM users WHERE user_id = '${username}'`);
        selectedUser = response.rows
    } catch (error) {
        console.error("Error executing query", error.stack);
    }

    // if that user already exists
    if(selectedUser[0]) {
        // rerender signup with the message username already taken
        return res.render("signup.ejs", {response: `${username} is already taken.`, user, loggedIn});
    // username not taken
    } else {
        // try to add new user to db
        try {
            await db.query(`INSERT INTO users VALUES ('${username}', '${password}', '${name}')`);
            return res.redirect("/signin");
        } catch (error) {
            console.error("Error executing query", error.stack);
        }
    }
});

// get user sign in
app.get("/signin", (req, res) => {
    res.render("signin.ejs", {user, loggedIn});
});

// post user sign in
app.post("/signin", async (req, res) => {
    // get username and password from form
    let username = req.body.user_id;
    let password = req.body.password;

    // try to find a user that has that username AND that password
    try {
        const response = await db.query(`SELECT * FROM users WHERE user_id = '${username}' AND password = '${password}'`);
        // update user to the response
        user = response.rows;
    } catch (error) {
        console.error("Error executing query", error.stack);
    }

    // if that user exists
    if(user[0]) {
        // update logged in and redirect to home page
        loggedIn = true;
        res.redirect("/");
    } else {
        // rerender signin with the message incorrect username or password
        res.render("signin.ejs", {response: "Incorrect username or password.", user, loggedIn})
    }
});

// post user sign out
app.post("/signout", (req, res) => {
    // set user back to empty object, and loggedIn to false
    user = [];
    loggedIn = false;

    // then redirect to home page
    res.redirect("/");
});

// starting server
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});