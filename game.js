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
            if (cantidad <= this.escudo) {
                this.escudo -= cantidad;
                imprimir(`🛡️ El escudo de ${this.nombre} absorbió todo el daño.`);
                return;
            } else {
                cantidad -= this.escudo;
                imprimir(`🛡️ El escudo de ${this.nombre} se rompió. Absorbió ${this.escudo}.`);
                this.escudo = 0;
            }
        }

        this.vidaActual -= cantidad;
        if (this.vidaActual < 0) this.vidaActual = 0;
        imprimir(`💥 ${this.nombre} recibe ${cantidad} de daño. (Vida: ${this.vidaActual}/${this.vidaMax})`);
    }

    ejecutarAccion(objetivo, imprimir) {
        if (!this.estaVivo()) return;

        imprimir(`🦠 Turno de <strong>${this.nombre}</strong> (${this.tipoEfecto}):`);

        if (this.tipoEfecto === 'agresivo') {
            objetivo.recibirDaño(this.daño, imprimir);
        } 
        else if (this.tipoEfecto === 'tanque') {
            objetivo.recibirDaño(this.daño, imprimir);
            let cantidadEscudo = Math.floor(this.vidaMax * 0.20);
            this.escudo += cantidadEscudo;
            imprimir(`🛡️ ${this.nombre} genera ${cantidadEscudo} de escudo.`);
        } 
        else if (this.tipoEfecto === 'toxico') {
            objetivo.recibirDaño(this.daño, imprimir);
            objetivo.venenoAcumulado += 3; 
            imprimir(`🤢 ${this.nombre} aplicó Necrosis a ${objetivo.nombre}.`);
        }
    }
}

document.getElementById('btn-infectar').addEventListener('click', () => {
    const contenedorLogs = document.getElementById('log-consola');
    contenedorLogs.innerHTML = ""; // Limpiar pantalla anterior

    // Función auxiliar para imprimir texto en la interfaz y hacer auto-scroll
    function logGame(texto) {
        const p = document.createElement('p');
        p.innerHTML = texto;
        contenedorLogs.appendChild(p);
        contenedorLogs.scrollTop = contenedorLogs.scrollHeight;
    }

    // --- Inicialización del Combate ---
    let virusAgresivo = new Personaje("Cepa Alfa", 80, 20, 12, "agresivo");
    let virusTanque = new Personaje("Cepa Caparazón", 150, 5, 5, "tanque");
    let virusToxico = new Personaje("Cepa Ébola-X", 60, 8, 15, "toxico");

    let miEquipo = [virusTanque, virusToxico, virusAgresivo]; 

    let enemigo1 = new Personaje("Linfocito B", 60, 15, 10, "agresivo");
    let enemigo2 = new Personaje("Macrófago", 100, 18, 4, "agresivo");

    let enemigos = [enemigo1, enemigo2];

    let turnoGlobal = 1;
    logGame("<span style='color: #00ff66; font-weight: bold;'>--- 🏁 ¡INICIA LA INFECCIÓN EN VIRO.BEE! ---</span>");

    while (miEquipo.length > 0 && enemigos.length > 0) {
        logGame(`<br><span style='color: #8b949e;'>[ TURNO ${turnoGlobal} ]</span>`);
        
        let virusFrente = miEquipo[0];
        let enemigoFrente = enemigos[0];

        let luchadores = [virusFrente, enemigoFrente];
        luchadores.sort((a, b) => b.velocidad - a.velocidad);

        for (let luchador of luchadores) {
            if (!luchador.estaVivo()) continue;
            let objetivo = (luchador === virusFrente) ? enemigoFrente : virusFrente;
            luchador.ejecutarAccion(objetivo, logGame);

            if (!objetivo.estaVivo()) {
                logGame(`<span style='color: #ff3333;'>💀 ${objetivo.nombre} ha sido destruido.</span>`);
            }
        }

        // Efectos fin de turno
        for (let luchador of luchadores) {
            if (luchador.estaVivo() && luchador.venenoAcumulado > 0) {
                logGame(`🤢 El veneno carcome a ${luchador.nombre}:`);
                luchador.recibirDaño(6, logGame);
                luchador.venenoAcumulado--;
                if (!luchador.estaVivo()) logGame(`<span style='color: #ff3333;'>💀 ${luchador.nombre} murió por Necrosis.</span>`);
            }
        }

        // Limpieza de bajas
        if (!virusFrente.estaVivo()) miEquipo.shift();
        if (!enemigoFrente.estaVivo()) enemigos.shift();

        turnoGlobal++;
        if (turnoGlobal > 100) break;
    }

    logGame("<br><span style='color: #00ff66;'>--- 🎉 SIMULACIÓN CONCLUIDA ---</span>");
    if (miEquipo.length > 0) {
        logGame("<strong style='color: #00ff66;'>🏆 ¡VICTORIA! El virus infectó con éxito.</strong>");
    } else {
        logGame("<strong style='color: #ff3333;'>💀 GAME OVER. El sistema inmune barrió la plaga.</strong>");
    }
});