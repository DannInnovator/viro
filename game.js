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
                imprimir(`🛡️ El escudo de ${this.nombre} se rompió absorbiendo parte del daño.`);
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
            if (this.escudo > 0) {
                let bono = Math.floor(this.escudo * 0.5);
                dañoFinal += bono;
                imprimir(`🔥 <strong>¡Hermandad Viral!</strong> ${this.nombre} se potencia con el escudo y suma +${bono} de daño.`);
            }
            imprimir(`⚔️ <strong>${this.nombre}</strong> ataca con fuerza:`);
            objetivo.recibirDaño(dañoFinal, imprimir);
        } 
        else if (this.tipoEfecto === 'tanque') {
            imprimir(`🛡️ <strong>${this.nombre}</strong> golpea defensivamente:`);
            objetivo.recibirDaño(dañoFinal, imprimir);
            this.escudo = Math.floor(this.vidaActual * 0.20); 
            imprimir(`🛡️ ${this.nombre} levanta una barrera celular de +${this.escudo} de escudo.`);

            if (aliadoEnCola && aliadoEnCola.estaVivo()) {
                aliadoEnCola.velocidad += 4;
                imprimir(`⚡ <strong>Sinergia:</strong> ${this.nombre} acelera a ${aliadoEnCola.nombre} (+4 Vel).`);
            }
        }
    }
}

// --- POOL DE MUTACIONES (RECOMPENSAS) ---
const LISTA_MUTACIONES = [
    { nombre: "🧬 Púas de Proteína", desc: "Aumenta el daño base de AMBAS cepas en +4.", efecto: () => { miEquipoGlobal.forEach(v => v.dañoBase += 4); } },
    { nombre: "🧪 Membrana de Titanio", desc: "Suma +30 HP de Vida Máxima a todo tu equipo.", efecto: () => { miEquipoGlobal.forEach(v => { v.vidaMax += 30; v.vidaActual += 30; }); } },
    { nombre: "⚡ Flagelos Mutantes", desc: "Aumenta la velocidad base de tus virus en +3.", efecto: () => { miEquipoGlobal.forEach(v => { v.velocidadBase += 3; v.velocidad += 3; }); } },
    { nombre: "💚 Regeneración Flash", desc: "Cura instantáneamente el 50% de la salud a todo el equipo.", efecto: () => { miEquipoGlobal.forEach(v => v.vidaActual = Math.min(v.vidaMax, v.vidaActual + Math.floor(v.vidaMax * 0.5))); } }
];

// --- VARIABLES DE CONTROL ---
let pisoActual = 0;
let nodoActualId = null;
let mapaDatos = [];
let miEquipoGlobal = []; 
let enemigosActivos = [];
let turnoGlobal = 1;
let intervaloCombate = null;

const TIPOS_NODOS = ["⚔️ Celula", "⚔️ Linfocito", "❓ Evento", "🏪 Lab"];

function inicializarEquipoJugador() {
    miEquipoGlobal = [
        new Personaje("Cepa Caparazón", 130, 8, 5, "tanque", "🛡️", "Genera barreras y acelera al virus que viene detrás."),
        new Personaje("Cepa Alfa", 90, 26, 12, "agresivo", "🦠", "Aumenta drásticamente su daño si ataca teniendo escudo.")
    ];
    actualizarInterfazGestionEquipo();
}

function actualizarInterfazGestionEquipo() {
    if (miEquipoGlobal.length < 2) return;
    document.getElementById("slot-0-emoji").innerText = miEquipoGlobal[0].emoji;
    document.getElementById("slot-0-nombre").innerText = miEquipoGlobal[0].nombre;
    document.getElementById("slot-0-desc").innerText = miEquipoGlobal[0].desc;
    document.getElementById("slot-1-emoji").innerText = miEquipoGlobal[1].emoji;
    document.getElementById("slot-1-nombre").innerText = miEquipoGlobal[1].nombre;
    document.getElementById("slot-1-desc").innerText = miEquipoGlobal[1].desc;
}

document.getElementById("btn-invertir-orden").addEventListener("click", () => {
    let temporal = miEquipoGlobal[0];
    miEquipoGlobal[0] = miEquipoGlobal[1];
    miEquipoGlobal[1] = temporal;
    actualizarInterfazGestionEquipo();
});

