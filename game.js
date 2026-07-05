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
                imprimir(`🛡️ El escudo de ${this.nombre} absorbió todo el impacto (${cantidad} dmg).`);
                return; 
            } else { 
                cantidad -= this.escudo; 
                imprimir(`🛡️ El escudo de ${this.nombre} recibió ${this.escudo} de daño y se rompió.`);
                this.escudo = 0; 
            }
        }
        this.vidaActual = Math.max(0, this.vidaActual - cantidad);
        imprimir(`💥 ${this.nombre} sufre ${cantidad} de daño. (Vida: ${this.vidaActual}/${this.vidaMax})`);
    }
    
    ejecutarAccion(objetivo, imprimir) {
        if (!this.estaVivo()) return;
        
        // Variación de daño del ±20%
        let mod = 0.8 + (Math.random() * 0.4); 
        let dañoFinal = Math.floor(this.dañoBase * mod);

        if (this.tipoEfecto === 'agresivo') {
            imprimir(`⚔️ <strong>${this.nombre}</strong> ataca con fuerza:`);
            objetivo.recibirDaño(dañoFinal, imprimir);
        } 
        else if (this.tipoEfecto === 'tanque') {
            imprimir(`🛡️ <strong>${this.nombre}</strong> golpea defensivamente:`);
            objetivo.recibirDaño(dañoFinal, imprimir);
            
            // --- BALANCE: El escudo ahora se basa en la vida ACTUAL y NO es acumulable ---
            this.escudo = Math.floor(this.vidaActual * 0.20); 
            imprimir(`🛡️ ${this.nombre} genera una barrera temporal de +${this.escudo} de escudo.`);
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
        new Personaje("Cepa Caparazón", 130, 8, 5, "tanque", "🛡️"),
        new Personaje("Cepa Alfa", 90, 26, 12, "agresivo", "🦠")
    ];
}

