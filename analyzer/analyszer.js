const params = new URLSearchParams(window.location.search);
const text = params.get("text");

document.getElementById("text").textContent = text;
