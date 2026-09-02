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

        renderTable(orderedHeaders, formattedData);
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

function renderTable(headers, rows) {
    const tableHeader = headers.map(h => `<th>${h}</th>`).join("");
    const tableRows = rows.map(row => {
        const cells = headers.map(h => `<td>${row[h]}</td>`).join("");
        return `<tr>${cells}</tr>`;
    }).join("");
    document.getElementById("data-output").innerHTML = `<thead><tr>${tableHeader}</tr></thead><tbody>${tableRows}</tbody>`;
}

function renderLegoSets(legoSets) {
    const legoContainer = document.getElementById("lego-container");
    legoContainer.innerHTML = ""; // Clear previous content


    const legoTemplate = `
        <article>
            <div>
                <img src="{Image}" alt="{Name}">
            </div>
            <div>
                <h2>{Name}</h2>
                <p><strong>Set Number:</strong> {Set Number}</p>
                <p><strong>Theme:</strong> {Theme}</p>
                <p><strong>Subtheme:</strong> {Subtheme}</p>
                <p><strong>Release Year:</strong> {Release Year}</p>
            </div>
        </article>
    `;
}
