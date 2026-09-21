const SHEET_ID = "1Nl4ENaosyt6OlxEag3RbeTxZ3opVgGK1cyOathAohQk";
const API_KEY = "AIzaSyD8EVImOPu7MmNbxWib7q721vcnD1tBf4U";
let allDataPoints = [];
let latestRequest = 0;
let currentDataPoint = "HOME";
let currentRows = [];
const sheetCache = {};

const SORT_DIRECTION_STORAGE_KEY = "sortDirection";
let currentSortDirection = localStorage.getItem(SORT_DIRECTION_STORAGE_KEY) || null; // null | "asc" | "desc"
let lastRenderMode = null; // "cards" | "search" | null
let lastRenderedRows = [];
let lastRenderedTaggedRows = [];

function getSortName(row) {
    return String(row["Name/Description"] ?? row.Name ?? "").toLowerCase();
}

function sortRows(rows) {
    if (!currentSortDirection) return rows;
    return [...rows].sort((a, b) => {
        const comparison = getSortName(a).localeCompare(getSortName(b));
        return currentSortDirection === "asc" ? comparison : -comparison;
    });
}

function sortTaggedRows(taggedRows) {
    if (!currentSortDirection) return taggedRows;
    return [...taggedRows].sort((a, b) => {
        const comparison = getSortName(a.row).localeCompare(getSortName(b.row));
        return currentSortDirection === "asc" ? comparison : -comparison;
    });
}

// Renders cards while remembering the underlying rows so the sort bar can re-render on demand
function displayCards(cardType, rows) {
    lastRenderMode = "cards";
    lastRenderedRows = rows;
    renderCards(cardType, sortRows(rows));
}

// Renders tagged search/photo results while remembering them so the sort bar can re-render on demand
function displaySearchResults(taggedRows) {
    lastRenderMode = "search";
    lastRenderedTaggedRows = taggedRows;
    renderSearchResults(sortTaggedRows(taggedRows));
}

function clearDisplayedRows() {
    lastRenderMode = null;
    lastRenderedRows = [];
    lastRenderedTaggedRows = [];
}

function initSortBar() {
    const ascButton = document.getElementById("sort-asc");
    const descButton = document.getElementById("sort-desc");
    if (!ascButton || !descButton) return;

    ascButton.classList.toggle("active", currentSortDirection === "asc");
    ascButton.setAttribute("aria-pressed", String(currentSortDirection === "asc"));
    descButton.classList.toggle("active", currentSortDirection === "desc");
    descButton.setAttribute("aria-pressed", String(currentSortDirection === "desc"));

    ascButton.addEventListener("click", () => setSortDirection(currentSortDirection === "asc" ? null : "asc"));
    descButton.addEventListener("click", () => setSortDirection(currentSortDirection === "desc" ? null : "desc"));
}

function setSortDirection(direction) {
    currentSortDirection = direction;
    if (direction) {
        localStorage.setItem(SORT_DIRECTION_STORAGE_KEY, direction);
    } else {
        localStorage.removeItem(SORT_DIRECTION_STORAGE_KEY);
    }

    const ascButton = document.getElementById("sort-asc");
    const descButton = document.getElementById("sort-desc");
    ascButton?.classList.toggle("active", direction === "asc");
    ascButton?.setAttribute("aria-pressed", String(direction === "asc"));
    descButton?.classList.toggle("active", direction === "desc");
    descButton?.setAttribute("aria-pressed", String(direction === "desc"));

    if (lastRenderMode === "cards") {
        renderCards(currentDataPoint, sortRows(lastRenderedRows));
    } else if (lastRenderMode === "search") {
        renderSearchResults(sortTaggedRows(lastRenderedTaggedRows));
    }
}

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

async function initMenu() {
    const menuList = document.querySelector("#main-nav > ul");
    if (!menuList) return;

    const menuRows = await fetchSheetRows("CONTROL");
    const menuItems = menuRows
        .filter(row => String(row.Name).trim() && String(row.Link).trim())
        .map(row => {
            const link = document.createElement("a");
            const dataPoint = String(row.Link).trim();
            link.href = `#${dataPoint}`;
            link.dataset.point = dataPoint;
            link.textContent = row.Name;
            return link;
        });

    allDataPoints = [...new Set(menuItems
        .map(link => link.dataset.point)
        .filter(dataPoint => dataPoint && dataPoint !== "HOME"))];

    const menuItemGroup = document.createElement("li");
    menuItemGroup.append(...menuItems);
    menuList.replaceChildren(menuItemGroup);
}

function loadCurrentView() {
    const [dataPoint, queryString] = (location.hash.slice(1) || "HOME").split("?");
    const link = document.querySelector(
        `nav a[data-point="${CSS.escape(dataPoint)}"]`
    );

    loadData(link, parseFiltersFromHash(queryString));
}

