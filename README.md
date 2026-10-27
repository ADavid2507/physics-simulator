# Laboratorio de electricidad y capacitores

Primera versión del módulo 1: hasta diez cargas puntuales editables, escena 3D, consulta de campo y potencial, vectores y cuatro presets. El módulo 2 añade un capacitor ideal de placas paralelas, controles de A, d, κ y V, representación 3D y resultados C, U, Q y E. Núcleo físico independiente de React y Three.js.

## Ejecutar

Con dependencias instaladas:

```sh
npm run dev
```

Abre la dirección que muestra Vite. Para preparar y servir la versión de producción:

```sh
npm run build
npm run preview
```

El servidor y los recursos se ejecutan localmente. No hay fuentes remotas ni servicios externos necesarios para la simulación. La instalación inicial de dependencias requiere acceso al registro de paquetes.

## Comprobación rápida

1. Selecciona «+ Una carga» y coloca P en x=1, y=0, z=0.
2. El inspector debe mostrar Ex y V aproximadamente 8.9876e+3, en N/C y V; Ey y Ez deben ser cero.
3. Selecciona «Dipolo» y coloca P en el origen: el potencial debe ser cero y el campo no nulo.
4. Coloca P sobre una carga: aparece un aviso, sin resultados infinitos.
5. Agrega cargas hasta diez: el botón queda deshabilitado. Edita magnitud/posición y elimina una carga.
6. Rota la cámara, usa zoom y activa/desactiva vectores, cuadrícula y muestreo 3D.

## Convenciones y límites

- Cargas en μC en la interfaz, coordenadas en metros; núcleo en SI.
- Entradas de interfaz entre −1000000 y 1000000 en la unidad indicada. Entradas vacías o inválidas conservan el último valor válido; al salir del campo se restaura ese valor.
- Radio de consulta excluido: 0.08 m alrededor de cargas no nulas. No se modifica la ley de Coulomb fuera de esa región.
- Las flechas usan longitud logarítmica y muestrean entre −4 y 4 m. Por defecto representan el plano XY; el muestreo 3D añade planos z=−2 y z=2 m.
- Las cargas fuera del volumen de muestreo siguen contribuyendo al campo y potencial. Usa cámara/zoom para encontrarlas.
- Cargas coincidentes están permitidas y se superponen; pueden verse como una sola esfera. Cargas nulas no aportan campo ni potencial.
- Estado solo en memoria: recargar restaura el dipolo inicial.
- Requiere navegador con WebGL. Si la escena falla, el inspector numérico permanece disponible.
- Las equipotenciales se representan como curvas sobre un plano XY; no se incluyen superficies equipotenciales 3D ni gráficas paramétricas del capacitor.

## Verificación

```sh
npm run test -- --run
npm run lint
npm run build
```

Las pruebas cubren Coulomb, signo, simetría, dipolo, superposición, escenario vacío, singularidades, límite de cargas y datos no finitos. La validación visual e interacción requieren probar en un navegador con acceso al servidor local.

## Probar el módulo 2

Selecciona «02 · Capacitores». Ambos módulos conservan su configuración en memoria al navegar; recargar restablece los valores iniciales.

- Con A=100 cm², d=2 mm, κ=1 y V=100 V: C ≈ 44.271 pF, U ≈ 221.35 nJ, Q ≈ 4.4271 nC y Eᵧ = −50 kV/m.
- Duplica A: se duplica C. Duplica d: C y la magnitud de E se reducen a la mitad.
- Cambia κ a 4: C se multiplica por cuatro y E no cambia con V fijo.
- Duplica V: U se cuadruplica y Q se duplica, sin cambiar C.
- Prueba V=0: Q, U y E son cero. Con V negativo se invierten Q y E, pero U sigue siendo positiva.
- Prueba los presets y «Restablecer», y vuelve al módulo 1.

