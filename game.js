class Personaje {
    constructor(nombre, vidaMax, daño, velocidad, tipoEfecto, emoji, desc) {
        this.nombre = nombre;
        this.vidaMax = vidaMax;
        this.vidaActual = vidaMax;
        this.dañoBase = daño;
        this.velocidadBase = velocidad;
        this.velocidad = velocidad;
        this.tipoEfecto = tipoEfecto; 
        this.emoji = emoji;
        this.desc = desc;
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
                imprimir(`🛡️ El escudo de ${this.nombre} mitigó ${this.escudo} de daño antes de romperse.`);
                this.escudo = 0; 
            }
        }
        this.vidaActual = Math.max(0, this.vidaActual - cantidad);
        imprimir(`💥 ${this.nombre} sufre ${cantidad} de daño. (Vida: ${this.vidaActual}/${this.vidaMax})`);
    }
    
    ejecutarAccion(objetivo, aliadoEnCola, imprimir) {
        if (!this.estaVivo()) return;
        
        let mod = 0.8 + (Math.random() * 0.4); 
        let dañoFinal = Math.floor(this.dañoBase * mod);

        if (this.tipoEfecto === 'agresivo') {
            // --- SINERGIA ALFA: Si hay un aliado vivo detrás y este virus (o el aliado previo) dejó escudo ---
            // Revisamos si este virus tiene escudo activo para potenciar su ataque por hermandad
            if (this.escudo > 0) {
                let bono = Math.floor(this.escudo * 0.5);
                dañoFinal += bono;
                imprimir(`🔥 <strong>¡SINERGIA VIRAL!</strong> ${this.nombre} se potencia con la defensa activa y suma +${bono} de daño elemental.`);
            }
            imprimir(`⚔️ <strong>${this.nombre}</strong> ataca con fuerza:`);
            objetivo.recibirDaño(dañoFinal, imprimir);
        } 
        else if (this.tipoEfecto === 'tanque') {
            imprimir(`🛡️ <strong>${this.nombre}</strong> golpea defensivamente:`);
            objetivo.recibirDaño(dañoFinal, imprimir);
            
            this.escudo = Math.floor(this.vidaActual * 0.20); 
            imprimir(`🛡️ ${this.nombre} levanta una barrera celular de +${this.escudo} de escudo.`);

            // --- SINERGIA TANQUE: Si hay otro virus vivo en la reserva detrás de él, le hereda velocidad ---
            if (aliadoEnCola && aliadoEnCola.estaVivo()) {
                aliadoEnCola.velocidad += 3;
                imprimir(`⚡ <strong>Sinergia de Colmena:</strong> La fricción del escudo acelera a ${aliadoEnCola.nombre} (+3 Velocidad para el turno).`);
            }
        }
    }
}

// --- VARIABLES DE CONTROL ---
let pisoActual = 0;
let nodoActualId = null;
let mapaDatos = [];
let miEquipoGlobal = []; // El inventario persistente del jugador
let enemigosActivos = [];
let turnoGlobal = 1;
let intervaloCombate = null;

const TIPOS_NODOS = ["⚔️ Celula", "⚔️ Linfocito", "❓ Evento", "🏪 Lab"];

// Instanciamos los virus una sola vez al cargar la app
function inicializarEquipoJugador() {
    miEquipoGlobal = [
        new Personaje("Cepa Caparazón", 130, 8, 5, "tanque", "🛡️", "Genera barreras y acelera al virus que viene detrás."),
        new Personaje("Cepa Alfa", 90, 26, 12, "agresivo", "🦠", "Aumenta drásticamente su daño si ataca teniendo escudo.")
    ];
    actualizarInterfazGestionEquipo();
}

// Renderiza los virus arriba de la pantalla del mapa
function actualizarInterfazGestionEquipo() {
    if (miEquipoGlobal.length < 2) return;
    
    document.getElementById("slot-0-emoji").innerText = miEquipoGlobal[0].emoji;
    document.getElementById("slot-0-nombre").innerText = miEquipoGlobal[0].nombre;
    document.getElementById("slot-0-desc").innerText = miEquipoGlobal[0].desc;

    document.getElementById("slot-1-emoji").innerText = miEquipoGlobal[1].emoji;
    document.getElementById("slot-1-nombre").innerText = miEquipoGlobal[1].nombre;
    document.getElementById("slot-1-desc").innerText = miEquipoGlobal[1].desc;
}

// Botón para alterar la fila antes de entrar a combatir
document.getElementById("btn-invertir-orden").addEventListener("click", () => {
    // Intercambiamos posiciones en el array
    let temporal = miEquipoGlobal[0];
    miEquipoGlobal[0] = miEquipoGlobal[1];
    miEquipoGlobal[1] = temporal;
    actualizarInterfazGestionEquipo();
});

