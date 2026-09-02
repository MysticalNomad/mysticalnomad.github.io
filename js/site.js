const SHEET_ID = "1Nl4ENaosyt6OlxEag3RbeTxZ3opVgGK1cyOathAohQk";
const API_KEY = "AIzaSyD8EVImOPu7MmNbxWib7q721vcnD1tBf4U";

const loadData = (sender) => {
    let dataPoint = "HOME"; // Default data point
    if (sender && sender.dataset && sender.dataset.point) {
        dataPoint = sender.dataset.point;
    }
    const RANGE = `${dataPoint}!A:Z`;

    document.querySelectorAll("nav a").forEach(link => link.classList.remove("active"));
    sender.classList.add("active");

    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`)
        .then(response => response.json())
        .then(data => {
            const rawRows = data.values;
            if (!rawRows || rawRows.length === 0) return;

            const orderedHeaders = rawRows[0];
            const formattedData = rawRows.slice(1).map(row => {
                const rowObject = {};
                orderedHeaders.forEach((header, index) => {
                    rowObject[header] = row[index] !== undefined ? row[index] : "";
                });
                return rowObject;
            });
            console.log("Headers (In Sheet Order):", orderedHeaders);
            console.log("Rows:", formattedData);

            renderTable(orderedHeaders, formattedData);
        });

}

function renderTable(headers, rows) {
    const tableHeader = headers.map(h => `<th>${h}</th>`).join("");
    const tableRows = rows.map(row => {
        const cells = headers.map(h => `<td>${row[h]}</td>`).join("");
        return `<tr>${cells}</tr>`;
    }).join("");
    document.getElementById("data-output").innerHTML = `<thead><tr>${tableHeader}</tr></thead><tbody>${tableRows}</tbody>`;
}
