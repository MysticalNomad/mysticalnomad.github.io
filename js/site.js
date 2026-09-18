const SHEET_ID = "1Nl4ENaosyt6OlxEag3RbeTxZ3opVgGK1cyOathAohQk";
const API_KEY = "AIzaSyD8EVImOPu7MmNbxWib7q721vcnD1tBf4U";
const ALL_DATA_POINTS = ["LEGO", "FUNKO", "TABLE_TOP"];
let latestRequest = 0;
let currentDataPoint = "HOME";
let currentRows = [];
const sheetCache = {};

async function fetchSheetRows(dataPoint) {
    if (sheetCache[dataPoint]) return sheetCache[dataPoint];

    const RANGE = `${dataPoint}!A:Z`;
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`);
    if (!response.ok) {
        throw new Error(`Google Sheets request failed: ${response.status}`);
    }

    const data = await response.json();
    const rawRows = data.values;
    if (!rawRows || rawRows.length === 0) {
        sheetCache[dataPoint] = [];
        return [];
    }

    const orderedHeaders = rawRows[0];
    const formattedData = rawRows.slice(1).map(row => {
        const rowObject = {};
        orderedHeaders.forEach((header, index) => {
            rowObject[header] = row[index] !== undefined ? row[index] : "";
        });
        return rowObject;
    });

    sheetCache[dataPoint] = formattedData;
    return formattedData;
}

function navigate(sender) {
    const dataPoint = sender.dataset.point;
    location.hash = dataPoint;
}

function loadCurrentView() {
    const [dataPoint, queryString] = (location.hash.slice(1) || "HOME").split("?");
    const link = document.querySelector(
        `nav a[data-point="${CSS.escape(dataPoint)}"]`
    );

    loadData(link, parseFiltersFromHash(queryString));
}

window.addEventListener("DOMContentLoaded", loadCurrentView);
window.addEventListener("DOMContentLoaded", initNavToggle);
window.addEventListener("DOMContentLoaded", initSearch);
window.addEventListener("DOMContentLoaded", initFieldFilter);
window.addEventListener("hashchange", loadCurrentView);
window.addEventListener("hashchange", closeNav);
window.addEventListener("hashchange", clearSearch);

function initNavToggle() {
    const navToggle = document.getElementById("nav-toggle");
    const nav = document.getElementById("main-nav");
    if (!navToggle || !nav) return;

    navToggle.addEventListener("click", () => {
        const isOpen = nav.classList.toggle("open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("click", event => {
        if (!nav.classList.contains("open")) return;
        if (nav.contains(event.target) || navToggle.contains(event.target)) return;
        closeNav();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeNav();
    });
}

function closeNav() {
    const navToggle = document.getElementById("nav-toggle");
    const nav = document.getElementById("main-nav");
    if (!nav || !navToggle) return;
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
}

let searchDebounce;

function initSearch() {
    const searchInput = document.getElementById("search-input");
    const clearButton = document.getElementById("search-clear");
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
        updateSearchIndicator(searchInput.value);
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => applySearch(searchInput.value), 200);
    });

    clearButton?.addEventListener("click", () => {
        searchInput.value = "";
        updateSearchIndicator("");
        applySearch("");
        searchInput.focus();
    });
}

function updateSearchIndicator(value) {
    const headerSearch = document.querySelector(".header-search");
    const clearButton = document.getElementById("search-clear");
    const hasValue = value.trim().length > 0;
    headerSearch?.classList.toggle("searching", hasValue);
    if (clearButton) clearButton.hidden = !hasValue;
}

function hideSearchStatus() {
    const status = document.getElementById("search-status");
    if (!status) return;
    status.hidden = true;
    status.replaceChildren();
}

function showSearchStatus(term, count) {
    const status = document.getElementById("search-status");
    if (!status) return;

    const text = document.createElement("span");
    text.textContent = `${count} result${count === 1 ? "" : "s"} for "${term}" across all products`;

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.textContent = "Clear search";
    clearButton.addEventListener("click", () => {
        const searchInput = document.getElementById("search-input");
        if (searchInput) {
            searchInput.value = "";
            searchInput.focus();
        }
        updateSearchIndicator("");
        applySearch("");
    });

    status.replaceChildren(text, clearButton);
    status.hidden = false;
}

function clearSearch() {
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.value = "";
    updateSearchIndicator("");
    hideSearchStatus();
}

function matchesTerm(row, term) {
    return String(row.Number ?? "").toLowerCase().includes(term) ||
        String(row["Name/Description"] ?? "").toLowerCase().includes(term) ||
        String(row.Franchise ?? "").toLowerCase().includes(term);
}

let currentFieldFilters = {};

function initFieldFilter() {
    const output = document.getElementById("data-output");
    if (!output) return;

    output.addEventListener("click", event => {
        const target = event.target.closest(".field-filter");
        if (target) applyFieldFilter(target.dataset.field, target.dataset.value);
    });

    output.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const target = event.target.closest(".field-filter");
        if (!target) return;
        event.preventDefault();
        applyFieldFilter(target.dataset.field, target.dataset.value);
    });
}

function hideFilterStatus() {
    const status = document.getElementById("filter-status");
    if (!status) return;
    status.hidden = true;
    status.replaceChildren();
}

function showFilterStatus(count) {
    const status = document.getElementById("filter-status");
    if (!status) return;

    const description = Object.entries(currentFieldFilters)
        .map(([field, value]) => `${field} "${value}"`)
        .join(" and ");

    const text = document.createElement("span");
    text.textContent = `${count} result${count === 1 ? "" : "s"} for ${description}`;

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.textContent = "Show all";
    clearButton.addEventListener("click", clearFieldFilters);

    status.replaceChildren(text, clearButton);
    status.hidden = false;
}

function applyFieldFilter(field, value) {
    if (!field || !value || currentDataPoint === "HOME") return;

    currentFieldFilters = { ...currentFieldFilters, [field]: value };
    const filteredRows = currentRows.filter(row =>
        Object.entries(currentFieldFilters).every(([f, v]) => row[f] === v)
    );
    renderCards(currentDataPoint, filteredRows);
    showFilterStatus(filteredRows.length);
    syncFiltersToUrl();
}

function clearFieldFilters() {
    if (Object.keys(currentFieldFilters).length === 0) return;

    currentFieldFilters = {};
    hideFilterStatus();
    if (currentDataPoint !== "HOME") renderCards(currentDataPoint, currentRows);
    syncFiltersToUrl();
}

function parseFiltersFromHash(queryString) {
    if (!queryString) return {};
    const filters = {};
    new URLSearchParams(queryString).forEach((value, field) => {
        if (value) filters[field] = value;
    });
    return filters;
}

// Updates the URL without firing hashchange, so refreshes restore the active filters
function syncFiltersToUrl() {
    if (currentDataPoint === "HOME") return;
    const params = new URLSearchParams(currentFieldFilters).toString();
    const hash = params ? `${currentDataPoint}?${params}` : currentDataPoint;
    history.replaceState(null, "", `#${hash}`);
}

