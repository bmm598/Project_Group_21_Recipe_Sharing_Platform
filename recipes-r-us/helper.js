//helper functions

// helper function to convert names to uppercase for first letters
export function toTitleCase(str) {
    return str
        // split string by spaces
        .split(' ')
        // for each word in array from split, uppercase the first letter and lowercase the rest.
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        // join each word with a space in between
        .join(' ');
}

// helper function to convert ' in body to '' so it is read correctly in postgres
export function readApostraphe(str) {
    return str
        // split string by apostrophe
        .split("\'")
        // join each word with a double apostrophe in between
        .join("\'\'");
}

// helper function to fill star rating
export function checkStars() {
    
}


