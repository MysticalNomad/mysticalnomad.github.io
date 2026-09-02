const SHEET_ID = "1Nl4ENaosyt6OlxEag3RbeTxZ3opVgGK1cyOathAohQk";
const API_KEY = "AIzaSyD8EVImOPu7MmNbxWib7q721vcnD1tBf4U";
let latestRequest = 0;

function navigate(sender) {
    const dataPoint = sender.dataset.point;
    location.hash = dataPoint;
}

function loadCurrentView() {
    const dataPoint = location.hash.slice(1) || "HOME";
    const link = document.querySelector(
        `nav a[data-point="${CSS.escape(dataPoint)}"]`
    );

    loadData(link);
}

window.addEventListener("DOMContentLoaded", loadCurrentView);
window.addEventListener("hashchange", loadCurrentView);

const loadData = async (sender) => {
    const requestId = ++latestRequest;
    let dataPoint = "HOME"; // Default data point
    if (sender && sender.dataset && sender.dataset.point) {
        dataPoint = sender.dataset.point;
    }

    setLoading(true);

    try {
        document.querySelectorAll("nav a").forEach(link => link.classList.remove("active"));
        if (sender) sender.classList.add("active");

        if (dataPoint === "HOME") {
            document.getElementById("data-title").textContent = "Home";
            document.getElementById("data-output").innerHTML = "";
            return;
        }

        const RANGE = `${dataPoint}!A:Z`;
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        if (!response.ok) {
            throw new Error(`Google Sheets request failed: ${response.status}`);
        }

        const data = await response.json();
        if (requestId !== latestRequest) return;

        const rawRows = data.values;
        if (!rawRows || rawRows.length === 0) {
            document.getElementById("data-output").innerHTML = "<p>No data is available.</p>";
            return;
        }

        const orderedHeaders = rawRows[0];
        const formattedData = rawRows.slice(1).map(row => {
            const rowObject = {};
            orderedHeaders.forEach((header, index) => {
                rowObject[header] = row[index] !== undefined ? row[index] : "";
            });
            return rowObject;
        });

        renderCards(dataPoint, formattedData);
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
                    <div>
                        <img src="{Image}" alt="{Name}">
                    </div>
                    <div>
                        <header>{Name}</header>
                        <sup>{Number}</sup>
                        <div>{Franchise}</div>
                        <span>{Series}</span>
                        <sub>{Pieces} pieces</sub>
                    </div>
                </article>
            `
    }
];

function renderCards(cardType, rows) {
    const output = document.getElementById("data-output");
    const cardTemplate = cardTemplates.find(card => card.cardType === cardType);
    output.replaceChildren();

    if (!cardTemplate) {
        const message = document.createElement("p");
        message.textContent = `No card template is available for ${cardType}.`;
        output.append(message);
        return;
    }

    const cards = document.createDocumentFragment();
    rows.forEach(row => {
        const template = document.createElement("template");
        template.innerHTML = cardTemplate.template.trim();
        replacePlaceholders(template.content, row);
        cards.append(template.content);
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
