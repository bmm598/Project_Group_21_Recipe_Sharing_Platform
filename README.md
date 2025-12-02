# CS-312 Group 21 - Recipe Sharing Platform

Full stack recipe sharing application build with bcrypt, Node.js, Express.js, EJS, PostgreSQL.

## Features

 - **User Authentication**
     - Sign-up/Sign-in
     - Password Security (validation/hashing)
       
 - **Recipe Posting**
     - Create a recipe with author, title, content
     - Search posts by name, tags, etc. with filtering
     - Edit/delete posts with ownership checks
     - Add comments to a post
     - Rate a post out of 5 stars
     - Persisent storage with PostgreSQL database

## Technologies Used ##

  - **Backend**: Node.js, Express.js, bcrypt
  - **Database**: PostgreSQL
  - **Templating**: EJS
  - **Styling**: CSS
  - **Session Management**: expess-session
  - **Database Client**: pg

## Database Setup ##

### Step 1 - Install PostgreSQL
Make sure PostgreSQL is installed on your system. Download from postgresql.org

### Step 2 - Create Database
Using pgAdmin or psql command line:
CREATE DATABASE recipes_r_us;

### Step 3 - Create Tables
Connect to the recipes_r_us database and create the tables in the schema.sql file

## Installation & Setup ##

### 1. Clone the repository


git clone https://github.com/your-username/Project_Group_21_Recipe_Sharing_Platform

cd Project_Group_21_Recipe_Sharing_Platform/recipes-r-us


### 2. Install dependencies

npm install

### 3. Configure Database Connection

Edit `index.js` and update the database connection settings to match your postgresql settings: 

const db = new pg.Client({

  user: 'your_postgres_username',
  
  host: 'localhost',
  
  database: 'recipes_r_us',
  
  password: 'your_postgres_password',
  
  port: 5432,
  
});

### 4. Start the server

node index.js

### 5. Open your browser

Navigate to `http://localhost:3000`

## License

ISC

## Author

Dante, Brenden, Joseph

---


# CS-312 Group 21 - Recipe Sharing Platform