window.addEventListener("DOMContentLoaded", async () => {
    try {
        await initMenu();
    } catch (error) {
        console.error(error);
    }
    loadCurrentView();
});
window.addEventListener("DOMContentLoaded", initNavToggle);
window.addEventListener("DOMContentLoaded", initSearch);
window.addEventListener("DOMContentLoaded", initCameraSearch);
window.addEventListener("DOMContentLoaded", initFieldFilter);
window.addEventListener("DOMContentLoaded", initSortBar);
window.addEventListener("DOMContentLoaded", initPullToRefresh);
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
    displayCards(currentDataPoint, filteredRows);
    showFilterStatus(filteredRows.length);
    syncFiltersToUrl();
}

function clearFieldFilters() {
    if (Object.keys(currentFieldFilters).length === 0) return;

    currentFieldFilters = {};
    hideFilterStatus();
    if (currentDataPoint !== "HOME") displayCards(currentDataPoint, currentRows);
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
            clearDisplayedRows();
            document.getElementById("data-output").innerHTML = "";
        } else {
            displayCards(currentDataPoint, currentRows);
        }
        return;
    }

    const requestId = ++latestRequest;
    setLoading(true);
    clearFieldFilters();

    try {
        document.querySelectorAll("nav a").forEach(link => link.classList.remove("active"));

        const resultsByType = await Promise.all(allDataPoints.map(async dataPoint => {
            const rows = await fetchSheetRows(dataPoint);
            return rows.filter(row => matchesTerm(row, term)).map(row => ({ cardType: dataPoint, row }));
        }));

        if (requestId !== latestRequest) return;

        await loadCardTemplates();
        const flatResults = resultsByType.flat();
        showSearchStatus(query.trim(), flatResults.length);
        displaySearchResults(flatResults);
    } catch (error) {
        if (requestId === latestRequest) {
            console.error(error);
            document.getElementById("data-output").innerHTML = "<p>Unable to search. Please try again.</p>";
        }
    } finally {
        if (requestId === latestRequest) setLoading(false);
    }
};

const MAX_IMAGE_RESULTS = 24;
const TFJS_MODULE_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/+esm";
const MOBILENET_MODULE_URL = "https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/+esm";
const IMAGE_PROXY_URL = "https://wsrv.nl/?output=jpg&url=";
let mobilenetModelPromise = null;
const embeddingCache = {};

function initCameraSearch() {
    const cameraButton = document.getElementById("camera-search-button");
    const cameraInput = document.getElementById("camera-input");
    if (!cameraButton || !cameraInput) return;

    cameraButton.addEventListener("click", () => cameraInput.click());
    cameraInput.addEventListener("change", () => {
        const file = cameraInput.files?.[0];
        cameraInput.value = "";
        if (file) applyImageSearch(file);
    });
}

// Loaded on first use only, so visitors who never search by photo avoid the download
async function loadMobileNetModel() {
    if (!mobilenetModelPromise) {
        mobilenetModelPromise = (async () => {
            await import(TFJS_MODULE_URL);
            const mobilenetLib = await import(MOBILENET_MODULE_URL);
            return mobilenetLib.load();
        })();
    }
    return mobilenetModelPromise;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Unable to load image: ${src}`));
        img.src = src;
    });
}

async function computeEmbedding(model, image) {
    const tensor = model.infer(image, true);
    const values = await tensor.data();
    tensor.dispose();
    return Array.from(values);
}

function getSearchableImageUrl(url) {
    return `${IMAGE_PROXY_URL}${encodeURIComponent(url)}`;
}

// Embeddings are cached in localStorage so repeat searches skip re-downloading/re-scoring catalog images
async function getEmbeddingForUrl(model, url) {
    if (!url) return null;
    if (embeddingCache[url]) return embeddingCache[url];

    const storageKey = `embedding:${url}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
        const parsed = JSON.parse(stored);
        embeddingCache[url] = parsed;
        return parsed;
    }

    try {
        const image = await loadImage(getSearchableImageUrl(url));
        const embedding = await computeEmbedding(model, image);
        embeddingCache[url] = embedding;
        localStorage.setItem(storageKey, JSON.stringify(embedding));
        return embedding;
    } catch {
        return null; // image failed to load or is blocked by CORS
    }
}

function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function showImageSearchStatus(count) {
    const status = document.getElementById("search-status");
    if (!status) return;

    const text = document.createElement("span");
    text.textContent = `${count} closest match${count === 1 ? "" : "es"} found for your photo`;

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.textContent = "Clear search";
    clearButton.addEventListener("click", () => {
        updateSearchIndicator("");
        applySearch("");
    });

    status.replaceChildren(text, clearButton);
    status.hidden = false;
}

