import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import pg from "pg";
// import { dirname } from "path";
// import { fileURLToPath } from "url";
//import recipes from "./recipes.js";
import { toTitleCase, readApostraphe } from "./helper.js";

// dirname, app, port
const app = express();
const port = 3000;
// temporary directory name
const __dirname = "http://localhost:3000/";
//const __dirname = dirname(fileURLToPath(import.meta.url));

// db connect
const db = new pg.Client({
    user: "postgres",              // default
    host: "localhost",
    database: "recipes_r_us",      // database
    password: "supergoodpassword",
    port: 5432,
});

db.connect()
    .then(() => console.log("Connected to Postgres"))
    .catch((err) => console.error("DB connection error:", err.stack));

// helper functions
async function getRecipes(searchQuery, tagFilter) {
    let query = `
        SELECT
            r.recipe_id,
            r.title,
            r.body,
            r.img,
            r.ingredients,
            r.instructions,
            r.tags,
            r.diet,
            r.cook_time,
            r.difficulty,
            r.creator_user_id,
            TO_CHAR(r.date_created, 'MM-DD-YYYY') AS date_created,
            u.name AS creator_name,
            r.avg_rating,
            r.total_ratings
        FROM recipes r
        LEFT JOIN users u ON r.creator_user_id = u.creator_id
    `;

    const conditions = [];
    const params = [];

    // search filter
    if (searchQuery && searchQuery.trim() !== "") {
        conditions.push(`
            (LOWER(r.title) LIKE $${params.length + 1}
            OR LOWER(r.body) LIKE $${params.length + 1}
            OR LOWER(r.tags) LIKE $${params.length + 1})
        `);
        params.push(`%${searchQuery.toLowerCase()}%`);
    }

    // tag filter
    if (tagFilter && tagFilter.trim() !== "") {
        conditions.push(`LOWER(r.tags) LIKE $${params.length + 1}`);
        params.push(`%${tagFilter.toLowerCase()}%`);
    }

    if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY r.date_created DESC";

    const result = await db.query(query, params);
    return result.rows;
}

// get initial recipes repo
let recipes = await getRecipes("");

// middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// declare global current user
let user = [];

// logged in boolean
let loggedIn = false;

//requests

// get home page (updated with search & tags)
app.get("/", async (req, res) => {
    const searchQuery = req.query.q || "";   // q comes from the search form
    const selectedTag = req.query.tag || '';

    try {
        const recipesList = await getRecipes(searchQuery, selectedTag);
        res.render("index.ejs", {
            __dirname,
            recipes: recipesList,
            user,
            loggedIn,
            searchQuery,                     // pass to ejs to keep the input filled
            selectedTag,
        });
    } catch (error) {
        console.error("Error loading recipes:", error.stack);
        res.status(500).send("Error loading recipes");
    }
});


app.get("/:id/accountcenter", (req, res) => {
    const account_id = req.params.id;
    // render the account center page
    res.render("user/accountcenter.ejs", {
        __dirname,
        user,
        loggedIn,
    })
})

app.get("/:id/accountcenter/recipes", async (req, res) => {
    const account_id = req.params.id;
    const user_recipes = recipes.filter(recipe => recipe.creator_user_id == account_id);

    recipes = await getRecipes("");

    res.render("user/user-recipes.ejs", {
        __dirname,
        user,
        loggedIn,
        user_recipes,
    })
})

// post request to use search query
app.post("/search", (req, res) => {
    console.log(req.body.q);
    //getRecipes(req.body.q);
    res.redirect("/");
})