const applySearch = async (query) => {
    const term = query.trim().toLowerCase();

    if (!term) {
        hideSearchStatus();
        document.querySelectorAll("nav a").forEach(link => link.classList.remove("active"));
        const activeLink = document.querySelector(`nav a[data-point="${CSS.escape(currentDataPoint)}"]`);
        if (activeLink) activeLink.classList.add("active");

        if (currentDataPoint === "HOME") {
            document.getElementById("data-output").innerHTML = "";
        } else {
            renderCards(currentDataPoint, currentRows);
        }
        return;
    }

    const requestId = ++latestRequest;
    setLoading(true);
    clearFieldFilters();

    try {
        document.querySelectorAll("nav a").forEach(link => link.classList.remove("active"));

        const resultsByType = await Promise.all(ALL_DATA_POINTS.map(async dataPoint => {
            const rows = await fetchSheetRows(dataPoint);
            return rows.filter(row => matchesTerm(row, term)).map(row => ({ cardType: dataPoint, row }));
        }));

        if (requestId !== latestRequest) return;

        const flatResults = resultsByType.flat();
        showSearchStatus(query.trim(), flatResults.length);
        renderSearchResults(flatResults);
    } catch (error) {
        if (requestId === latestRequest) {
            console.error(error);
            document.getElementById("data-output").innerHTML = "<p>Unable to search. Please try again.</p>";
        }
    } finally {
        if (requestId === latestRequest) setLoading(false);
    }
};

const loadData = async (sender, initialFilters = {}) => {
    const requestId = ++latestRequest;
    let dataPoint = "HOME"; // Default data point
    if (sender && sender.dataset && sender.dataset.point) {
        dataPoint = sender.dataset.point;
    }

    setLoading(true);

    try {
        document.querySelectorAll("nav a").forEach(link => link.classList.remove("active"));
        if (sender) sender.classList.add("active");

        currentDataPoint = dataPoint;
        currentRows = [];
        currentFieldFilters = {};
        hideFilterStatus();

        if (dataPoint === "HOME") {
            document.getElementById("data-output").innerHTML = "";
            return;
        }

        const formattedData = await fetchSheetRows(dataPoint);
        if (requestId !== latestRequest) return;

        if (formattedData.length === 0) {
            document.getElementById("data-output").innerHTML = "<p>No data is available.</p>";
            return;
        }

        currentRows = formattedData;

        if (Object.keys(initialFilters).length > 0) {
            currentFieldFilters = initialFilters;
            const filteredRows = currentRows.filter(row =>
                Object.entries(currentFieldFilters).every(([f, v]) => row[f] === v)
            );
            renderCards(dataPoint, filteredRows);
            showFilterStatus(filteredRows.length);
        } else {
            renderCards(dataPoint, formattedData);
        }
    } catch (error) {
        if (requestId === latestRequest) {
            console.error(error);
            document.getElementById("data-output").innerHTML = "<p>Unable to load this content. Please try again.</p>";
        }
    } finally {
        if (requestId === latestRequest) setLoading(false);
    }
};

