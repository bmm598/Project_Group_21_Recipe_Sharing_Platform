-- users
CREATE TABLE IF NOT EXISTS users (
    creator_id SERIAL PRIMARY KEY,
    user_id    VARCHAR(50) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    name       VARCHAR(100) NOT NULL
);

-- recipes
CREATE TABLE IF NOT EXISTS recipes (
    recipe_id       SERIAL PRIMARY KEY,
    title           TEXT        NOT NULL,
    body            TEXT        NOT NULL,
    img             TEXT,
    ingredients     TEXT        NOT NULL,
    instructions    TEXT        NOT NULL,
    tags            TEXT,
    diet            TEXT,
    cook_time       INTEGER,
    difficulty      VARCHAR(20),
    creator_user_id INTEGER     NOT NULL
        REFERENCES users(creator_id)
        ON DELETE CASCADE,
    date_created    TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    avg_rating      NUMERIC(3,2) DEFAULT 0,
    total_ratings   INTEGER      DEFAULT 0
);

-- ratings
CREATE TABLE IF NOT EXISTS recipe_ratings (
    id         SERIAL PRIMARY KEY,
    recipe_id  INTEGER NOT NULL
        REFERENCES recipes(recipe_id)
        ON DELETE CASCADE,
    user_id    INTEGER NOT NULL
        REFERENCES users(creator_id)
        ON DELETE CASCADE,
    rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE (recipe_id, user_id)
);

ALTER TABLE recipes
    ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;

-- saved
CREATE TABLE IF NOT EXISTS saved_recipes (
    user_id   INTEGER NOT NULL
        REFERENCES users(creator_id)
        ON DELETE CASCADE,
    recipe_id INTEGER NOT NULL
        REFERENCES recipes(recipe_id)
        ON DELETE CASCADE,
    saved_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, recipe_id)
);