La interfaz del capacitor admite A de 1 a 400 cm², d de 0.1 a 20 mm, κ de 1 a 10 y V entre −1000 y 1000 V. Una entrada fuera de rango conserva el último valor válido y muestra un aviso; al perder foco se restaura ese valor. Los límites son educativos y no representan límites de seguridad de un capacitor real.

κ es un parámetro de material ideal, sin catálogo de materiales reales. El dieléctrico llena todo el espacio, se ignoran bordes y pérdidas y la fuente mantiene el voltaje seleccionado al cambiar la geometría. La placa superior está a V respecto de la inferior. Las dimensiones visuales usan escalas independientes y la flecha indica dirección, sin escalar su longitud con el voltaje.

Las pruebas del capacitor verifican el caso de referencia, relaciones de proporcionalidad, voltaje cero y negativo, entradas inválidas y desbordamientos. Las comprobaciones visuales anteriores son una guía manual y no constituyen pruebas de navegador automatizadas.

## Trayectoria de la partícula en el módulo 1

Debajo de la escena se encuentra «Partícula de prueba». La esfera violeta muestra su posición y la línea violeta su recorrido. Configura carga en μC, masa en gramos, posición en metros y velocidad en m/s; el motor convierte a SI.

1. Para comprobar movimiento uniforme, pulsa «Vaciar». Usa la configuración inicial de partícula (r₀=(0,2,0), v₀=(0.5,0,0), masa=1 g, carga=1 μC) e inicia: la trayectoria debe ser recta.
2. Pausa y comprueba que el tiempo y la posición se detengan. «Continuar» reanuda desde ese punto; «Reiniciar trayectoria» restaura la posición inicial sin borrar cargas.
3. Selecciona «+ Una carga» e inicia: la partícula positiva debe curvarse alejándose de la fuente positiva.
4. Reinicia y cambia la carga de partícula a −1 μC: debe comenzar a acercarse a la fuente.
5. Configura su posición inicial en el origen con una fuente en el origen: se debe rechazar la ejecución por proximidad, con aviso.
6. Modifica una carga durante una ejecución: el recorrido se elimina y la partícula vuelve a su estado inicial, preparada para ejecutar el escenario nuevo.
7. Cambia al módulo 2: el tiempo físico deja de avanzar mientras el módulo 1 está oculto; al volver continúa si estaba en ejecución. Una pausa explícita se conserva.

La integración usa RK4 con dt=0.002 s, bloques de diez pasos cada actualización nominal de 20 ms, hasta 20 s o 10000 pasos. Los fotogramas no modifican dt; en equipos lentos la animación puede durar más que el tiempo físico. El recorrido visual conserva una de cada cinco muestras y el punto final; el núcleo integra todos los pasos.

El dominio de trayectoria es un cubo de −10 a 10 m por eje. Al salir, acercarse a 0.08 m de una carga o detectar un valor inválido, se detiene y conserva el último punto válido. Se revisan las etapas intermedias de RK4 y el segmento entre muestras para evitar atravesar cargas. Las partículas neutras también se detienen cerca de una fuente. Las cargas fuente permanecen fijas y la partícula no altera el campo.

Los límites de entrada de la partícula son: carga ±100 μC, masa 0.001 a 10000 g, posición ±10 m por eje y velocidad ±100 m/s por eje. Son controles educativos. El paso fijo no garantiza precisión para cualquier combinación extrema: se comprueba convergencia en escenarios no singulares y no se implementan relatividad ni radiación.

Las pruebas automatizadas cubren movimiento uniforme y acelerado, convergencia RK4 en un campo dependiente de posición y en un campo electrostático, signo de la aceleración, reproducibilidad, datos inválidos y condiciones de parada. Los controles de animación y su aspecto se comprueban manualmente con los pasos anteriores.

## Líneas de campo y equipotenciales

Activa «Líneas de campo» o «Equipotenciales XY» debajo de la escena del módulo 1. Ambas opciones comienzan desactivadas para permitir comparar capas. Puedes ocultar los vectores para apreciar mejor las curvas.

