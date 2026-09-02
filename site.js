// const store = new SteinStore(
//     "https://api.steinhq.com/v1/storages/6a97f91792b1163e973b381e"
// );
// const loadData = () => {
//     store.read("LEGO").then(data => {
//         console.log(data);
//     });
// }

const SHEET_ID = "1Nl4ENaosyt6OlxEag3RbeTxZ3opVgGK1cyOathAohQk";
const API_KEY = "AIzaSyD8EVImOPu7MmNbxWib7q721vcnD1tBf4U";
const RANGE = "LEGO";

fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`)
  .then(response => response.json())
  .then(data => console.log(data.values));

// loadData();