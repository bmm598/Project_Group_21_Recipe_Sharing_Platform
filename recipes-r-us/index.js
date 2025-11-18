import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
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

    // password validaiton, ensures passwords are at least a certain length
    if (password.length < 8) {
        return res.render("signup.ejs", {
            response: "Password must be at least 8 characters long.",
            user,
            loggedIn
        });
    }

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
            // hash password with bcrypt, use 10 salt rounds for security
            const hashedPassword = await bcrypt.hash(password,10)
            // updated using parameterized query with hashed password
            await db.query(
                `INSERT INTO users (user_Id, password, name) VALUES ($1 $2 $3)`,
                [username, hashedPassword, name]
            );
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
// updated: added password comparison with hashed password
app.post("/signin", async (req, res) => {
    // get username and password from form
    let username = req.body.user_id;
    let password = req.body.password;

    // try to find a user that has that username 
    // updated: using parametrized query (prevent SQL injection)
    try {
        const response = await db.query('SELECT * FROM users WHERE user_id = $1', [username]);
        // update user to the response
    if (response.rows.length === 0) {
            // No user found
            return res.render("signin.ejs", {response: "Incorrect username or password.", user: [], loggedIn: false});
        }
        
        const foundUser = response.rows[0];
        
        // compare password with hashed password (Safety Feature)
        const passwordMatch = await bcrypt.compare(password, foundUser.password);
        
        if (!passwordMatch) {
            // password doesn't match
            return res.render("signin.ejs", {response: "Incorrect username or password.", user: [], loggedIn: false});
        }
        
        // password matches - update user
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

// recipe edit route, ownership check
app.get("/:id/edit", async (req, res) => {
    const recipe_id = req.params.id;
    
    // Check if user is logged in
    if (!loggedIn || !user[0]) {
        return res.redirect("/signin");
    }
    
    const user_id = user[0].creator_id;
    
    try {
        const result = await db.query('SELECT * FROM recipes WHERE recipe_id = $1', [recipe_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).send('Recipe not found');
        }
        
        const recipe = result.rows[0];
        
        // ownership check, only recipe owner can edit
        if (recipe.creator_user_id !== user_id) {
            return res.status(403).send('You do not have permission to edit this recipe');
        }
        
        // if user owns the recipe, render edit page (for future use)
        res.render("edit-recipe.ejs", { recipe, user, loggedIn });
        
    } catch (error) {
        console.error("Recipe edit error:", error.stack);
        res.status(500).send('Error loading recipe');
    }
});

//recipe delete, ownership check
app.post("/:id/delete", async (req, res) => {
    const recipe_id = req.params.id;
    
    // check if user is logged in
    if (!loggedIn || !user[0]) {
        return res.redirect("/signin");
    }
    
    const user_id = user[0].creator_id;
    
    try {
        const result = await db.query(
            'SELECT creator_user_id FROM recipes WHERE recipe_id = $1',
            [recipe_id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).send('Recipe not found');
        }
        
        const recipe = result.rows[0];
        
        // ownership check, only recipe owner can delete
        if (recipe.creator_user_id !== user_id) {
            return res.status(403).send('You do not have permission to delete this recipe');
        }
        
        // delete recipe if user owns it
        await db.query('DELETE FROM recipes WHERE recipe_id = $1', [recipe_id]);
        res.redirect("/");
        
    } catch (error) {
        console.error("Recipe deletion error:", error.stack);
        res.status(500).send('Error deleting recipe');
    }
});

// starting server
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});