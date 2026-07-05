class Personaje {
    constructor(nombre, vidaMax, daño, velocidad, tipoEfecto, emoji) {
        this.nombre = nombre;
        this.vidaMax = vidaMax;
        this.vidaActual = vidaMax;
        this.dañoBase = daño;
        this.velocidad = velocidad;
        this.tipoEfecto = tipoEfecto; 
        this.emoji = emoji;
        this.escudo = 0;
    }
    
    estaVivo() { return this.vidaActual > 0; }
    
    recibirDaño(cantidad, imprimir) {
        if (this.escudo > 0) {
            if (cantidad <= this.escudo) { 
                this.escudo -= cantidad; 
                imprimir(`🛡️ El escudo de ${this.nombre} absorbió todo.`);
                return; 
            } else { 
                cantidad -= this.escudo; 
                this.escudo = 0; 
            }
        }
        this.vidaActual = Math.max(0, this.vidaActual - cantidad);
        imprimir(`💥 ${this.nombre} sufre ${cantidad} de daño.`);
    }
    
    ejecutarAccion(objetivo, imprimir) {
        if (!this.estaVivo()) return;
        
        let mod = 0.8 + (Math.random() * 0.4); 
        let dañoFinal = Math.floor(this.dañoBase * mod);

        if (this.tipoEfecto === 'agresivo') {
            imprimir(`⚔️ <strong>${this.nombre}</strong> ataca.`);
            objetivo.recibirDaño(dañoFinal, imprimir);
        } 
        else if (this.tipoEfecto === 'tanque') {
            imprimir(`🛡️ <strong>${this.nombre}</strong> arremete defensivo.`);
            objetivo.recibirDaño(dañoFinal, imprimir);
            let genEscudo = Math.floor(this.vidaMax * 0.20);
            this.escudo += genEscudo;
            imprimir(`🛡️ ${this.nombre} genera +${genEscudo} de protección.`);
        }
    }
}

// --- VARIABLES DE CONTROL ---
let pisoActual = 0;
let nodoActualId = null;
let mapaDatos = [];
let miEquipo = [];
let enemigosActivos = [];
let turnoGlobal = 1;
let intervaloCombate = null;

const TIPOS_NODOS = ["⚔️ Celula", "⚔️ Linfocito", "❓ Evento", "🏪 Lab"];

function inicializarEquipoJugador() {
    miEquipo = [
        new Personaje("Cepa Caparazón", 140, 6, 5, "tanque", "🛡️"),
        new Personaje("Cepa Alfa", 90, 25, 12, "agresivo", "🦠")
    ];
}

// --- ACTUALIZACIÓN DE BARRAS DE VIDA (MECÁNICA NUEVA) ---
function actualizarInterfazVisual() {
    let virus = miEquipo[0];
    let enemigo = enemigosActivos[0];

    // Actualizar datos del Virus (Izquierda)
    if (virus) {
        document.getElementById("virus-nombre").innerText = virus.nombre;
        document.getElementById("card-virus").querySelector(".actor-emoji").innerText = virus.emoji;
        document.getElementById("virus-stats").innerText = `HP: ${virus.vidaActual}/${virus.vidaMax} | Escudo: ${virus.escudo}`;
        
        let pctVida = (virus.vidaActual / virus.vidaMax) * 100;
        document.getElementById("virus-bar").style.width = `${pctVida}%`;
        
        let pctEscudo = Math.min(100, (virus.escudo / virus.vidaMax) * 100);
        document.getElementById("virus-shield-bar").style.width = `${pctEscudo}%`;
    }

    // Actualizar datos del Enemigo (Derecha)
    if (enemigo) {
        document.getElementById("enemigo-nombre").innerText = enemigo.nombre;
        document.getElementById("card-enemigo").querySelector(".actor-emoji").innerText = enemigo.emoji;
        document.getElementById("enemigo-stats").innerText = `HP: ${enemigo.vidaActual}/${enemigo.vidaMax}`;
        
        let pctVidaEnemigo = (enemigo.vidaActual / enemigo.vidaMax) * 100;
        document.getElementById("enemigo-bar").style.width = `${pctVidaEnemigo}%`;
        document.getElementById("enemigo-shield-bar").style.width = `0%`; // Enemigos base no tienen escudo por ahora
    }
}