- Las líneas verdes siguen la dirección de E, desde cargas positivas hacia negativas o hacia el límite del dominio. Una punta en cada línea indica la dirección física; el número de líneas no representa la magnitud de la carga.
- Cada carga no nula aporta doce semillas (ocho en XY y cuatro fuera del plano). Se integra la dirección normalizada con el método de punto medio, paso espacial 0.045 m y hasta 360 pasos por semilla. En cargas negativas se integra hacia afuera en sentido inverso y se invierte el orden final para representar E correctamente.
- Las líneas terminan cerca de cargas, en campo casi nulo, en el borde del cubo ±5 m o al alcanzar el límite de pasos. El muestreo es ilustrativo y no pretende cubrir todas las líneas posibles; cargas fuera del dominio pueden no generar semillas visibles.
- Las equipotenciales se calculan con Marching Squares sobre 64 × 64 celdas en XY, de −5 a 5 m. El control z desplaza el plano entre −5 y 5 m sin mover las cargas ni el punto de consulta.
- Los niveles se eligen automáticamente a partir de la distribución de |V| del plano y se muestran en voltios junto al control. Naranja representa potencial positivo, azul negativo y blanco V=0. Solo se listan niveles con segmentos visibles; los niveles pueden cambiar al editar el escenario o el plano.
- Las celdas que intersectan la región singular se excluyen. Los contornos son aproximados; el inspector sigue usando la fórmula de potencial sin interpolación.

Comprobación visual sugerida:

1. Selecciona «+ Una carga»: las líneas deben salir radialmente y los contornos deben parecer círculos en XY.
2. Selecciona «− Una carga»: las puntas de las líneas deben apuntar hacia la carga y los contornos deben ser azules.
3. Selecciona «Dipolo»: las líneas que conectan las cargas deben ir de positivo a negativo y el contorno blanco debe aparecer sobre x=0 en el plano XY.
4. Desplaza z: los contornos deben permanecer en el plano seleccionado y cambiar según el potencial allí.
5. Pulsa «Vaciar»: no deben quedar líneas ni contornos. Ejecuta una trayectoria con las capas activas para comprobar que siguen siendo independientes.

Las pruebas nuevas cubren dirección radial y dipolar, límites de trazado, ausencia de fuentes, interpolación, los dieciséis patrones de celda, casos ambiguos de silla, radio analítico de una equipotencial, bisectriz de un dipolo y plano z. En entornos Windows con errores intermitentes de archivos temporales de Vitest se puede verificar la suite usando un solo worker compartido:

```sh
npm run test -- --run --pool=threads --no-isolate --maxWorkers=1
```

## Módulo 3 Circuitos DC

Abre «03 · Circuitos». Se resuelve una red de resistores y fuentes ideales mediante análisis nodal modificado y eliminación gaussiana con pivoteo parcial y escalado de filas. No se clasifica la topología para resolverla: el mismo solver admite redes mixtas y puentes.

- Agrega o elimina resistores/fuentes, cambia sus valores y asigna nombres de nodo a sus terminales A y B. Los terminales con el mismo nombre están conectados eléctricamente. El nodo 0 representa tierra. Para desconectar un terminal, asígnale un nodo nuevo; se advertirá si queda sin retorno.
- Arrastra los bloques del editor para ordenar el dibujo. Las coordenadas visuales no se envían al solver. El editor es SVG y las conexiones se editan mediante nombres de nodo; no usa gestos de arrastre de cables.
- Corriente positiva: A → B. En fuentes A es el terminal positivo. Potencia negativa significa que la fuente entrega energía; resistores disipan potencia positiva.
- Se muestran voltajes nodales, corriente/caída/potencia de cada componente, potencia disipada y entregada neta y resistencia equivalente si hay una sola fuente y corriente no nula.
- Límite educativo: 24 componentes, 16 nodos, resistencias de 0.001 a 1e9 Ω y voltajes de ±10000 V. Valores fuera de rango se rechazan; sistemas singulares o mal condicionados no muestran una solución numérica.
- El visualizador independiente de Ohm permite variar V entre 0 y 24 V y R entre 1 y 10000 Ω; grafica I(V) con R fija o I(R) con V fijo. Las gráficas se dibujan con SVG local, sin servicios de red.