function setLoading(isLoading) {
    const loadingScreen = document.getElementById("loading-screen");
    loadingScreen.classList.toggle("visible", isLoading);
    loadingScreen.setAttribute("aria-hidden", String(!isLoading));
}

const cardTemplates = [
    { 
        cardType: "LEGO",
        template: `
                <article>
                    <div class="itemTitle">
                        <sup>{Number}</sup>
                        <span>{Name/Description}</span>
                        <sup class="itemBadge">{Retired}</sup>
                    </div>
                    <div class="itemImage">
                        <img src="{Image}" alt="{Name}">
                    </div>
                    <div class="itemDetails">
                        <div class="field-filter" data-field="Franchise" data-value="{Franchise}" role="button" tabindex="0">{Franchise}</div>
                        <span class="field-filter" data-field="Series" data-value="{Series}" role="button" tabindex="0">{Series}</span>
                        <span>{Notes}</span>
                        <sub>Pieces: {Pieces}</sub>
                    </div>
                </article>
            `
    },
    { 
        cardType: "FUNKO",
        template: `
                <article>
                    <div class="itemTitle">
                        <sup>{Number}</sup>
                        <span>{Name/Description}</span>
                    </div>
                    <div class="itemImage">
                        <img src="{Image}" alt="{Name}">
                    </div>
                    <div class="itemDetails">
                        <div class="field-filter" data-field="Franchise" data-value="{Franchise}" role="button" tabindex="0">{Franchise}</div>
                        <span class="field-filter" data-field="Series" data-value="{Series}" role="button" tabindex="0">{Series}</span>
                        <sub>Notes: {Notes}</sub>
                    </div>
                </article>
            `
    },
    { 
        cardType: "TABLE_TOP",
        template: `
                <article>
                    <div class="itemTitle">
                        <sup>{Type}</sup>
                        <span class="field-filter" data-field="Franchise" data-value="{Franchise}" role="button" tabindex="0">{Franchise}</span>
                    </div>
                    <div class="itemImage">
                        <img src="{Image}" alt="{Name}">
                    </div>
                    <div class="itemDetails">
                        <div>{Name/Description}</div>
                        <span>Players: {Players}</span>
                        <sub>Notes: {Notes}</sub>
                    </div>
                </article>
            `
    },
    { 
        cardType: "SQUISHMALLOWS",
        template: `
                <article>
                    <div class="itemTitle">
                        <span>{Name/Description}</span>
                    </div>
                    <div class="itemImage">
                        <img src="{Image}" alt="{Name}">
                    </div>
                    <div class="itemDetails">
                        <div class="field-filter" data-field="Franchise" data-value="{Franchise}" role="button" tabindex="0">Series: {Franchise}</div>
                        <span>{Notes}</span>
                    </div>
                </article>
            `
    }
];

function buildCard(cardType, row) {
    const cardTemplate = cardTemplates.find(card => card.cardType === cardType);
    if (!cardTemplate) return null;

    const template = document.createElement("template");
    template.innerHTML = cardTemplate.template.trim();
    replacePlaceholders(template.content, row);
    const image = template.content.querySelector(".itemImage img");
    if (image && !image.getAttribute("src")?.trim()) {
        const placeholder = document.createElement("i");
        placeholder.className = "fa-solid fa-camera-slash";
        placeholder.setAttribute("aria-label", "No image available");
        image.replaceWith(placeholder);
    }

    const badge = template.content.querySelector(".itemBadge");
    if (badge && !badge.textContent.trim()) badge.remove();

    return template.content;
}

function renderCards(cardType, rows) {
    const output = document.getElementById("data-output");
    output.replaceChildren();

    if (!cardTemplates.some(card => card.cardType === cardType)) {
        const message = document.createElement("p");
        message.textContent = `No card template is available for ${cardType}.`;
        output.append(message);
        return;
    }

    const cards = document.createDocumentFragment();
    rows.forEach(row => {
        const card = buildCard(cardType, row);
        if (card) cards.append(card);
    });

    output.append(cards);
}

function renderSearchResults(taggedRows) {
    const output = document.getElementById("data-output");
    output.replaceChildren();

    if (taggedRows.length === 0) {
        const message = document.createElement("p");
        message.textContent = "No matching products found.";
        output.append(message);
        return;
    }

    const cards = document.createDocumentFragment();
    taggedRows.forEach(({ cardType, row }) => {
        const card = buildCard(cardType, row);
        if (card) cards.append(card);
    });

    output.append(cards);
}

function replacePlaceholders(content, row) {
    const replaceValue = value => value.replace(/\{([^{}]+)\}/g, (placeholder, field) => {
        return Object.hasOwn(row, field) ? String(row[field]) : "";
    });
    const elements = content.querySelectorAll("*");
    const textNodes = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);

    let textNode = textNodes.nextNode();
    while (textNode) {
        textNode.textContent = replaceValue(textNode.textContent);
        textNode = textNodes.nextNode();
    }

    elements.forEach(element => {
        Array.from(element.attributes).forEach(attribute => {
            element.setAttribute(attribute.name, replaceValue(attribute.value));
        });
    });
}
