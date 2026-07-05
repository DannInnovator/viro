// --- CLASE PERSONAJE (IGUAL AL ANTERIOR) ---
class Personaje {
    constructor(nombre, vidaMax, daño, velocidad, tipoEfecto) {
        this.nombre = nombre;
        this.vidaMax = vidaMax;
        this.vidaActual = vidaMax;
        this.daño = daño;
        this.velocidad = velocidad;
        this.tipoEfecto = tipoEfecto; 
        this.escudo = 0;
        this.venenoAcumulado = 0; 
    }
    estaVivo() { return this.vidaActual > 0; }
    recibirDaño(cantidad, imprimir) {
        if (this.escudo > 0) {
            if (cantidad <= this.escudo) { this.escudo -= cantidad; return; }
            else { cantidad -= this.escudo; this.escudo = 0; }
        }
        this.vidaActual -= cantidad;
        if (this.vidaActual < 0) this.vidaActual = 0;
        imprimir(`💥 ${this.nombre} recibe ${cantidad} de daño. (Vida: ${this.vidaActual}/${this.vidaMax})`);
    }
    ejecutarAccion(objetivo, imprimir) {
        if (!this.estaVivo()) return;
        if (this.tipoEfecto === 'agresivo') objetivo.recibirDaño(this.daño, imprimir);
        else if (this.tipoEfecto === 'tanque') {
            objetivo.recibirDaño(this.daño, imprimir);
            this.escudo += Math.floor(this.vidaMax * 0.2);
        }
    }
}

// --- VARIABLES DE ESTADO DEL JUEGO ---
let pisoActual = 0;
let mapaDatos = [];
let miEquipo = [];
let enemigosActivos = [];
let turnoGlobal = 1;

// --- GENERACIÓN DEL MAPA ALEATORIO ---
const TIPOS_NODOS = ["⚔️ Celula", "⚔️ Linfocito", "❓ Evento", "🏪 Laboratorio"];

function generarMapa() {
    mapaDatos = [];
    // Generamos 5 pisos de altura
    for (let i = 0; i < 5; i++) {
        let nodosEnPiso = [];
        // Cada piso tiene entre 2 y 3 caminos posibles aleatorios
        let cantidadNodos = Math.floor(Math.random() * 2) + 2; 
        for (let j = 0; j < cantidadNodos; j++) {
            let tipoAleatorio = TIPOS_NODOS[Math.floor(Math.random() * TIPOS_NODOS.length)];
            nodosEnPiso.push({ tipo: tipoAleatorio, id: `${i}-${j}`, piso: i });
        }
        mapaDatos.push(nodosEnPiso);
    }
    dibujarMapa();
}

function dibujarMapa() {
    const contenedor = document.getElementById("mapa-nodos");
    contenedor.innerHTML = "";

    mapaDatos.forEach((piso, indexPiso) => {
        const filaDiv = document.createElement("div");
        filaDiv.className = "map-row";

        piso.forEach(nodo => {
            const btn = document.createElement("button");
            btn.className = "nodo-btn";
            btn.innerText = nodo.tipo;
            
            // Regla: Solo puedes clickear nodos del piso actual
            if (nodo.piso === pisoActual) {
                btn.className += " disponible";
                btn.onclick = () => iniciarNodo(nodo);
            } else {
                btn.disabled = true;
            }
            filaDiv.appendChild(btn);
        });
        contenedor.appendChild(filaDiv);
    });
}

// --- GESTIÓN DE PANTALLAS Y COMBATE ---
function iniciarNodo(nodo) {
    document.getElementById("pantalla-mapa").className = "screen hidden";
    document.getElementById("pantalla-combate").className = "screen";
    
    const consola = document.getElementById("log-consola");
    consola.innerHTML = `<p class='system-msg' style='color:#0ff;'>🧬 Entrando a: ${nodo.tipo} (Piso ${nodo.piso + 1})</p>`;

    // Preparar datos para este combate específico
    miEquipo = [
        new Personaje("Cepa Caparazón", 120, 5, 5, "tanque"),
        new Personaje("Cepa Alfa", 80, 22, 12, "agresivo")
    ];

    enemigosActivos = nodo.tipo.includes("⚔️") 
        ? [new Personaje(nodo.tipo.replace("⚔️ ", ""), 60, 12, 10, "agresivo")]
        : [new Personaje("Célula Débil", 30, 5, 4, "agresivo")]; // Los eventos por ahora simulan combate fácil

    turnoGlobal = 1;
}

document.getElementById("btn-siguiente-turno").addEventListener("click", () => {
    const consola = document.getElementById("log-consola");
    function logGame(texto) {
        consola.innerHTML += `<p>${texto}</p>`;
        consola.scrollTop = consola.scrollHeight;
    }

    if (miEquipo.length === 0 || enemigosActivos.length === 0) return;

    logGame(`<br><span style='color: #8b949e;'>[ TURNO ${turnoGlobal} ]</span>`);
    
    let virusFrente = miEquipo[0];
    let enemigoFrente = enemigosActivos[0];
    let luchadores = [virusFrente, enemigoFrente].sort((a, b) => b.velocidad - a.velocidad);

    luchadores.forEach(luchador => {
        if (!luchador.estaVivo()) return;
        let obj = (luchador === virusFrente) ? enemigoFrente : virusFrente;
        luchador.ejecutarAccion(obj, logGame);
        if (!obj.estaVivo()) logGame(`<span style='color: #ff3333;'>💀 ${obj.nombre} ha sido destruido.</span>`);
    });

    // Limpieza
    if (!virusFrente.estaVivo()) miEquipo.shift();
    if (!enemigoFrente.estaVivo()) enemigosActivos.shift();

    turnoGlobal++;

    // Verificar si terminó la batalla
    if (enemigosActivos.length === 0) {
        logGame("<br><strong style='color: #00ff66;'>🏆 ¡Victoria en este nodo! Volviendo al mapa...</strong>");
        pisoActual++; // Subimos un piso en el mapa general
        setTimeout(volverAlMapa, 2500);
    } else if (miEquipo.length === 0) {
        logGame("<br><strong style='color: #ff3333;'>💀 GAME OVER. Tu plaga se extinguió. Reiniciando mapa...</strong>");
        pisoActual = 0;
        setTimeout(volverAlMapa, 3000);
    }
});

function volverAlMapa() {
    if (pisoActual >= 5) {
        alert("¡Felicidades! Has infectado todo el órgano. ¡Victoria total en Viro.bee!");
        pisoActual = 0;
    }
    document.getElementById("pantalla-combate").className = "screen hidden";
    document.getElementById("pantalla-mapa").className = "screen";
    generarMapa();
}

// Inicializar el juego por primera vez al cargar
generarMapa();