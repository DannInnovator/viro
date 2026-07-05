class Personaje {
    constructor(nombre, vidaMax, daño, velocidad, tipoEfecto) {
        this.nombre = nombre;
        this.vidaMax = vidaMax;
        this.vidaActual = vidaMax;
        this.dañoBase = daño;
        this.velocidad = velocidad;
        this.tipoEfecto = tipoEfecto; 
        this.escudo = 0;
    }
    
    estaVivo() { return this.vidaActual > 0; }
    
    recibirDaño(cantidad, imprimir) {
        if (this.escudo > 0) {
            if (cantidad <= this.escudo) { 
                this.escudo -= cantidad; 
                imprimir(`🛡️ El escudo de ${this.nombre} absorbió el impacto.`);
                return; 
            } else { 
                cantidad -= this.escudo; 
                this.escudo = 0; 
            }
        }
        this.vidaActual -= cantidad;
        if (this.vidaActual < 0) this.vidaActual = 0;
        imprimir(`💥 ${this.nombre} recibe ${cantidad} de daño. (Vida: ${this.vidaActual}/${this.vidaMax})`);
    }
    
    ejecutarAccion(objetivo, imprimir) {
        if (!this.estaVivo()) return;
        
        // --- MECÁNICA: DAÑO ALEATORIZADO DE MULTIPLICADOR PARECIDO A POKÉMON (±20%) ---
        let modificadorAleatorio = 0.8 + (Math.random() * 0.4); // Entre 0.8 y 1.2
        let dañoFinal = Math.floor(this.dañoBase * modificadorAleatorio);

        if (this.tipoEfecto === 'agresivo') {
            imprimir(`⚔️ <strong>${this.nombre}</strong> lanza un ataque fulminante:`);
            objetivo.recibirDaño(dañoFinal, imprimir);
        } 
        else if (this.tipoEfecto === 'tanque') {
            imprimir(`🛡️ <strong>${this.nombre}</strong> golpea y se atrinchera:`);
            objetivo.recibirDaño(dañoFinal, imprimir);
            let generacionEscudo = Math.floor(this.vidaMax * 0.15);
            this.escudo += generacionEscudo;
            imprimir(`🛡️ Muro biológico reforzado: +${generacionEscudo} de escudo.`);
        }
    }
}

// --- VARIABLES GLOBALES DE CONTROL ---
let pisoActual = 0;
let nodoActualId = null;
let mapaDatos = [];
let miEquipo = [];
let enemigosActivos = [];
let turnoGlobal = 1;
let intervaloCombate = null;

const TIPOS_NODOS = ["⚔️ Celula", "⚔️ Linfocito", "❓ Evento", "🏪 Lab"];

// Generar persistentemente al equipo base del jugador para mantener su vida entre nodos si quisiéramos
function inicializarEquipoJugador() {
    miEquipo = [
        new Personaje("Cepa Caparazón", 130, 6, 5, "tanque"),
        new Personaje("Cepa Alfa", 85, 24, 12, "agresivo")
    ];
}