function generarMapa() {
    mapaDatos = []; pisoActual = 0; nodoActualId = null;
    inicializarEquipoJugador();

    for (let i = 0; i < 5; i++) {
        let nodosEnPiso = [];
        let cantidadNodos = (i === 4) ? 1 : Math.floor(Math.random() * 2) + 2; 
        for (let j = 0; j < cantidadNodos; j++) {
            let tipoAleatorio = (i === 4) ? "👑 JEFE CEREBRO" : TIPOS_NODOS[Math.floor(Math.random() * TIPOS_NODOS.length)];
            nodosEnPiso.push({ tipo: tipoAleatorio, id: `${i}-${j}`, piso: i, indice: j, conexiones: [] });
        }
        mapaDatos.push(nodosEnPiso);
    }

    for (let i = 0; i < mapaDatos.length - 1; i++) {
        let pisoSiguiente = mapaDatos[i + 1];
        mapaDatos[i].forEach(nodo => {
            let idx = Math.min(nodo.indice, pisoSiguiente.length - 1);
            nodo.conexiones.push(pisoSiguiente[idx].id);
            if (Math.random() > 0.5 && idx + 1 < pisoSiguiente.length) nodo.conexiones.push(pisoSiguiente[idx + 1].id);
        });
    }
    dibujarMapa();
}

function dibujarMapa() {
    const contenedor = document.getElementById("mapa-nodos");
    contenedor.innerHTML = "";
    mapaDatos.forEach(piso => {
        const filaDiv = document.createElement("div");
        filaDiv.className = "map-row";
        piso.forEach(nodo => {
            const btn = document.createElement("button");
            btn.className = "nodo-btn";
            let textoConexiones = nodo.conexiones.length > 0 ? ` ➔ (${nodo.conexiones.map(c => c.split('-')[1]).join(',')})` : '';
            btn.innerText = `${nodo.tipo}${textoConexiones}`;
            
            let esDisponible = false;
            if (pisoActual === 0 && nodo.piso === 0) esDisponible = true;
            else if (nodo.piso === pisoActual && nodoActualId) {
                let nodoAnterior = mapaDatos[pisoActual-1].find(n => n.id === nodoActualId);
                if (nodoAnterior && nodoAnterior.conexiones.includes(nodo.id)) esDisponible = true;
            }

            if (esDisponible) { btn.className += " disponible"; btn.onclick = () => iniciarNodo(nodo); } 
            else { btn.disabled = true; }
            filaDiv.appendChild(btn);
        });
        contenedor.appendChild(filaDiv);
    });
}

function iniciarNodo(nodo) {
    document.getElementById("pantalla-mapa").className = "screen hidden";
    document.getElementById("pantalla-combate").className = "screen";
    nodoActualId = nodo.id; turnoGlobal = 1;

    const consola = document.getElementById("log-consola");
    consola.innerHTML = "";
    
    document.getElementById("btn-velocidad-1x").classList.remove("hidden");
    document.getElementById("btn-velocidad-3x").classList.remove("hidden");
    document.getElementById("btn-velocidad-1x").disabled = false;
    document.getElementById("btn-velocidad-3x").disabled = false;
    document.getElementById("btn-salir-nodo").classList.add("hidden");

    function logGame(texto) { consola.innerHTML += `<p>${texto}</p>`; }

    if (nodo.tipo === "🏪 Lab") {
        logGame(`<span style='color: #00ff66;'>🔬 [LABORATORIO] Mutación segura.</span>`);
        miEquipo.forEach(v => {
            let curar = Math.floor(v.vidaMax * 0.4);
            v.vidaActual = Math.min(v.vidaMax, v.vidaActual + curar);
            logGame(`💚 Se restauran ${curar} HP a ${v.nombre}.`);
        });
        enemigosActivos = [];
        actualizarInterfazVisual();
        document.getElementById("btn-velocidad-1x").classList.add("hidden");
        document.getElementById("btn-velocidad-3x").classList.add("hidden");
        document.getElementById("btn-salir-nodo").classList.remove("hidden");
    } 
    else {
        if (nodo.tipo === "👑 JEFE CEREBRO") enemigosActivos = [new Personaje("NÚCLEO CENTRAL", 220, 22, 6, "agresivo", "🧠")];
        else if (nodo.tipo === "⚔️ Linfocito") enemigosActivos = [new Personaje("Linfocito T", 75, 18, 11, "agresivo", "🏹")];
        else if (nodo.tipo === "❓ Evento") enemigosActivos = [new Personaje("Glóbulo Mutado", 45, 8, 4, "agresivo", "☣️")];
        else enemigosActivos = [new Personaje("Célula Epitelial", 65, 12, 8, "agresivo", "⚪")];

        actualizarInterfazVisual();
    }
}

