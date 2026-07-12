class Personaje {
    constructor(nombre, vidaMax, daño, velocidad, tipoEfecto, bgPos, diePos, desc, tipoBiologico, spriteSheet) {
        this.nombre = nombre;
        this.vidaMax = vidaMax;
        this.vidaActual = vidaMax;
        this.dañoBase = daño;
        this.velocidadBase = velocidad;
        this.velocidad = velocidad;
        this.tipoEfecto = tipoEfecto; 
        this.bgPos = bgPos; 
        this.diePos = diePos; 
        this.desc = desc;
        this.tipoBiologico = tipoBiologico; 
        this.spriteSheet = spriteSheet; 
        this.escudo = 0;
    }
    
    estaVivo() { return this.vidaActual > 0; }
    
    recibirDaño(cantidad, esVirus, imprimir) {
        if (this.escudo > 0) {
            if (cantidad <= this.escudo) { 
                this.escudo -= cantidad; 
                imprimir(`🛡️ El escudo de ${this.nombre} absorbió todo el impacto (${cantidad} dmg).`);
                return; 
            } else { 
                cantidad -= this.escudo; 
                imprimir(`🛡️ El escudo de ${this.nombre} se rompió mitigando ${this.escudo} de daño.`);
                this.escudo = 0; 
            }
        }
        this.vidaActual = Math.max(0, this.vidaActual - cantidad);
        imprimir(`💥 ${this.nombre} sufre ${cantidad} de daño.`);

        const idElemento = esVirus ? "virus-render-sprite" : "enemigo-render-sprite";
        const el = document.getElementById(idElemento);
        if (el && this.estaVivo()) {
            el.classList.add("anim-herido");
            setTimeout(() => el.classList.remove("anim-herido"), 300);
        }
    }
    
    ejecutarAccion(objetivo, aliadoEnCola, tipoCombate, imprimir) {
        if (!this.estaVivo()) return;
        
        let modAleatorio = 0.8 + (Math.random() * 0.4); 
        let dañoFinal = Math.floor(this.dañoBase * modAleatorio);

        if (this.tipoBiologico === 'Revestimiento' && tipoCombate === '⚔️ Linfocito') {
            dañoFinal = Math.floor(dañoFinal * 1.5);
            imprimir(`<span style='color: #00ff66;'>⭐ ¡TIPO EFECTIVO! Caparazón tritura al Linfocito.</span>`);
        } else if (this.tipoBiologico === 'Revestimiento' && tipoCombate === '⚔️ Celula') {
            dañoFinal = Math.floor(dañoFinal * 0.7);
            imprimir(`<span style='color: #ff3333;'>⚠️ Poco eficaz... Caparazón se ralentiza en la Célula.</span>`);
        } else if (this.tipoBiologico === 'Litico' && tipoCombate === '⚔️ Celula') {
            dañoFinal = Math.floor(dañoFinal * 1.5);
            imprimir(`<span style='color: #00ff66;'>⭐ ¡TIPO EFECTIVO! Alfa corroe la membrana de la Célula.</span>`);
        } else if (this.tipoBiologico === 'Litico' && tipoCombate === '⚔️ Linfocito') {
            dañoFinal = Math.floor(dañoFinal * 0.7);
            imprimir(`<span style='color: #ff3333;'>⚠️ Poco eficaz... El Linfocito neutraliza el agente Lítico.</span>`);
        }

        if (this.tipoEfecto === 'agresivo') {
            if (this.escudo > 0) {
                let bono = Math.floor(this.escudo * 0.5);
                dañoFinal += bono;
                imprimir(`🔥 <strong>¡Hermandad Viral!</strong> ${this.nombre} se sobrepotencia: +${bono} daño.`);
            }
            imprimir(`⚔️ <strong>${this.nombre}</strong> ataca:`);
            objetivo.recibirDaño(dañoFinal, !alliesAttackTurn(this), imprimir);
        } 
        else if (this.tipoEfecto === 'tanque') {
            imprimir(`🛡️ <strong>${this.nombre}</strong> arremete firme:`);
            objetivo.recibirDaño(dañoFinal, false, imprimir);
            this.escudo = Math.floor(this.vidaActual * 0.25); 
            imprimir(`🛡️ ${this.nombre} regenera su barrera: +${this.escudo} de escudo.`);

            if (aliadoEnCola && aliadoEnCola.estaVivo()) {
                aliadoEnCola.velocidad += 4;
                imprimir(`⚡ <strong>Sinergia:</strong> ${aliadoEnCola.nombre} se acelera (+4 Vel).`);
            }
        }
    }
}

function alliesAttackTurn(luchador) {
    return miEquipoGlobal.includes(luchador);
}

