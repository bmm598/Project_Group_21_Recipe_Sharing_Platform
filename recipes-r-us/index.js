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
async function getRecipes(searchQuery, selectedTag, minTime, maxTime, difficulty) {
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

    const params = [];
    const conditions = [];

    // search text (q)
    if (searchQuery && searchQuery.trim() !== "") {
        params.push(`%${searchQuery.toLowerCase()}%`);
        const idx = params.length;
        conditions.push(
            `(LOWER(r.title) LIKE $${idx}
              OR LOWER(r.body) LIKE $${idx}
              OR LOWER(r.tags) LIKE $${idx})`
        );
    }

    // tag filter (?tag=...)
    if (selectedTag && selectedTag.trim() !== "") {
        params.push(`%${selectedTag.toLowerCase()}%`);
        const idx = params.length;
        conditions.push(`LOWER(r.tags) LIKE $${idx}`);
    }

    // min cook time
    if (Number.isInteger(minTime)) {
        params.push(minTime);
        const idx = params.length;
        conditions.push(`r.cook_time >= $${idx}`);
    }

    // max cook time
    if (Number.isInteger(maxTime)) {
        params.push(maxTime);
        const idx = params.length;
        conditions.push(`r.cook_time <= $${idx}`);
    }

    // difficulty filter
    if (difficulty && difficulty.trim() !== "") {
        params.push(difficulty.trim());
        const idx = params.length;
        conditions.push(`r.difficulty = $${idx}`);
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

app.use((req, res, next) => {
  res.locals.selectedTag = "";
  res.locals.minTime = null;
  res.locals.maxTime = null;
  res.locals.difficulty = "";
  next();
});

// toggle
app.post("/:id/save", async (req, res) => {
    const recipe_id = parseInt(req.params.id, 10);

    // check login
    if (!loggedIn || !user[0] || !user[0].creator_id) {
        return res.redirect("/signin");
    }

    const userId = user[0].creator_id;

    try {
        // check if already saved
        const existing = await db.query(
            `SELECT 1
             FROM saved_recipes
             WHERE recipe_id = $1 AND user_id = $2`,
            [recipe_id, userId]
        );

        if (existing.rows.length > 0) {
            // unsave
            await db.query(
                `DELETE FROM saved_recipes
                 WHERE recipe_id = $1 AND user_id = $2`,
                [recipe_id, userId]
            );
        } else {
            // save
            await db.query(
                `INSERT INTO saved_recipes (recipe_id, user_id)
                 VALUES ($1, $2)`,
                [recipe_id, userId]
            );
        }

        return res.redirect(`/${recipe_id}/recipe`);
    } catch (error) {
        console.error("Error toggling saved recipe:", error.stack);
        return res.redirect(`/${recipe_id}/recipe`);
    }
});

// set user rating
async function setUserRating(recipeId, userId, rating) {
    // one rating per user per recipe
    await db.query(
        `
        INSERT INTO recipe_ratings (recipe_id, user_id, rating)
        VALUES ($1, $2, $3)
        ON CONFLICT (recipe_id, user_id)
        DO UPDATE SET rating = EXCLUDED.rating,
                      created_at = NOW();
        `,
        [recipeId, userId, rating]
    );
}

// update rating summary
async function updateRecipeRatingSummary(recipeId) {
    // recompute avg & count, write into recipes table
    const result = await db.query(
        `
        SELECT
            COALESCE(AVG(rating), 0)::NUMERIC(3,2) AS avg_rating,
            COUNT(*)::INTEGER                         AS total_ratings
        FROM recipe_ratings
        WHERE recipe_id = $1;
        `,
        [recipeId]
    );

    const { avg_rating, total_ratings } = result.rows[0];

    await db.query(
        `
        UPDATE recipes
        SET avg_rating = $2,
            total_ratings = $3
        WHERE recipe_id = $1;
        `,
        [recipeId, avg_rating, total_ratings]
    );
}

// get home page (updated with search & tags)
app.get("/", async (req, res) => {
    const searchQuery = req.query.q || "";
    const selectedTag = req.query.tag || "";

    const minTimeRaw = req.query.minTime;
    const maxTimeRaw = req.query.maxTime;
    const difficultyRaw = req.query.difficulty;

    const minTime = minTimeRaw ? parseInt(minTimeRaw, 10) : null;
    const maxTime = maxTimeRaw ? parseInt(maxTimeRaw, 10) : null;
    const difficulty = difficultyRaw && difficultyRaw.trim() !== ""
        ? difficultyRaw.trim()
        : "";

    try {
        const recipesList = await getRecipes(
            searchQuery,
            selectedTag,
            minTime,
            maxTime,
            difficulty
        );

        res.render("index.ejs", {
            __dirname,
            recipes: recipesList,
            user,
            loggedIn,
            searchQuery,
            selectedTag,
            minTime,
            maxTime,
            difficulty,
        });
    } catch (error) {
        console.error("Error loading recipes:", error.stack);
        res.status(500).send("Error loading recipes");
    }
});

// autocomplete suggestions
app.get("/search/suggestions", async (req, res) => {
    try {
        const termRaw = req.query.term || "";
        const term = termRaw.trim().toLowerCase();

        // no querying if too short
        if (term.length < 2) {
            return res.json({ suggestions: [] });
        }

        // search by title & tags
        const result = await db.query(
            `
            SELECT recipe_id, title
            FROM recipes
            WHERE LOWER(title) LIKE $1
               OR LOWER(tags) LIKE $1
            ORDER BY title
            LIMIT 10;
            `,
            [`%${term}%`]
        );

        return res.json({
            suggestions: result.rows,
        });
    } catch (error) {
        console.error("Error fetching search suggestions:", error.stack);
        return res.json({ suggestions: [] });
    }
});

app.get("/:id/accountcenter", (req, res) => {
    const account_id = req.params.id;
    // render the account center page
    res.render("user/settings.ejs", {
        __dirname,
        user,
        loggedIn,
    })
})

app.get("/:id/accountcenter", (req, res) => {
    const account_id = parseInt(req.params.id, 10);

    if (!loggedIn || !user[0] || user[0].creator_id !== account_id) {
        return res.redirect("/signin");
    }

    res.render("user/settings.ejs", {
        __dirname,
        user,
        loggedIn,
    });
});

app.get("/:id/accountcenter/favorites", async (req, res) => {
    const account_id = parseInt(req.params.id, 10);

    if (!loggedIn || !user[0] || user[0].creator_id !== account_id) {
        return res.redirect("/signin");
    }

    try {
        const favResult = await db.query(
            `
            SELECT
                r.recipe_id,
                r.title,
                r.body,
                r.img,
                r.tags,
                r.diet,
                r.cook_time,
                r.difficulty,
                r.avg_rating,
                r.total_ratings,
                TO_CHAR(r.date_created, 'MM-DD-YYYY') AS date_created,
                u.name AS creator_name,
                r.creator_user_id
            FROM saved_recipes s
            JOIN recipes r
              ON s.recipe_id = r.recipe_id
            LEFT JOIN users u
              ON r.creator_user_id = u.creator_id
            WHERE s.user_id = $1
            ORDER BY s.saved_at DESC
            `,
            [account_id]
        );

        const savedRecipes = favResult.rows;

        res.render("user/favorites.ejs", {
            __dirname,
            user,
            loggedIn,
            savedRecipes,
        });
    } catch (error) {
        console.error("Favorites load error:", error.stack);
        res.status(500).send("Error loading favorite recipes");
    }
});

app.get("/:id/accountcenter/recipes", async (req, res) => {
    const account_id = parseInt(req.params.id, 10);

    if (!loggedIn || !user[0] || user[0].creator_id !== account_id) {
        return res.redirect("/signin");
    }

    try {
        const result = await db.query(
            `
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
            WHERE r.creator_user_id = $1
            ORDER BY r.date_created DESC
            `,
            [account_id]
        );

        const user_recipes = result.rows;

        res.render("user/user-recipes.ejs", {
            __dirname,
            user,
            loggedIn,
            user_recipes,
        });
    } catch (error) {
        console.error("User recipes load error:", error.stack);
        res.status(500).send("Error loading your recipes");
    }
});

app.get("/:id/accountcenter/collections", async (req, res) => {
    const account_id = req.params.id;
    const user_recipes = recipes.filter(recipe => recipe.creator_user_id == account_id);

    recipes = await getRecipes("");

    res.render("user/collections.ejs", {
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
    const recipe_id = parseInt(req.params.id, 10);

    try {
        // load the recipe
        const recipeResponse = await db.query(
            `SELECT
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
            WHERE r.recipe_id = $1`,
            [recipe_id]
        );

        if (recipeResponse.rows.length === 0) {
            return res.status(404).send("Recipe not found");
        }

        const recipe = recipeResponse.rows[0];

        // load comments
        const commentsResponse = await db.query(
            `SELECT 
                c.comment_id,
                c.recipe_id,
                c.commenter_id,
                u.name AS commenter_name,
                c.comment_text,
                TO_CHAR(c.date_created, 'MM-DD-YYYY') AS date_created
            FROM comments c
            LEFT JOIN users u ON c.commenter_id = u.creator_id
            WHERE c.recipe_id = $1
            ORDER BY c.date_created DESC`,
            [recipe_id]
        );
        const comments = commentsResponse.rows;

        // user-specific stuff: rating + saved
        let userRating = null;
        let isSaved = false;

        if (loggedIn && user && user[0] && user[0].creator_id) {
            const userId = user[0].creator_id;

            // rating lookup
            try {
                const ratingResponse = await db.query(
                    `SELECT rating
                     FROM recipe_ratings
                     WHERE recipe_id = $1 AND user_id = $2`,
                    [recipe_id, userId]
                );
                if (ratingResponse.rows.length > 0) {
                    userRating = ratingResponse.rows[0].rating;
                }
            } catch (err) {
                console.error("Rating lookup error:", err.stack);
                // don't throw; page should still load
            }

            // saved lookup
            try {
                const savedResponse = await db.query(
                    `SELECT 1
                     FROM saved_recipes
                     WHERE recipe_id = $1 AND user_id = $2`,
                    [recipe_id, userId]
                );
                isSaved = savedResponse.rows.length > 0;
            } catch (err) {
                console.error("Saved lookup error:", err.stack);
                // don't throw; page should still load
            }
        }

        // render the page
        res.render("recipe.ejs", {
            __dirname,
            recipe,
            user,
            loggedIn,
            comments,
            userRating,
            isSaved,
        });
    } catch (error) {
        console.error("Error loading recipe:", error.stack);
        res.status(500).send("Error loading recipe");
    }
});

app.post("/:id/rate", async (req, res) => {
    const recipeId = parseInt(req.params.id, 10);

    // use the global login state (same as the rest of the app)
    if (!loggedIn || !user[0] || !user[0].creator_id) {
        // either redirect to signin, or just back to recipe page
        return res.redirect("/signin");
    }

    const userId = user[0].creator_id;
    const rating = parseInt(req.body.rating, 10);

    // basic validation
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.redirect(`/${recipeId}/recipe`);
    }

    try {
        await setUserRating(recipeId, userId, rating);
        await updateRecipeRatingSummary(recipeId);
        return res.redirect(`/${recipeId}/recipe`);
    } catch (error) {
        console.error("Error setting rating:", error.stack);
        return res.redirect(`/${recipeId}/recipe`);
    }
});

app.post("/:id/post-comment", async (req, res) => {
    //console.log(req.body.content);
    const recipe_id = req.params.id;
    try {
        await db.query(
                `INSERT INTO comments (recipe_id, commenter_id, comment_text) VALUES ($1, $2, $3)`,
                [recipe_id, user[0].creator_id, req.body.content]
            );
    } catch (error) {
        console.error("Error executing query", error.stack);
    }
    res.redirect(`/${recipe_id}/recipe`);
})

app.get("/draftrecipe", (req, res) => {
    res.render("recipe-form.ejs", {
        __dirname,
        user,
        loggedIn,
        // defaults so header/tag nav don't crash
        selectedTag: "",
        minTime: null,
        maxTime: null,
        difficulty: "",
    });
});

// get new user sign up page
app.get("/signup", (req, res) => {
    res.render("signup.ejs", {
        __dirname,
        user,
        loggedIn,
        selectedTag: "",
        minTime: null,
        maxTime: null,
        difficulty: "",
    });
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
    res.render("signin.ejs", {
        __dirname,
        user,
        loggedIn,
        selectedTag: "",
        minTime: null,
        maxTime: null,
        difficulty: "",
    });
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
    const recipe_id = parseInt(req.params.id, 10);

    // Check if user is logged in
    if (!loggedIn || !user[0] || !user[0].creator_id) {
        return res.redirect("/signin");
    }

    const user_id = user[0].creator_id;

    try {
        const result = await db.query(
            "SELECT recipe_id, title, body, img, ingredients, instructions, tags, diet, cook_time, difficulty, creator_user_id FROM recipes WHERE recipe_id = $1",
            [recipe_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).send("Recipe not found");
        }

        const recipe = result.rows[0];

        // ownership check, only recipe owner can edit
        if (Number(recipe.creator_user_id) !== Number(user_id)) {
            return res.status(403).send("You do not have permission to edit this recipe");
        }

        // if user owns the recipe, render edit page
        res.render("edit-recipe.ejs", {
            __dirname,
            recipe,
            user,
            loggedIn,
            selectedTag: "",
            minTime: null,
            maxTime: null,
            difficulty: "",
        });
    } catch (error) {
        console.error("Recipe edit error:", error.stack);
        res.status(500).send("Error loading recipe");
    }
});

// edit recipe with ownership check
app.post("/:id/edit", async (req, res) => {
    const recipe_id = parseInt(req.params.id, 10);

    if (!loggedIn || !user[0] || !user[0].creator_id) {
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
        img,
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
        if (Number(recipe.creator_user_id) !== Number(user_id)) {
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
                cook_time ? parseInt(cook_time, 10) : null,
                difficulty || null,
                recipe_id,
            ]
        );

        res.redirect(`/${recipe_id}/recipe`);
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