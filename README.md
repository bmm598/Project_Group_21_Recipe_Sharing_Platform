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

 - **Design**
     - {placeholder}

## Technologies Used ##

  - **Backend**: Node.js, Express.js, bcrypt
  - **Database**: PostgreSQL
  - **Templating**: EJS
  - **Styling**: CSS
  - **Session Management**: expess-session
  - **Database Client**: pg

## Project Structure ##

Project_Group_21_Recipe_Sharing_Platform/ 
│ 
├── deliverables/ 
│   ├── phase-1/ 
│   │   ├── CS-312-Project Phase - 1 Report Template.docx 
│   │   └── phase-1-report.md 
│   └── phase-2/ 
│       └── phase-2-report.md 
│ 
├── recipes-r-us/ 
│   ├── public/ 
│   │   ├── images/icons/ 
│   │   │   └── user.png 
│   │   └── styles/ 
│   │       ├── comment.css 
│   │       ├── footer.css 
│   │       ├── header.css 
│   │       ├── main.css 
│   │       ├── recipes.css 
│   │       └── sign.css 
│   ├── views/ 
│   │   ├── partials/ 
│   │   │   ├── footer.ejs 
│   │   │   ├── header.ejs 
│   │   │   └── sign-header.ejs 
│   │   └── user/ 
│   │   │   ├── user-recipes.ejs 
│   │   ├── accountcenter.ejs 
│   │   ├── index.ejs 
│   │   ├── signup.ejs 
│   │   ├── signin.ejs 
│   ├── helper.js 
│   ├── index.js 
│   ├── package-lock.json 
│   ├── package.json 
│   ├── recipes.js 
│   ├── schema.sql 
└──.gitignore 
└── README.md 