const LISTA_MUTACIONES = [
    { nombre: "🧬 Púas de Proteína", desc: "Aumenta el daño base de AMBAS cepas en +4.", efecto: () => { miEquipoGlobal.forEach(v => v.dañoBase += 4); } },
    { nombre: "🧪 Membrana de Titanio", desc: "Suma +30 HP de Vida Máxima a todo tu equipo.", efecto: () => { miEquipoGlobal.forEach(v => { v.vidaMax += 30; v.vidaActual += 30; }); } },
    { nombre: "⚡ Flagelos Mutantes", desc: "Aumenta la velocidad base de tus virus en +3.", efecto: () => { miEquipoGlobal.forEach(v => { v.velocidadBase += 3; v.velocidad += 3; }); } },
    { nombre: "💚 Regeneración Flash", desc: "Cura instantáneamente el 50% de la salud a todo el equipo.", efecto: () => { miEquipoGlobal.forEach(v => v.vidaActual = Math.min(v.vidaMax, v.vidaActual + Math.floor(v.vidaMax * 0.5))); } }
];

let pisoActual = 0;
let nodoActualId = null;
let nodoTipoActual = ""; 
let mapaDatos = [];
let miEquipoGlobal = []; 
let enemigosActivos = [];
let turnoGlobal = 1;
let intervaloCombate = null;

const TIPOS_NODOS = ["⚔️ Celula", "⚔️ Linfocito", "❓ Evento", "🏪 Lab"];

function inicializarEquipoJugador() {
    miEquipoGlobal = [
        new Personaje("Cepa Caparazón", 150, 9, 5, "tanque", "-8px -40px", "-788px", "[Revestimiento] Fuerte vs Linfocitos.", "Revestimiento", "alfa.png"),
        new Personaje("Cepa Alfa", 95, 26, 12, "agresivo", "-8px -395px", "-788px", "[Lítico] Fuerte vs Células comunes.", "Litico", "alfa.png")
    ];
    actualizarInterfazGestionEquipo();
}

function actualizarInterfazGestionEquipo() {
    if (miEquipoGlobal.length < 2) return;
    
    // Asignar nombres, descripciones y sprites en la gestión del mapa
    for (let i = 0; i < 2; i++) {
        document.getElementById(`slot-${i}-nombre`).innerText = miEquipoGlobal[i].nombre;
        document.getElementById(`slot-${i}-desc`).innerText = miEquipoGlobal[i].desc;
        
        let s = document.getElementById(`slot-${i}-sprite`);
        s.style.backgroundImage = `url('${miEquipoGlobal[i].spriteSheet}')`;
        s.style.backgroundPosition = miEquipoGlobal[i].bgPos;

        // --- 🔄 PROGRAMACIÓN DE LAS BARRAS EN EL MAPA ---
        let pctVidaMapa = (miEquipoGlobal[i].vidaActual / miEquipoGlobal[i].vidaMax) * 100;
        document.getElementById(`slot-${i}-hp-bar`).style.width = `${pctVidaMapa}%`;
        document.getElementById(`slot-${i}-hp-text`).innerText = `HP: ${miEquipoGlobal[i].vidaActual}/${miEquipoGlobal[i].vidaMax}`;
    }
}

document.getElementById("btn-invertir-orden").addEventListener("click", () => {
    let temporal = miEquipoGlobal[0];
    miEquipoGlobal[0] = miEquipoGlobal[1];
    miEquipoGlobal[1] = temporal;
    actualizarInterfazGestionEquipo();
});