Casos de demostración: «Fuente y resistor»: 12 V / 6 Ω = 2 A, 24 W. «Serie»: 100+200 Ω a 12 V, 0.04 A, caídas de 4 y 8 V. «Paralelo»: 0.12 y 0.06 A. «Mixto»: Req=200 Ω, corriente total 0.06 A y dos ramas de 0.03 A.

## Módulo 4 Magnetismo y Lorentz

Abre «04 · Magnetismo». La fuente se consulta mediante una interfaz común para campo uniforme, conductor recto infinito y dipolo puntual. Se admiten posición y orientación arbitrarias para las fuentes no uniformes.

- B uniforme se edita en mT y el núcleo usa T. Conductor: corriente en A y dirección de la corriente positiva. Dipolo: momento en A·m². La dirección y el momento deben ser no nulos.
- E es uniforme y se introduce en V/m. La partícula usa μC, μg, m y m/s en la UI, convertidos a C y kg en el núcleo. Atención: la masa aquí se presenta en microgramos, no en los gramos del módulo 1.
- RK4 es el mismo del módulo 1, ampliado para que la aceleración reciba posición y velocidad de cada etapa. Se integra q(E+v×B)/m con dt=0.002 s, diez pasos por actualización, hasta 20 s y 10000 muestras. La trayectoria se detiene en el límite ±10 m, cerca de fuentes a menos de 0.12 m o ante errores numéricos.
- Un control de resolución rechaza pasos con frecuencia ciclotrón excesiva o desplazamiento estimado demasiado grande. Si aparece el aviso, reduce q, B, E o velocidad, o aumenta masa. No se implementan pasos adaptativos ni Boris.
- Las líneas usan punto medio en la dirección normalizada de B, 700 pasos como máximo, paso espacial 0.05 m y dominio ±5 m. Detectan regreso a la semilla para cerrar lazos del conductor. Las líneas de un campo uniforme se recortan al dominio.
- El dipolo es una aproximación puntual del campo exterior, no una simulación interna del material. Sus ramas se detienen en la singularidad excluida; la barra representa orientación y no añade un cierre físico ficticio.
- Ocultar vectores/líneas solicita refresco de la escena. Cambiar la configuración borra la trayectoria; pausar conserva el estado y navegar a otro módulo suspende el tiempo.

Prueba «Órbita circular»: q=1 μC, masa=1 μg, Bz=1 mT, rapidez inicial=1 m/s. Radio teórico=1 m, período=2π s. «Hélice» añade vz=0.2 m/s; «Carga negativa» invierte la curvatura; «E y B cruzados» añade Ex=0.001 V/m. «Conductor»: I=1000 A, a 1 m B=0.0002 T. «Dipolo»: momento de 10000 A·m², en el ecuador a 1 m Bz=−0.001 T.

## Evidencia de integración de módulos 3 y 4

Se ejecutaron 68 pruebas unitarias/de integración de los cuatro núcleos, lint y build. Los casos nuevos verifican MNA para redes arbitrarias, KCL/KVL y potencia, múltiples fuentes, errores topológicos; producto cruz y punto, conductor/dipolo, Lorentz y polaridad; radio y conservación de rapidez tras una órbita y cierre de líneas del conductor.

En el navegador se comprobaron presets serie/paralelo/mixto, eliminación y error de circuito abierto; iniciar/pausar/continuar/reiniciar en magnetismo y dirección de conductor inválida. El navegador automatizado no tiene WebGL: la apariencia y funcionamiento de las nuevas capas 3D requieren revisión en el navegador habitual con aceleración gráfica.

La carpeta original del chat estaba vacía. La versión activa encontrada y actualizada está en `C:\Users\David\OneDrive\Documentos\physics-simulator`. Ejecuta los comandos de desarrollo desde esa carpeta.