const applyImageSearch = async (file) => {
    const requestId = ++latestRequest;
    setLoading(true);
    clearFieldFilters();
    hideSearchStatus();

    const objectUrl = URL.createObjectURL(file);

    try {
        document.querySelectorAll("nav a").forEach(link => link.classList.remove("active"));

        const model = await loadMobileNetModel();
        const queryImage = await loadImage(objectUrl);
        const queryEmbedding = await computeEmbedding(model, queryImage);

        const resultsByType = await Promise.all(allDataPoints.map(async dataPoint => {
            const rows = await fetchSheetRows(dataPoint);
            const scoredRows = await Promise.all(rows.map(async row => {
                const embedding = await getEmbeddingForUrl(model, row.Image);
                if (!embedding) return null;
                return { cardType: dataPoint, row, score: cosineSimilarity(queryEmbedding, embedding) };
            }));
            return scoredRows.filter(Boolean);
        }));

        if (requestId !== latestRequest) return;

        await loadCardTemplates();
        const topMatches = resultsByType.flat()
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_IMAGE_RESULTS);

        showImageSearchStatus(topMatches.length);
        displaySearchResults(topMatches);
    } catch (error) {
        if (requestId === latestRequest) {
            console.error(error);
            document.getElementById("data-output").innerHTML = "<p>Unable to search by photo. Please try again.</p>";
        }
    } finally {
        URL.revokeObjectURL(objectUrl);
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
            clearDisplayedRows();
            document.getElementById("data-output").innerHTML = "";
            return;
        }

        await loadCardTemplates();
        const formattedData = await fetchSheetRows(dataPoint);
        if (requestId !== latestRequest) return;

        if (formattedData.length === 0) {
            clearDisplayedRows();
            document.getElementById("data-output").innerHTML = "<p>No data is available.</p>";
            return;
        }

        currentRows = formattedData;

        if (Object.keys(initialFilters).length > 0) {
            currentFieldFilters = initialFilters;
            const filteredRows = currentRows.filter(row =>
                Object.entries(currentFieldFilters).every(([f, v]) => row[f] === v)
            );
            displayCards(dataPoint, filteredRows);
            showFilterStatus(filteredRows.length);
        } else {
            displayCards(dataPoint, formattedData);
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

const PULL_REFRESH_THRESHOLD = 70;
const PULL_REFRESH_MAX = 110;

// main is the actual scroll container (body/html don't scroll), so the browser's
// native pull-to-refresh never fires here; this reimplements the gesture manually.
function initPullToRefresh() {
    const container = document.querySelector("main");
    const indicator = document.getElementById("pull-refresh");
    if (!container || !indicator) return;

    let startY = null;
    let pulling = false;
    let ready = false;

    container.addEventListener("touchstart", event => {
        if (container.scrollTop > 0) {
            startY = null;
            pulling = false;
            return;
        }
        startY = event.touches[0].clientY;
        pulling = true;
        ready = false;
    }, { passive: true });

    container.addEventListener("touchmove", event => {
        if (!pulling || startY === null) return;
        const deltaY = event.touches[0].clientY - startY;
        if (deltaY <= 0) return;

        event.preventDefault();
        const distance = Math.min(deltaY, PULL_REFRESH_MAX);
        ready = distance >= PULL_REFRESH_THRESHOLD;
        indicator.classList.add("visible");
        indicator.classList.toggle("ready", ready);
        indicator.style.transform = `translate(-50%, ${distance}px)`;
    }, { passive: false });

    container.addEventListener("touchend", () => {
        if (!pulling) return;
        pulling = false;
        startY = null;

        if (ready) {
            indicator.classList.add("refreshing");
            indicator.style.transform = `translate(-50%, ${PULL_REFRESH_THRESHOLD}px)`;
            location.reload();
        } else {
            indicator.classList.remove("visible", "ready");
            indicator.style.transform = "translate(-50%, 0)";
        }
    });

    // Mobile browsers cancel the touch sequence (instead of ending it) when they intercept
    // the gesture for their own native overscroll/refresh UI, so treat it as an aborted pull
    container.addEventListener("touchcancel", () => {
        if (!pulling) return;
        pulling = false;
        ready = false;
        startY = null;
        indicator.classList.remove("visible", "ready", "refreshing");
        indicator.style.transform = "translate(-50%, 0)";
    });
}

let cardTemplates = [];

async function loadCardTemplates() {
    const templateRows = await fetchSheetRows("CONTROL");
    cardTemplates = templateRows
        .filter(row => String(row.Link).trim() && String(row.Template ?? row.Content ?? "").trim())
        .map(row => ({
            cardType: String(row.Link).trim(),
            template: String(row.Template ?? row.Content)
        }));
}

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
