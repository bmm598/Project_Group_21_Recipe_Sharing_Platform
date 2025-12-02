document.addEventListener("DOMContentLoaded", () => {
    const input = document.querySelector("#search-input");
    const suggestions = document.querySelector("#search-suggestions");
    const form = document.querySelector("#search-form");

    if (!input || !suggestions || !form) {
        return; // page without search bar
    }

    let timeoutId = null;
    let lastTerm = "";

    function clearSuggestions() {
        suggestions.innerHTML = "";
        suggestions.style.display = "none";
    }

    async function fetchSuggestions(term) {
        try {
            const res = await fetch(
                `/search/suggestions?term=${encodeURIComponent(term)}`
            );
            const data = await res.json();

            const items = data.suggestions || [];

            if (!items.length) {
                clearSuggestions();
                return;
            }

            suggestions.innerHTML = "";
            items.forEach((item) => {
                const div = document.createElement("div");
                div.className = "search-suggestion-item";
                div.textContent = item.title;

                div.addEventListener("click", () => {
                    // put title into input and submit form
                    input.value = item.title;
                    clearSuggestions();
                    form.submit();
                });

                suggestions.appendChild(div);
            });
            suggestions.style.display = "block";
        } catch (error) {
            console.error("Suggestion fetch error:", error);
            clearSuggestions();
        }
    }

    input.addEventListener("input", () => {
        const term = input.value.trim();

        // cancel previous debounce timer
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        if (term.length < 2) {
            clearSuggestions();
            lastTerm = term;
            return;
        }

        lastTerm = term;

        timeoutId = setTimeout(() => {
            // fetch if term hasn't changed in debounce window
            if (term === lastTerm) {
                fetchSuggestions(term);
            }
        }, 200);
    });

    // click outside to close
    document.addEventListener("click", (event) => {
        if (
            !suggestions.contains(event.target) &&
            event.target !== input
        ) {
            clearSuggestions();
        }
    });
});