function actualizarInterfazVisual() {
    let virus = miEquipo[0];
    let enemigo = enemigosActivos[0];

    if (virus) {
        document.getElementById("virus-nombre").innerText = virus.nombre;
        document.getElementById("card-virus").querySelector(".actor-emoji").innerText = virus.emoji;
        document.getElementById("virus-stats").innerText = `HP: ${virus.vidaActual}/${virus.vidaMax} | Escudo: ${virus.escudo}`;
        let pctVida = (virus.vidaActual / virus.vidaMax) * 100;
        document.getElementById("virus-bar").style.width = `${pctVida}%`;
        let pctEscudo = Math.min(100, (virus.escudo / virus.vidaMax) * 100);
        document.getElementById("virus-shield-bar").style.width = `${pctEscudo}%`;
    }

    if (enemigo) {
        document.getElementById("enemigo-nombre").innerText = enemigo.nombre;
        document.getElementById("card-enemigo").querySelector(".actor-emoji").innerText = enemigo.emoji;
        document.getElementById("enemigo-stats").innerText = `HP: ${enemigo.vidaActual}/${enemigo.vidaMax}`;
        let pctVidaEnemigo = (enemigo.vidaActual / enemigo.vidaMax) * 100;
        document.getElementById("enemigo-bar").style.width = `${pctVidaEnemigo}%`;
        document.getElementById("enemigo-shield-bar").style.width = `0%`;
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
    nodoActualId = nodo.id; 
    turnoGlobal = 1;

    const consola = document.getElementById("log-consola");
    consola.innerHTML = "";
    
    // Control de elementos visuales
    const displayCombate = document.querySelector(".battle-display");
    const btn1x = document.getElementById("btn-velocidad-1x");
    const btn3x = document.getElementById("btn-velocidad-3x");
    const btnSalir = document.getElementById("btn-salir-nodo");

    if (nodo.tipo === "🏪 Lab") {
        // --- FLUJO CORREGIDO: Ocultamos la arena de combate para el Lab ---
        displayCombate.style.display = "none";
        btn1x.classList.add("hidden");
        btn3x.classList.add("hidden");
        btnSalir.classList.remove("hidden");

        consola.innerHTML = `<h3 style='color: #00ff66;'>🔬 [LABORATORIO DE REPLICACIÓN]</h3>
        <p>Has encontrado un sector seguro del organismo sin patrullaje inmune. Tus cepas aprovechan para reestructurar su ARN.</p><br>`;
        
        miEquipo.forEach(v => {
            let curar = Math.floor(v.vidaMax * 0.4);
            v.vidaActual = Math.min(v.vidaMax, v.vidaActual + curar);
            consola.innerHTML += `<p style='color: #00ff66;'>💚 <strong>${v.nombre}</strong> regenera sus membranas: +${curar} HP (Actual: ${v.vidaActual}/${v.vidaMax})</p>`;
        });
        enemigosActivos = [];
    } 
    else {
        // Mostramos la arena de combate si es un enemigo
        displayCombate.style.display = "flex";
        btn1x.classList.remove("hidden");
        btn3x.classList.remove("hidden");
        btn1x.disabled = false;
        btn3x.disabled = false;
        btnSalir.classList.add("hidden");

        // --- RE-BALANCEO: Subimos significativamente el daño de los enemigos ---
        if (nodo.tipo === "👑 JEFE CEREBRO") enemigosActivos = [new Personaje("NÚCLEO CENTRAL", 240, 26, 6, "agresivo", "🧠")];
        else if (nodo.tipo === "⚔️ Linfocito") enemigosActivos = [new Personaje("Linfocito T-Cazador", 80, 22, 11, "agresivo", "🏹")];
        else if (nodo.tipo === "❓ Evento") enemigosActivos = [new Personaje("Glóbulo Mutado", 50, 10, 4, "agresivo", "☣️")];
        else enemigosActivos = [new Personaje("Célula Epitelial", 70, 16, 8, "agresivo", "⚪")];

        actualizarInterfazVisual();
        consola.innerHTML = `<p class='system-msg' style='color:#58a6ff;'>🧬 Infiltrándose en tejido hostil. Enemigo detectado...</p>`;
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

    logGame(`<br><span style='color: #8b949e;'>[ TURNO ${turnoGlobal} ]</span>`);
    
    let virusFrente = miEquipo[0];
    let enemigoFrente = enemigosActivos[0];

    // --- RE-BALANCEO: El escudo anterior del virus caduca al inicio del turno ---
    virusFrente.escudo = 0;

    let luchadores = [virusFrente, enemigoFrente].sort((a, b) => b.velocidad - a.velocidad);

    luchadores.forEach(luchador => {
        if (!luchador.estaVivo()) return;
        let obj = (luchador === virusFrente) ? enemigoFrente : virusFrente;
        luchador.ejecutarAccion(obj, logGame);
    });

    if (!virusFrente.estaVivo()) {
        logGame(`<span style='color: #ff3333;'>💀 ${virusFrente.nombre} ha sido neutralizado.</span>`);
        miEquipo.shift();
    }
    if (!enemigoFrente.estaVivo()) {
        logGame(`<span style='color: #ff3333;'>💀 ${enemigoFrente.nombre} ha sido desintegrado.</span>`);
        enemigosActivos.shift();
    }

    actualizarInterfazVisual();
    turnoGlobal++;

    if (enemigosActivos.length === 0 || miEquipo.length === 0) {
        clearInterval(intervaloCombate);
        intervaloCombate = null;

        if (enemigosActivos.length === 0) {
            logGame("<br><strong style='color: #00ff66;'>🏆 ¡Ruta asimilada! Avanzando...</strong>");
            pisoActual++; setTimeout(volverAlMapa, 2000);
        } else {
            logGame("<br><strong style='color: #ff3333;'>💀 LA PLAGA FRACASÓ. El sistema inmune limpió la zona.</strong>");
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