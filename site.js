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
      .then(data => 
        {
            const rawRows = data.values;
            if (!rawRows || rawRows.length === 0) return;
    
            // Extract headers from Row 0
            const headers = rawRows[0];
    
            // Map remaining rows into structured key-value objects
            const formattedData = rawRows.slice(1).map(row => {
                let rowObject = {};
                headers.forEach((header, index) => {
                    // If cell is empty/missing, assign "" (or null)
                    rowObject[header] = row[index] !== undefined ? row[index] : "";
                });
                return rowObject;
            });
    
            console.log(formattedData);
        }
      );
}