// --- 🛠️ CORRECCIÓN EN EL REFRESCO VISUAL ---
function actualizarInterfazVisual() {
    // Filtramos dinámicamente el equipo para agarrar siempre al primer virus vivo real en ESTE milisegundo
    let virusVivos = miEquipoGlobal.filter(v => v.estaVivo());
    let virus = virusVivos[0]; 
    let enemigo = enemigosActivos[0];

    if (virus) {
        document.getElementById("virus-nombre").innerText = virus.nombre;
        document.getElementById("card-virus").querySelector(".actor-emoji").innerText = virus.emoji;
        document.getElementById("virus-stats").innerText = `HP: ${virus.vidaActual}/${virus.vidaMax} | Escudo: ${virus.escudo}`;
        
        let pctVida = (virus.vidaActual / virus.vidaMax) * 100;
        document.getElementById("virus-bar").style.width = `${pctVida}%`;
        
        let pctEscudo = Math.min(100, (virus.escudo / virus.vidaMax) * 100);
        document.getElementById("virus-shield-bar").style.width = `${pctEscudo}%`;
    } else {
        document.getElementById("virus-nombre").innerText = "Extinto";
        document.getElementById("virus-bar").style.width = `0%`;
        document.getElementById("virus-shield-bar").style.width = `0%`;
        document.getElementById("virus-stats").innerText = "HP: 0/0";
    }

    if (enemigo) {
        document.getElementById("enemigo-nombre").innerText = enemigo.nombre;
        document.getElementById("card-enemigo").querySelector(".actor-emoji").innerText = enemigo.emoji;
        document.getElementById("enemigo-stats").innerText = `HP: ${enemigo.vidaActual}/${enemigo.vidaMax}`;
        let pctVidaEnemigo = (enemigo.vidaActual / enemigo.vidaMax) * 100;
        document.getElementById("enemigo-bar").style.width = `${pctVidaEnemigo}%`;
    } else {
        document.getElementById("enemigo-nombre").innerText = "Destruido";
        document.getElementById("enemigo-bar").style.width = `0%`;
        document.getElementById("enemigo-stats").innerText = "HP: 0/0";
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
    
    const displayCombate = document.querySelector(".battle-display");
    const btn1x = document.getElementById("btn-velocidad-1x");
    const btn3x = document.getElementById("btn-velocidad-3x");
    const btnSalir = document.getElementById("btn-salir-nodo");

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
        consola.innerHTML = `<p class='system-msg' style='color:#58a6ff;'>🧬 Entrando a zona hostil...</p>`;
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

    // Evaluamos el equipo vivo al iniciar el tick de este turno
    let virusVivos = miEquipoGlobal.filter(v => v.estaVivo());
    if (virusVivos.length === 0 || enemigosActivos.length === 0) return;

    logGame(`<br><span style='color: #8b949e;'>[ TURNO ${turnoGlobal} ]</span>`);
    
    let virusFrente = virusVivos[0];
    let virusReserva = virusVivos[1] || null;
    let enemigoFrente = enemigosActivos[0];

    virusFrente.escudo = 0;

    let luchadores = [virusFrente, enemigoFrente].sort((a, b) => b.velocidad - a.velocidad);

    luchadores.forEach(luchador => {
        if (!luchador.estaVivo() || !enemigoFrente.estaVivo()) return;
        
        if (luchador === virusFrente) {
            luchador.ejecutarAccion(enemigoFrente, virusReserva, logGame);
        } else {
            luchador.ejecutarAccion(virusFrente, null, logGame);
        }
        
        // --- PARCHE DE ASINCRONÍA ---
        // Si el virus activo muere a mitad del turno, actualizamos la pantalla INMEDIATAMENTE
        // para que dibuje al virus de reserva en el slot activo antes de continuar.
        if (!virusFrente.estaVivo()) {
            actualizarInterfazVisual(); 
        }
    });

    if (!virusFrente.estaVivo()) {
        logGame(`<span style='color: #ff3333;'>💀 ${virusFrente.nombre} colapsó. Siguiente cepa al frente.</span>`);
    }
    if (!enemigoFrente.estaVivo()) {
        logGame(`<span style='color: #ff3333;'>💀 ${enemigoFrente.nombre} desintegrado.</span>`);
        enemigosActivos.shift();
    }

    // Refrescamos la interfaz completa
    actualizarInterfazVisual(); 
    
    // Volvemos a evaluar el estado general para el cierre del turno
    virusVivos = miEquipoGlobal.filter(v => v.estaVivo());
    turnoGlobal++;

    if (enemigosActivos.length === 0 || virusVivos.length === 0) {
        clearInterval(intervaloCombate);
        intervaloCombate = null;

        if (enemigosActivos.length === 0) {
            logGame("<br><strong style='color: #00ff66;'>🏆 ¡Combate ganado! Cargando mutaciones...</strong>");
            setTimeout(mostrarPantallaRecompensas, 1500); 
        } else {
            logGame("<br><strong style='color: #ff3333;'>💀 LA PLAGA FRACASÓ.</strong>");
            setTimeout(reiniciarJuegoTotal, 2500);
        }
    }
}

function mostrarPantallaRecompensas() {
    const consola = document.getElementById("log-consola");
    document.querySelector(".battle-display").style.display = "none"; 

    consola.innerHTML = `<h3 style='color: #8957e5;'>🎁 ¡MUTACIÓN ADQUIRIDA!</h3>
    <p style='color: #8b949e; margin-bottom: 15px;'>Elige 1 de los siguientes mutágenos para alterar el genoma de tu plaga de forma permanente:</p>
    <div id='contenedor-premios' style='display:flex; justify-content:space-around; gap:10px;'></div>`;

    let mezcladas = [...LISTA_MUTACIONES].sort(() => 0.5 - Math.random());
    let tresPremios = mezcladas.slice(0, 3);

    const divContenedor = document.getElementById("contenedor-premios");

    tresPremios.forEach(premio => {
        const btnPremio = document.createElement("button");
        btnPremio.style.cssText = "background:#1f2937; border:1px solid #8957e5; padding:12px; border-radius:6px; color:#fff; cursor:pointer; width:30%; font-size:0.75rem; font-family:inherit; display:flex; flex-direction:column; gap:5px;";
        btnPremio.innerHTML = `<strong style='color:#8957e5;'>${premio.nombre}</strong><span>${premio.desc}</span>`;
        
        btnPremio.onclick = () => {
            premio.efecto(); 
            alert(`¡Mutación aplicada con éxito!`);
            pisoActual++;
            volverAlMapa();
        };
        divContenedor.appendChild(btnPremio);
    });
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