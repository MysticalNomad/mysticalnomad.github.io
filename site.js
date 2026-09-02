const SHEET_ID = "1Nl4ENaosyt6OlxEag3RbeTxZ3opVgGK1cyOathAohQk";
const API_KEY = "AIzaSyD8EVImOPu7MmNbxWib7q721vcnD1tBf4U";

const loadData = (sender) => {
    let dataPoint = "HOME"; // Default data point
    if (sender && sender.dataset && sender.dataset.point) {
        dataPoint = sender.dataset.point;
    }
    const RANGE = `${dataPoint}!A1:Z100`;

    document.querySelectorAll("nav a").forEach(link => link.classList.remove("active"));
    sender.classList.add("active");

    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`)
        .then(response => response.json())
        .then(data => {
            const rawRows = data.values;
            if (!rawRows || rawRows.length === 0) return;

            // 1. Maintain headers in their exact left-to-right spreadsheet order
            const orderedHeaders = rawRows[0];

            // 2. Map data rows while strictly preserving key creation order
            const formattedData = rawRows.slice(1).map(row => {
                const rowObject = {};
                orderedHeaders.forEach((header, index) => {
                    rowObject[header] = row[index] !== undefined ? row[index] : "";
                });
                return rowObject;
            });

            // Output both the ordered column list and the structured rows
            console.log("Headers (In Sheet Order):", orderedHeaders);
            console.log("Rows:", formattedData);

            // Example: Rendering an HTML Table using the exact header order
            renderTable(orderedHeaders, formattedData);
        });

}

function renderTable(headers, rows) {
    // Use orderedHeaders to build <th> tags in correct sequence
    const tableHeader = headers.map(h => `<th>${h}</th>`).join("");

    // Use orderedHeaders to pull values in correct sequence for <td> tags
    const tableRows = rows.map(row => {
        const cells = headers.map(h => `<td>${row[h]}</td>`).join("");
        return `<tr>${cells}</tr>`;
    }).join("");

    // Attach to your DOM element (e.g., <table id="lego-table"></table>)
    // document.getElementById("lego-table").innerHTML = `<thead><tr>${tableHeader}</tr></thead><tbody>${tableRows}</tbody>`;
}