document.getElementById("btn-velocidad-1x").addEventListener("click", () => comenzarBucle(1000));
document.getElementById("btn-velocidad-3x").addEventListener("click", () => comenzarBucle(333));
document.getElementById("btn-salir-nodo").addEventListener("click", () => { pisoActual++; volverAlMapa(); });

function comenzarBucle(ms) {
    document.getElementById("btn-velocidad-1x").disabled = true;
    document.getElementById("btn-velocidad-3x").disabled = true;
    intervaloCombate = setInterval(ejecutarUnTurno, ms);
}

function ejecutarUnTurno() {
    const consola = document.getElementById("log-consola");
    function logGame(texto) { consola.innerHTML += `<p>${texto}</p>`; consola.scrollTop = consola.scrollHeight; }

    if (miEquipo.length === 0 || enemigosActivos.length === 0) return;

    logGame(`<span style='color: #8b949e;'>[ TURNO ${turnoGlobal} ]</span>`);
    
    let virusFrente = miEquipo[0];
    let enemigoFrente = enemigosActivos[0];
    let luchadores = [virusFrente, enemigoFrente].sort((a, b) => b.velocidad - a.velocidad);

    luchadores.forEach(luchador => {
        if (!luchador.estaVivo()) return;
        let obj = (luchador === virusFrente) ? enemigoFrente : virusFrente;
        luchador.ejecutarAccion(obj, logGame);
    });

    actualizarInterfazVisual(); // 💥 SE ACTUALIZAN LAS BARRAS EN TIEMPO REAL TRAS LOS GOLPES

    if (!virusFrente.estaVivo()) {
        logGame(`<span style='color: #ff3333;'>💀 ${virusFrente.nombre} disuelto.</span>`);
        miEquipo.shift();
    }
    if (!enemigoFrente.estaVivo()) {
        logGame(`<span style='color: #ff3333;'>💀 ${enemigoFrente.nombre} destruido.</span>`);
        enemigosActivos.shift();
    }

    actualizarInterfazVisual(); // Actualización de limpieza por si entra el siguiente virus en fila
    turnoGlobal++;

    if (enemigosActivos.length === 0 || miEquipo.length === 0) {
        clearInterval(intervaloCombate);
        intervaloCombate = null;

        if (enemigosActivos.length === 0) {
            logGame("<br><strong style='color: #00ff66;'>🏆 ¡Ruta asimilada!</strong>");
            pisoActual++; setTimeout(volverAlMapa, 2000);
        } else {
            logGame("<br><strong style='color: #ff3333;'>💀 INFECCIÓN FRACASADA.</strong>");
            setTimeout(reiniciarJuegoTotal, 2500);
        }
    }
}

function volverAlMapa() {
    if (pisoActual >= 5) { alert("💥 ¡ÓRGANO TOTALMENTE DESTRUIDO! Victoria en Viro.bee."); reiniciarJuegoTotal(); return; }
    document.getElementById("pantalla-combate").className = "screen hidden";
    document.getElementById("pantalla-mapa").className = "screen";
    dibujarMapa();
}

function reiniciarJuegoTotal() {
    document.getElementById("pantalla-combate").className = "screen hidden";
    document.getElementById("pantalla-mapa").className = "screen";
    generarMapa();
}

generarMapa();