const screenStart = document.getElementById("screen-start");
const screenLevel = document.getElementById("screen-level");

const btnPlay = document.getElementById("btn-play");
const btnBack = document.getElementById("btn-back");
const btnBasic = document.getElementById("btn-basic");
const btnAdvanced = document.getElementById("btn-advanced");

function showScreen(screenToShow) {
  screenStart.classList.remove("active");
  screenLevel.classList.remove("active");
  screenToShow.classList.add("active");
}

btnPlay.addEventListener("click", () => {
  showScreen(screenLevel);
});

btnBack.addEventListener("click", () => {
  showScreen(screenStart);
});

btnBasic.addEventListener("click", () => {
  // Aquí lanzarías el juego en modo básico
  alert("Nivel BÁSICO seleccionado");
  // startGame({ difficulty: "basic" });
});

btnAdvanced.addEventListener("click", () => {
  // Aquí lanzarías el juego en modo avanzado
  alert("Nivel AVANZADO seleccionado");
  // startGame({ difficulty: "advanced" });
});