function generarMapa() {
    mapaDatos = [];
    pisoActual = 0;
    nodoActualId = null;
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
            let indexSiguienteOpcion = Math.min(nodo.indice, pisoSiguiente.length - 1);
            nodo.connections = [];
            nodo.conexiones.push(pisoSiguiente[indexSiguienteOpcion].id);
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

function iniciarNodo(nodo) {
    document.getElementById("pantalla-mapa").className = "screen hidden";
    document.getElementById("pantalla-combate").className = "screen";
    nodoActualId = nodo.id;
    turnoGlobal = 1;

    const consola = document.getElementById("log-consola");
    consola.innerHTML = "";
    
    // Reset de botones de control de velocidad
    document.getElementById("btn-velocidad-1x").classList.remove("hidden");
    document.getElementById("btn-velocidad-3x").classList.remove("hidden");
    document.getElementById("btn-velocidad-1x").disabled = false;
    document.getElementById("btn-velocidad-3x").disabled = false;
    document.getElementById("btn-salir-nodo").classList.add("hidden");

    function logGame(texto) { consola.innerHTML += `<p>${texto}</p>`; }

    // --- MECÁNICA: INTERACCIONES COMPLETAMENTE DISTINTAS POR NODO ---
    if (nodo.tipo === "🏪 Lab") {
        logGame(`<span style='color: #00ff66;'>🔬 [LABORATORIO BIOLÓGICO] Encuentras un entorno estéril para mutar en paz.</span>`);
        miEquipo.forEach(virus => {
            let curacion = Math.floor(virus.vidaMax * 0.4);
            virus.vidaActual = Math.min(virus.vidaMax, virus.vidaActual + curacion);
            logGame(`💚 Se restauran ${curacion} HP a ${virus.nombre}. (Vida: ${virus.vidaActual}/${virus.vidaMax})`);
        });
        // Desactivar botones de combate y activar salida directa
        document.getElementById("btn-velocidad-1x").classList.add("hidden");
        document.getElementById("btn-velocidad-3x").classList.add("hidden");
        document.getElementById("btn-salir-nodo").classList.remove("hidden");
    } 
    else if (nodo.tipo === "❓ Evento") {
        logGame(`<span style='color: #ffcc00;'>❓ [MUTACIÓN RADICAL] Un agente químico altera el entorno. Combatirás con ventaja.</span>`);
        enemigosActivos = [new Personaje("Glóbulo Débil", 40, 8, 4, "agresivo")];
    } 
    else if (nodo.tipo === "⚔️ Linfocito") {
        logGame(`<span style='color: #ff3333;'>⚠️ [ALERTA INMUNE] ¡Te topas con un Linfocito patrullero enfurecido! Daño enemigo incrementado.</span>`);
        enemigosActivos = [new Personaje("Linfocito T-Cazador", 75, 18, 11, "agresivo")]; // Enemigo potenciado
    } 
    else {
        logGame(`<span style='color: #58a6ff;'>⚔️ [INFILTRACIÓN] Una célula común bloquea los conductos.</span>`);
        enemigosActivos = [new Personaje("Célula Tejido", 65, 12, 8, "agresivo")];
    }
}

// Controladores de los bucles de tiempo
document.getElementById("btn-velocidad-1x").addEventListener("click", () => comenzarBucleCombate(1000));
document.getElementById("btn-velocidad-3x").addEventListener("click", () => comenzarBucleCombate(333));

document.getElementById("btn-salir-nodo").addEventListener("click", () => {
    pisoActual++;
    volverAlMapa();
});

function comenzarBucleCombate(velocidadMs) {
    document.getElementById("btn-velocidad-1x").disabled = true;
    document.getElementById("btn-velocidad-3x").disabled = true;
    intervaloCombate = setInterval(ejecutarUnTurno, velocidadMs);
}

function ejecutarUnTurno() {
    const consola = document.getElementById("log-consola");
    function logGame(texto) {
        consola.innerHTML += `<p>${texto}</p>`;
        consola.scrollTop = consola.scrollHeight;
    }

    if (miEquipo.length === 0 || enemigosActivos.length === 0) return;

    logGame(`<br><span style='color: #8b949e;'>[ TURNO ${turnoGlobal} ]</span>`);
    
    // Referencia dinámica al frente exacto en cada instante
    let virusFrente = miEquipo[0];
    let enemigoFrente = enemigosActivos[0];

    // Ordenamos copias por velocidad para el orden de este turno exclusivamente
    let luchadores = [virusFrente, enemigoFrente].sort((a, b) => b.velocidad - a.velocidad);

    luchadores.forEach(luchador => {
        if (!luchador.estaVivo()) return;
        let obj = (luchador === virusFrente) ? enemigoFrente : virusFrente;
        luchador.ejecutarAccion(obj, logGame);
        if (!obj.estaVivo()) logGame(`<span style='color: #ff3333;'>💀 ${obj.nombre} colapsó térmicamente.</span>`);
    });

    // Limpieza global de los caídos
    if (!virusFrente.estaVivo()) miEquipo.shift();
    if (!enemigoFrente.estaVivo()) enemigosActivos.shift();

    turnoGlobal++;

    // Verificar desenlaces
    if (enemigosActivos.length === 0 || miEquipo.length === 0) {
        clearInterval(intervaloCombate);
        intervaloCombate = null;

        if (enemigosActivos.length === 0) {
            logGame("<br><strong style='color: #00ff66;'>🏆 ¡Área asimilada! Volviendo al mapa...</strong>");
            pisoActual++;
            setTimeout(volverAlMapa, 2000);
        } else {
            logGame("<br><strong style='color: #ff3333;'>💀 LA CEPA HA SIDO ERRADICADA. Reiniciando simulación...</strong>");
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
    dibujarMapa();
}

function reiniciarJuegoTotal() {
    document.getElementById("pantalla-combate").className = "screen hidden";
    document.getElementById("pantalla-mapa").className = "screen";
    generarMapa();
}

// Carga inicial
generarMapa();