app.get("/:id/recipe", async (req, res) => {
    const recipe_id = req.params.id;
    const recipeResponse = await db.query(`SELECT
            r.recipe_id,
            r.title,
            r.body,
            r.img,
            r.ingredients,
            r.instructions,
            r.tags,
            r.diet,
            r.cook_time,
            r.difficulty,
            r.creator_user_id,
            TO_CHAR(r.date_created, 'MM-DD-YYYY') AS date_created,
            u.name AS creator_name,
            r.avg_rating,
            r.total_ratings
        FROM recipes r 
        LEFT JOIN users u ON r.creator_user_id = u.creator_id WHERE recipe_id = ${recipe_id}`);
    const recipe = recipeResponse.rows[0];

    const commentsResponse = await db.query(`SELECT 
            c.comment_id,
            c.recipe_id,
            c.commenter_id,
            u.name AS commenter_name,
            c.comment_text,
            TO_CHAR(c.date_created, 'MM-DD-YYYY') AS date_created
        FROM comments c
        LEFT JOIN users u ON c.commenter_id = u.creator_id WHERE recipe_id = ${recipe_id}`);
    const comments = commentsResponse.rows;

    console.log(comments);

    res.render("recipe.ejs", {
        __dirname,
        recipe,
        user, 
        loggedIn,
        comments,
    })
})

app.get("/draftrecipe", (req, res) => {
    res.render("recipe-form.ejs", {
        __dirname,
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
            const hashedPassword = await bcrypt.hash(password,10);
            // updated using parameterized query with hashed password
            await db.query(
                `INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)`,
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
        // console.log(foundUser);
        
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

// submit a new recipe
app.post("/submit", async (req, res) => {
    // make sure someone is logged in
    if (!loggedIn || !user[0]) {
        return res.redirect("/signin");
    }

    const creatorUserId = user[0].creator_id;
    const creatorName   = user[0].name;

    const {
        title,
        content,
        ingredients,
        instructions,
        tags,
        diet,
        cook_time,
        difficulty,
        img
    } = req.body;

    try {
        await db.query(
            `
            INSERT INTO recipes
                (title, body, img, ingredients, instructions,
                 tags, diet, cook_time, difficulty,
                 creator_user_id)
            VALUES
                ($1,   $2,   $3,  $4,          $5,
                 $6,  $7,   $8,    $9,
                 $10)
            `,
            [
                title,
                content,
                img || null,
                toTitleCase(ingredients) || null,
                toTitleCase(instructions) || null,
                toTitleCase(tags) || null,
                diet || null,
                cook_time ? parseInt(cook_time) : null,
                difficulty || null,
                creatorUserId
            ]
        );

        res.redirect("/");
    } catch (error) {
        console.error("Error inserting recipe:", error.stack);
        res.status(500).send("Error creating recipe");
    }
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
        res.render("edit-recipe.ejs", { recipe, user, loggedIn, __dirname });
        
    } catch (error) {
        console.error("Recipe edit error:", error.stack);
        res.status(500).send('Error loading recipe');
    }
});

// edit recipe with ownership check
app.post("/:id/edit", async (req, res) => {
    const recipe_id = req.params.id;

    if (!loggedIn || !user[0]) {
        return res.redirect("/signin");
    }

    const user_id = user[0].creator_id;

    const {
        title,
        content,
        ingredients,
        instructions,
        tags,
        diet,
        cook_time,
        difficulty,
        img
    } = req.body;

    try {
        // ownership check
        const checkResult = await db.query(
            "SELECT creator_user_id FROM recipes WHERE recipe_id = $1",
            [recipe_id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).send("Recipe not found");
        }

        const recipe = checkResult.rows[0];
        if (recipe.creator_user_id !== user_id) {
            return res.status(403).send("You do not have permission to edit this recipe");
        }

        // perform the update
        await db.query(
            `
            UPDATE recipes
            SET
                title = $1,
                body = $2,
                img = $3,
                ingredients = $4,
                instructions = $5,
                tags = $6,
                diet = $7,
                cook_time = $8,
                difficulty = $9
            WHERE recipe_id = $10
            `,
            [
                title,
                content,
                img || null,
                ingredients || null,
                instructions || null,
                tags || null,
                diet || null,
                cook_time ? parseInt(cook_time) : null,
                difficulty || null,
                recipe_id
            ]
        );

        res.redirect("/");
    } catch (error) {
        console.error("Recipe update error:", error.stack);
        res.status(500).send("Error updating recipe");
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