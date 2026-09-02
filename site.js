const store = new SteinStore(
    "https://api.steinhq.com/v1/storages/6a97f91792b1163e973b381e"
);
const loadData = () => {
    store.read("LEGO").then(data => {
        console.log(data);
    });
}

loadData();