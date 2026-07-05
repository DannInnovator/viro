// --- CLASE PERSONAJE (MANTIENE LA LÓGICA BASE) ---
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

// --- VARIABLES DE ESTADO ---
let pisoActual = 0;
let nodoActualId = null; // Guarda el ID del último nodo completado
let mapaDatos = [];
let miEquipo = [];
let enemigosActivos = [];
let turnoGlobal = 1;
let intervaloCombate = null; // Controla el temporizador del Auto-Avance

const TIPOS_NODOS = ["⚔️ Celula", "⚔️ Linfocito", "❓ Evento", "🏪 Lab"];

// --- GENERACIÓN DEL MAPA CON CONEXIONES REALES ---
function generarMapa() {
    mapaDatos = [];
    pisoActual = 0;
    nodoActualId = null;

    // 1. Crear los nodos por cada uno de los 5 pisos
    for (let i = 0; i < 5; i++) {
        let nodosEnPiso = [];
        let cantidadNodos = (i === 4) ? 1 : Math.floor(Math.random() * 2) + 2; // El último piso es 1 solo Jefe
        
        for (let j = 0; j < cantidadNodos; j++) {
            let tipoAleatorio = (i === 4) ? "👑 JEFE CEREBRO" : TIPOS_NODOS[Math.floor(Math.random() * TIPOS_NODOS.length)];
            nodosEnPiso.push({
                tipo: tipoAleatorio,
                id: `${i}-${j}`,
                piso: i,
                indice: j,
                conexiones: [] // Guardará los índices de los nodos del piso SUPERIOR a los que se puede ir
            });
        }
        mapaDatos.push(nodosEnPiso);
    }

    // 2. Crear los caminos (Conexiones) entre pisos consecutivamente
    for (let i = 0; i < mapaDatos.length - 1; i++) {
        let pisoSiguiente = mapaDatos[i + 1];
        mapaDatos[i].forEach(nodo => {
            // Cada nodo se conecta al menos con el nodo que tiene encima directamente o uno cercano
            let indexSiguienteOpcion = Math.min(nodo.indice, pisoSiguiente.length - 1);
            nodo.conexiones.push(pisoSiguiente[indexSiguienteOpcion].id);
            
            // Un 50% de probabilidad de abrir un camino ramificado extra a los lados si existen
            if (Math.random() > 0.5 && indexSiguienteOpcion + 1 < pisoSiguiente.length) {
                nodo.conexiones.push(pisoSiguiente[indexSiguienteOpcion + 1].id);
            }
        });
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
            
            // Mostrar visualmente las rutas que abre este nodo
            let textoConexiones = nodo.conexiones.length > 0 ? ` ➔ (${nodo.conexiones.map(c => c.split('-')[1]).join(',')})` : '';
            btn.innerText = `${nodo.tipo}${textoConexiones}`;
            
            // REGLA DE CAMINO EXCLUSIVO:
            let esDisponible = false;
            if (pisoActual === 0 && nodo.piso === 0) {
                esDisponible = true; // Primer piso: todos disponibles
            } else if (nodo.piso === pisoActual && nodoActualId) {
                // Pisos siguientes: solo si el nodo anterior guardaba conexión con este ID
                let nodoAnterior = buscarNodoPorId(nodoActualId);
                if (nodoAnterior && nodoAnterior.conexiones.includes(nodo.id)) {
                    esDisponible = true;
                }
            }

            if (esDisponible) {
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

function buscarNodoPorId(id) {
    for (let piso of mapaDatos) {
        let encontrado = piso.find(n => n.id === id);
        if (encontrado) return encontrado;
    }
    return null;
}

// --- GESTIÓN DEL COMBATE ---
function iniciarNodo(nodo) {
    document.getElementById("pantalla-mapa").className = "screen hidden";
    document.getElementById("pantalla-combate").className = "screen";
    
    // Guardamos qué nodo estamos jugando
    nodoActualId = nodo.id;

    const consola = document.getElementById("log-consola");
    consola.innerHTML = `<p class='system-msg' style='color:#0ff;'>🧬 Invadiendo: ${nodo.tipo}</p>`;

    miEquipo = [
        new Personaje("Cepa Caparazón", 120, 5, 5, "tanque"),
        new Personaje("Cepa Alfa", 80, 22, 12, "agresivo")
    ];

    enemigosActivos = [new Personaje(nodo.tipo.replace("⚔️ ", ""), 70, 14, 10, "agresivo")];
    turnoGlobal = 1;

    // Cambiar texto del botón a modo automático
    const btnTurno = document.getElementById("btn-siguiente-turno");
    btnTurno.innerText = "⏳ AUTOMATIZAR INFECCIÓN (1s/turno)";
    btnTurno.disabled = false;
}

// Evento del botón de avance
document.getElementById("btn-siguiente-turno").addEventListener("click", () => {
    // Si ya está corriendo un bucle, no creamos otro
    if (intervaloCombate) return;

    document.getElementById("btn-siguiente-turno").disabled = true;
    
    // Dispara el loop automático que corre CADA 1000 milisegundos (1 segundo)
    intervaloCombate = setInterval(ejecutarUnTurno, 1000);
});

function ejecutarUnTurno() {
    const consola = document.getElementById("log-consola");
    function logGame(texto) {
        consola.innerHTML += `<p>${texto}</p>`;
        consola.scrollTop = consola.scrollHeight;
    }

    logGame(`<br><span style='color: #8b949e;'>[ TURNO ${turnoGlobal} ]</span>`);
    
    let virusFrente = miEquipo[0];
    let enemigoFrente = enemigosActivos[0];
    let luchadores = [virusFrente, enemigoFrente].sort((a, b) => b.velocidad - a.velocidad);

    luchadores.forEach(luchador => {
        if (!luchador.estaVivo()) return;
        let obj = (luchador === virusFrente) ? enemigoFrente : virusFrente;
        luchador.ejecutarAccion(obj, logGame);
        if (!obj.estaVivo()) logGame(`<span style='color: #ff3333;'>💀 ${obj.nombre} colapsó.</span>`);
    });

    if (!virusFrente.estaVivo()) miEquipo.shift();
    if (!enemigoFrente.estaVivo()) enemigosActivos.shift();

    turnoGlobal++;

    // CONDICIONES DE PARADA (Fin del combate)
    if (enemigosActivos.length === 0 || miEquipo.length === 0) {
        clearInterval(intervaloCombate); // Detiene el reloj de 1 segundo
        intervaloCombate = null;

        if (enemigosActivos.length === 0) {
            logGame("<br><strong style='color: #00ff66;'>🏆 ¡Ruta despejada! Avanzando en el mapa...</strong>");
            pisoActual++; 
            setTimeout(volverAlMapa, 2000);
        } else {
            logGame("<br><strong style='color: #ff3333;'>💀 PLANTA ELIMINADA. Reiniciando cepa...</strong>");
            setTimeout(reiniciarJuegoTotal, 2500);
        }
    }
}

function volverAlMapa() {
    if (pisoActual >= 5) {
        alert("💥 ¡ÓRGANO TOTALMENTE DESTRUIDO! Victoria total en Viro.bee.");
        reiniciarJuegoTotal();
        return;
    }
    document.getElementById("pantalla-combate").className = "screen hidden";
    document.getElementById("pantalla-mapa").className = "screen";
    dibujarMapa(); // Redibuja respetando las nuevas restricciones de camino
}

function reiniciarJuegoTotal() {
    document.getElementById("pantalla-combate").className = "screen hidden";
    document.getElementById("pantalla-mapa").className = "screen";
    generarMapa();
}

// Arrancar juego al cargar
generarMapa();