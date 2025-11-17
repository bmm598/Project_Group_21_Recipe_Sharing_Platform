document.addEventListener("DOMContentLoaded", () => {
    // recipe form validation
    const recipeForm = document.getElementById("recipe-form");

    if (recipeForm) {
        recipeForm.addEventListener("submit", (e) => {
            const title = recipeForm.querySelector('input[name="title"]');
            const content = recipeForm.querySelector('textarea[name="content"]');
            const ingredients = recipeForm.querySelector('textarea[name="ingredients"]');
            const instructions = recipeForm.querySelector('textarea[name="instructions"]');

            let errors = [];

            // title (at least 3 characters)
            if (title && title.value.trim().length < 3) {
                errors.push("Title must be at least 3 characters long.");
            }

            // description (at least 10 characters)
            if (content && content.value.trim().length < 10) {
                errors.push("Content must be at least 10 characters long.");
            }

            // ingredients (if the field exists, make sure it's not empty)
            if (ingredients && ingredients.value.trim().length === 0) {
                errors.push("Ingredients field cannot be empty.");
            }

            // instructions (if the field exists, make sure it's not empty)
            if (instructions && instructions.value.trim().length === 0) {
                errors.push("Instructions field cannot be empty.");
            }

            if (errors.length > 0) {
                e.preventDefault();
                alert(errors.join("\n"));
            }
        });
    }

    // signup form validation
    const signUpForm = document.getElementById("sign-up-form");

    if (signUpForm) {
        signUpForm.addEventListener("submit", (e) => {
            const nameInput = signUpForm.querySelector('input[name="name"]');
            const usernameInput = signUpForm.querySelector('input[name="user_id"]');
            const passwordInput = signUpForm.querySelector('input[name="password"]');
            // try to find a "confirm password" field with common names, don't require it
            const confirmPasswordInput =
                signUpForm.querySelector('input[name="confirm_password"]') ||
                signUpForm.querySelector('input[name="passwordConfirm"]') ||
                null;

            let errors = [];

            // name (at least 2 characters)
            if (nameInput && nameInput.value.trim().length < 2) {
                errors.push("Name must be at least 2 characters long.");
            }

            // username (at least 3 characters, no spaces)
            if (usernameInput) {
                const username = usernameInput.value.trim();
                if (username.length < 3) {
                errors.push("Username must be at least 3 characters long.");
                }
                if (/\s/.test(username)) {
                errors.push("Username cannot contain spaces.");
                }
            }

            // password (at least 6 characters if field exists)
            if (passwordInput && passwordInput.value.length < 6) {
                errors.push("Password must be at least 6 characters long.");
            }

            // if there is a confirm password field, make sure it matches
            if (passwordInput && confirmPasswordInput) {
                if (passwordInput.value !== confirmPasswordInput.value) {
                errors.push("Passwords do not match.");
                }
            }

            if (errors.length > 0) {
                e.preventDefault();
                alert(errors.join("\n"));
            }
        });
    }

    // signin form validation
    const signInForm = document.getElementById("sign-in-form");

    if (signInForm) {
        signInForm.addEventListener("submit", (e) => {
            const usernameInput = signInForm.querySelector('input[name="user_id"]');
            const passwordInput = signInForm.querySelector('input[name="password"]');

            let errors = [];

            if (usernameInput && usernameInput.value.trim() === "") {
                errors.push("Username is required.");
            }

            if (passwordInput && passwordInput.value.trim() === "") {
                errors.push("Password is required.");
            }

            if (errors.length > 0) {
                e.preventDefault();
                alert(errors.join("\n"));
            }
        });
    }
});