function actualizarInterfazVisual() {
    let virusVivos = miEquipoGlobal.filter(v => v.estaVivo());
    let virus = virusVivos[0]; 
    let enemigo = enemigosActivos[0];

    let vSprite = document.getElementById("virus-render-sprite");
    if (virus) {
        document.getElementById("virus-nombre").innerText = virus.nombre;
        document.getElementById("virus-stats").innerText = `HP: ${virus.vidaActual}/${virus.vidaMax} | Escudo: ${virus.escudo}`;
        
        vSprite.style.display = "block";
        vSprite.style.backgroundImage = `url('${virus.spriteSheet}')`;
        vSprite.style.backgroundPosition = virus.bgPos;

        // Busca esto en tu actualizarInterfazVisual() dentro de game.js
        let posX = virus.bgPos.split(' ')[0];
        let posY = virus.bgPos.split(' ')[1]; // 🌟 Extraemos la Y actual del reposo

        vSprite.style.setProperty('--base-x', posX);
        vSprite.style.setProperty('--die-x', virus.diePos);
        vSprite.style.setProperty('--die-y', posY); // 🌟 Le pasamos la Y al CSS de muerte automáticamente

        let pctVida = (virus.vidaActual / virus.vidaMax) * 100;
        document.getElementById("virus-bar").style.width = `${pctVida}%`;
        let pctEscudo = Math.min(100, (virus.escudo / virus.vidaMax) * 100);
        document.getElementById("virus-shield-bar").style.width = `${pctEscudo}%`;

        if (!vSprite.classList.contains("anim-atacar") && !vSprite.classList.contains("anim-herido") && !vSprite.classList.contains("anim-muerte")) {
            vSprite.className = "sprite-battle anim-idle";
        }
    } else {
        document.getElementById("virus-nombre").innerText = "Extinto";
        document.getElementById("virus-bar").style.width = `0%`;
        document.getElementById("virus-shield-bar").style.width = `0%`;
    }

    let eSprite = document.getElementById("enemigo-render-sprite");
    if (enemigo) {
        document.getElementById("enemigo-nombre").innerText = enemigo.nombre;
        document.getElementById("enemigo-stats").innerText = `HP: ${enemigo.vidaActual}/${enemigo.vidaMax}`;
        
        eSprite.style.display = "block";
        eSprite.style.backgroundImage = `url('${enemigo.spriteSheet}')`;
        eSprite.style.backgroundPosition = enemigo.bgPos;

        let posXEnemigo = enemigo.bgPos.split(' ')[0];
        eSprite.style.setProperty('--base-x', posXEnemigo);
        eSprite.style.setProperty('--die-x', enemigo.diePos);

        let pctVidaEnemigo = (enemigo.vidaActual / enemigo.vidaMax) * 100;
        document.getElementById("enemigo-bar").style.width = `${pctVidaEnemigo}%`;

        if (!eSprite.classList.contains("anim-atacar") && !eSprite.classList.contains("anim-herido") && !eSprite.classList.contains("anim-muerte")) {
            eSprite.className = "sprite-battle anim-idle";
        }
    } else {
        document.getElementById("enemigo-nombre").innerText = "Destruido";
        document.getElementById("enemigo-bar").style.width = `0%`;
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
            let textoConexiones = nodo.conexiones.length > 0 ? ` ➔ [${nodo.conexiones.map(c => c.split('-')[1]).join(',')}]` : '';
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
    nodoTipoActual = nodo.tipo; 
    turnoGlobal = 1;

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

        if (nodo.tipo === "👑 JEFE CEREBRO") enemigosActivos = [new Personaje("NÚCLEO CENTRAL", 240, 24, 6, "agresivo", "-8px -395px", "-788px", "", "Ninguno", "enemies.png")];
        else if (nodo.tipo === "⚔️ Linfocito") enemigosActivos = [new Personaje("Linfocito T", 80, 20, 11, "agresivo", "-8px -220px", "-788px", "", "Linfocito", "enemies.png")];
        else if (nodo.tipo === "❓ Evento") enemigosActivos = [new Personaje("Glóbulo Mutado", 55, 12, 4, "agresivo", "-8px -565px", "-788px", "", "Celula", "enemies.png")];
        else enemigosActivos = [new Personaje("Célula Epitelial", 70, 15, 8, "agresivo", "-8px -40px", "-788px", "", "Celula", "enemies.png")];

        if (miEquipoGlobal[0].nombre === "Cepa Caparazón" && miEquipoGlobal[0].estaVivo()) {
            miEquipoGlobal[0].escudo = 40;
            consola.innerHTML += `<p style='color: #58a6ff;'>🛡️ <strong>Pasiva de Entrada:</strong> Desplegando blindaje pre-combate (+40 Escudo).</p>`;
        }

        document.getElementById("virus-render-sprite").className = "sprite-battle";
        document.getElementById("enemigo-render-sprite").className = "sprite-battle";

        actualizarInterfazVisual();
        consola.innerHTML += `<p class='system-msg' style='color:#58a6ff;'>🧬 Infiltrándose en nodo de tipo [${nodo.tipo}]...</p>`;
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

    let virusVivos = miEquipoGlobal.filter(v => v.estaVivo());
    if (virusVivos.length === 0 || enemigosActivos.length === 0) return;

    logGame(`<br><span style='color: #8b949e;'>[ TURNO ${turnoGlobal} ]</span>`);
    
    let virusFrente = virusVivos[0];
    let virusReserva = virusVivos[1] || null;
    let enemigoFrente = enemigosActivos[0];

    virusFrente.escudo = (turnoGlobal === 1 && virusFrente.nombre === "Cepa Caparazón") ? virusFrente.escudo : 0;

    let luchadores = [virusFrente, enemigoFrente].sort((a, b) => b.velocidad - a.velocidad);

    luchadores.forEach(luchador => {
        if (!virusFrente.estaVivo() || !enemigoFrente.estaVivo()) return;
        
        const esVirusAtacando = (luchador === virusFrente);
        const idSpriteAtacante = esVirusAtacando ? "virus-render-sprite" : "enemigo-render-sprite";
        const elAtacante = document.getElementById(idSpriteAtacante);

        if (elAtacante && luchador.estaVivo()) {
            elAtacante.className = "sprite-battle anim-atacar";
            setTimeout(() => {
                if (luchador.estaVivo()) elAtacante.className = "sprite-battle anim-idle";
            }, 400);
        }

        if (esVirusAtacando) {
            luchador.ejecutarAccion(enemigoFrente, virusReserva, nodoTipoActual, logGame);
        } else {
            let dañoEnemigoBase = enemigoFrente.dañoBase;
            
            if (virusFrente.tipoBiologico === 'Revestimiento' && nodoTipoActual === '⚔️ Linfocito') {
                enemigoFrente.dañoBase = Math.floor(dañoEnemigoBase * 0.7); 
            } else if (virusFrente.tipoBiologico === 'Revestimiento' && nodoTipoActual === '⚔️ Celula') {
                enemigoFrente.dañoBase = Math.floor(dañoEnemigoBase * 1.3); 
            } else if (virusFrente.tipoBiologico === 'Litico' && nodoTipoActual === '⚔️ Celula') {
                enemigoFrente.dañoBase = Math.floor(dañoEnemigoBase * 0.7); 
            } else if (virusFrente.tipoBiologico === 'Litico' && nodoTipoActual === '⚔️ Linfocito') {
                enemigoFrente.dañoBase = Math.floor(dañoEnemigoBase * 1.3); 
            }

            if (virusFrente.estaVivo()) {
                let modAleatorio = 0.8 + (Math.random() * 0.4); 
                let dañoFinal = Math.floor(enemigoFrente.dañoBase * modAleatorio);
                logGame(`⚔️ <strong>${enemigoFrente.nombre}</strong> contraataca:`);
                virusFrente.recibirDaño(dañoFinal, true, logGame); 
            }
            enemigoFrente.dañoBase = dañoEnemigoBase; 
        }
    });

    // --- 📊 PASO 1 CORREGIDO: Actualizamos las barras numéricas e interfaces ANTES del descarte ---
    actualizarInterfazVisual();

    // --- 💀 PASO 2 CORREGIDO: Flujo de Muerte Asíncrono Estable ---
    let flagFinalizado = false;

    if (!virusFrente.estaVivo()) {
        const vEl = document.getElementById("virus-render-sprite");
        if (vEl && !vEl.classList.contains("anim-muerte")) {
            vEl.className = "sprite-battle anim-muerte";
        }
        logGame(`<span style='color: #ff3333;'>💀 ${virusFrente.nombre} colapsó. Siguiente cepa al frente.</span>`);
        flagFinalizado = true;
    }
    
    if (!enemigoFrente.estaVivo()) {
        const eEl = document.getElementById("enemigo-render-sprite");
        if (eEl && !eEl.classList.contains("anim-muerte")) {
            eEl.className = "sprite-battle anim-muerte";
        }
        logGame(`<span style='color: #ff3333;'>💀 ${enemigoFrente.nombre} desintegrado.</span>`);
        flagFinalizado = true;
    }

    // Si hubo una baja, pausamos el bucle, esperamos los frames de la animación y luego procesamos los datos
    if (flagFinalizado) {
        clearInterval(intervaloCombate);
        intervaloCombate = null;

        setTimeout(() => {
            if (!virusFrente.estaVivo()) miEquipoGlobal.shift();
            if (!enemigoFrente.estaVivo()) enemigosActivos.shift();

            actualizarInterfazVisual(); 
            evaluarFinDelCombate(logGame);
        }, 550);
    } else {
        // Combate normal continúa sin bajas
        virusVivos = miEquipoGlobal.filter(v => v.estaVivo());
        turnoGlobal++;

        if (enemigosActivos.length === 0 || virusVivos.length === 0) {
            clearInterval(intervaloCombate);
            intervaloCombate = null;
            evaluarFinDelCombate(logGame);
        }
    }
}

function evaluarFinDelCombate(logGame) {
    let virusVivos = miEquipoGlobal.filter(v => v.estaVivo());

    if (enemigosActivos.length === 0) {
        logGame("<br><strong style='color: #00ff66;'>🏆 ¡Combate ganado! Cargando mutaciones...</strong>");
        setTimeout(mostrarPantallaRecompensas, 1000); 
    } else if (virusVivos.length === 0) {
        logGame("<br><strong style='color: #ff3333;'>💀 LA PLAGA FRACASÓ.</strong>");
        setTimeout(reiniciarJuegoTotal, 2500);
    } else {
        // Si el virus de adelante murió pero queda otro vivo en reserva, reanudamos el bucle automático
        const velocidadMs = document.getElementById("btn-velocidad-3x").disabled ? 333 : 1000;
        comenzarBucle(velocidadMs);
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