function actualizarInterfazVisual() {
    let virus = miEquipoGlobal[0]; // El primero vivo de la fila global peleando
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
    
    const displayCombate = document.querySelector(".battle-display");
    const btn1x = document.getElementById("btn-velocidad-1x");
    const btn3x = document.getElementById("btn-velocidad-3x");
    const btnSalir = document.getElementById("btn-salir-nodo");

    // Limpiar velocidades alteradas por sinergias previas al entrar a pelear
    miEquipoGlobal.forEach(v => v.velocidad = v.velocidadBase);

    if (nodo.tipo === "🏪 Lab") {
        displayCombate.style.display = "none";
        btn1x.classList.add("hidden");
        btn3x.classList.add("hidden");
        btnSalir.classList.remove("hidden");

        consola.innerHTML = `<h3 style='color: #00ff66;'>🔬 [LABORATORIO DE REPLICACIÓN]</h3>`;
        miEquipoGlobal.forEach(v => {
            let curar = Math.floor(v.vidaMax * 0.4);
            v.vidaActual = Math.min(v.vidaMax, v.vidaActual + curar);
            consola.innerHTML += `<p style='color: #00ff66;'>💚 <strong>${v.nombre}</strong> reestructurado: +${curar} HP (${v.vidaActual}/${v.vidaMax})</p>`;
        });
        enemigosActivos = [];
    } 
    else {
        displayCombate.style.display = "flex";
        btn1x.classList.remove("hidden");
        btn3x.classList.remove("hidden");
        btn1x.disabled = false;
        btn3x.disabled = false;
        btnSalir.classList.add("hidden");

        if (nodo.tipo === "👑 JEFE CEREBRO") enemigosActivos = [new Personaje("NÚCLEO CENTRAL", 240, 26, 6, "agresivo", "🧠")];
        else if (nodo.tipo === "⚔️ Linfocito") enemigosActivos = [new Personaje("Linfocito T-Cazador", 80, 22, 11, "agresivo", "🏹")];
        else if (nodo.tipo === "❓ Evento") enemigosActivos = [new Personaje("Glóbulo Mutado", 50, 10, 4, "agresivo", "☣️")];
        else enemigosActivos = [new Personaje("Célula Epitelial", 70, 16, 8, "agresivo", "⚪")];

        actualizarInterfazVisual();
        consola.innerHTML = `<p class='system-msg' style='color:#58a6ff;'>🧬 Tejido hostil alcanzado. Desplegando cepas en orden...</p>`;
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

    // Filtrar los virus vivos reales en este microsegundo
    let virusVivos = miEquipoGlobal.filter(v => v.estaVivo());

    if (virusVivos.length === 0 || enemigosActivos.length === 0) return;

    logGame(`<br><span style='color: #8b949e;'>[ TURNO ${turnoGlobal} ]</span>`);
    
    let virusFrente = virusVivos[0];
    let virusReserva = virusVivos[1] || null; // El segundo en fila si existe
    let enemigoFrente = enemigosActivos[0];

    // Reset de escudo al inicio
    virusFrente.escudo = 0;

    let luchadores = [virusFrente, enemigoFrente].sort((a, b) => b.velocidad - a.velocidad);

    luchadores.forEach(luchador => {
        if (!luchador.estaVivo()) return;
        if (luchador === virusFrente) {
            // Pasamos al aliado de reserva como segundo parámetro para activar las sinergias
            luchador.ejecutarAccion(enemigoFrente, virusReserva, logGame);
        } else {
            luchador.ejecutarAccion(virusFrente, null, logGame);
        }
    });

    actualizarInterfazVisual();

    if (!virusFrente.estaVivo()) {
        logGame(`<span style='color: #ff3333;'>💀 ${virusFrente.nombre} ha caído desintegrado.</span>`);
    }
    if (!enemigoFrente.estaVivo()) {
        logGame(`<span style='color: #ff3333;'>💀 ${enemigoFrente.nombre} ha sido destruido.</span>`);
        enemigosActivos.shift();
    }

    // Actualizar referencia tras muertes
    virusVivos = miEquipoGlobal.filter(v => v.estaVivo());
    turnoGlobal++;

    if (enemigosActivos.length === 0 || virusVivos.length === 0) {
        clearInterval(intervaloCombate);
        intervaloCombate = null;

        if (enemigosActivos.length === 0) {
            logGame("<br><strong style='color: #00ff66;'>🏆 ¡Ruta asimilada!</strong>");
            pisoActual++; setTimeout(volverAlMapa, 2000);
        } else {
            logGame("<br><strong style='color: #ff3333;'>💀 LA PLAGA FRACASÓ.</strong>");
            setTimeout(reiniciarJuegoTotal, 2500);
        }
    }
}

function volverAlMapa() {
    if (pisoActual >= 5) { alert("💥 ¡ÓRGANO TOTALMENTE DESTRUIDO! Victoria en Viro.bee."); reiniciarJuegoTotal(); return; }
    document.getElementById("pantalla-combate").className = "screen hidden";
    document.getElementById("pantalla-mapa").className = "screen";
    actualizarInterfazGestionEquipo();
    dibujarMapa();
}

function reiniciarJuegoTotal() {
    document.getElementById("pantalla-combate").className = "screen hidden";
    document.getElementById("pantalla-mapa").className = "screen";
    generarMapa();
}

generarMapa();